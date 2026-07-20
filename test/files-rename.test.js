import assert from 'node:assert/strict';
import test from 'node:test';

import { handleRenameItem } from '../src/api/files.js';

class MockR2Bucket {
    constructor(entries = []) {
        this.entries = new Map();
        this.failDeleteOnce = new Set();
        for (const [key, value, metadata = {}] of entries) {
            this.entries.set(key, {
                body: new TextEncoder().encode(value),
                httpMetadata: { ...(metadata.httpMetadata || {}) },
                customMetadata: { ...(metadata.customMetadata || {}) }
            });
        }
    }

    async head(key) {
        const entry = this.entries.get(key);
        if (!entry) return null;
        return {
            key,
            httpMetadata: { ...entry.httpMetadata },
            customMetadata: { ...entry.customMetadata }
        };
    }

    async get(key) {
        const entry = this.entries.get(key);
        if (!entry) return null;
        return {
            body: entry.body.slice(),
            httpMetadata: { ...entry.httpMetadata },
            customMetadata: { ...entry.customMetadata }
        };
    }

    async put(key, body, options = {}) {
        const bytes = body instanceof Uint8Array
            ? body.slice()
            : new Uint8Array(body);
        this.entries.set(key, {
            body: bytes,
            httpMetadata: { ...(options.httpMetadata || {}) },
            customMetadata: { ...(options.customMetadata || {}) }
        });
    }

    async delete(key) {
        if (this.failDeleteOnce.delete(key)) {
            throw new Error('Injected delete failure: ' + key);
        }
        this.entries.delete(key);
    }

    async list({ prefix = '', cursor, limit = 1000 } = {}) {
        const keys = Array.from(this.entries.keys())
            .filter(key => key.startsWith(prefix))
            .sort();
        const offset = Number(cursor || 0);
        const page = keys.slice(offset, offset + limit);
        const nextOffset = offset + page.length;
        return {
            objects: page.map(key => ({ key })),
            truncated: nextOffset < keys.length,
            cursor: nextOffset < keys.length ? String(nextOffset) : undefined
        };
    }
}

class MockKV {
    constructor(entries = []) {
        this.entries = new Map(entries.map(([key, value]) => [key, structuredClone(value)]));
        this.failPutKeys = new Set();
    }

    async get(key, type) {
        if (!this.entries.has(key)) return null;
        const value = this.entries.get(key);
        return type === 'json' ? structuredClone(value) : JSON.stringify(value);
    }

    async put(key, value) {
        if (this.failPutKeys.has(key)) {
            throw new Error('Injected KV put failure: ' + key);
        }
        this.entries.set(key, JSON.parse(value));
    }

    async delete(key) {
        this.entries.delete(key);
    }

    async list({ cursor, limit = 1000 } = {}) {
        const keys = Array.from(this.entries.keys()).sort();
        const offset = Number(cursor || 0);
        const page = keys.slice(offset, offset + limit);
        const nextOffset = offset + page.length;
        return {
            keys: page.map(name => ({ name })),
            list_complete: nextOffset >= keys.length,
            cursor: nextOffset < keys.length ? String(nextOffset) : undefined
        };
    }
}

function createEnv(bucket, kv = new MockKV()) {
    return { BUCKET_R2: bucket, SHARES_KV: kv };
}

async function rename(env, sourceItem, newName) {
    const request = new Request('https://pixr2.test/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceItem, newName })
    });
    const response = await handleRenameItem(request, env);
    return { response, body: await response.json() };
}

test('renames a file and refreshes safe HTTP metadata for its new extension', async () => {
    const bucket = new MockR2Bucket([
        ['docs/note.txt', 'hello', {
            httpMetadata: { contentType: 'text/plain', cacheControl: 'public, max-age=60' },
            customMetadata: { owner: 'tester' }
        }]
    ]);

    const { response, body } = await rename(
        createEnv(bucket),
        { type: 'file', key: 'docs/note.txt' },
        '页面.html'
    );

    assert.equal(response.status, 200);
    assert.equal(body.destination, 'docs/页面.html');
    assert.equal(await bucket.head('docs/note.txt'), null);
    const renamed = await bucket.get('docs/页面.html');
    assert.equal(new TextDecoder().decode(renamed.body), 'hello');
    assert.equal(renamed.httpMetadata.contentType, 'application/octet-stream');
    assert.match(renamed.httpMetadata.contentDisposition, /页面\.html/);
    assert.deepEqual(renamed.customMetadata, { owner: 'tester' });
});

test('rejects file-to-directory name conflicts without changing the source', async () => {
    const bucket = new MockR2Bucket([
        ['docs/source.txt', 'source'],
        ['docs/taken/item.txt', 'taken']
    ]);

    const { response, body } = await rename(
        createEnv(bucket),
        { type: 'file', key: 'docs/source.txt' },
        'taken'
    );

    assert.equal(response.status, 409);
    assert.equal(body.success, false);
    assert.ok(await bucket.head('docs/source.txt'));
    assert.equal(await bucket.head('docs/taken'), null);
});

test('returns a no-op result for the same name and 404 for a missing source', async () => {
    const bucket = new MockR2Bucket([['docs/source.txt', 'source']]);
    const env = createEnv(bucket);

    const unchanged = await rename(
        env,
        { type: 'file', key: 'docs/source.txt' },
        'source.txt'
    );
    assert.equal(unchanged.response.status, 200);
    assert.equal(unchanged.body.skipped, true);
    assert.equal(unchanged.body.affectedObjects, 0);

    const missing = await rename(
        env,
        { type: 'file', key: 'docs/missing.txt' },
        'renamed.txt'
    );
    assert.equal(missing.response.status, 404);
    assert.ok(await bucket.head('docs/source.txt'));
});

test('renames a nested folder and keeps exact and child share links working', async () => {
    const exactShareId = 'AAAAAAAAAAAAAAAA';
    const childShareId = 'BBBBBBBBBBBBBBBB';
    const unrelatedShareId = 'CCCCCCCCCCCCCCCC';
    const bucket = new MockR2Bucket([
        ['albums/', '', { httpMetadata: { contentType: 'application/x-directory' } }],
        ['albums/cover.jpg', 'cover'],
        ['albums/trips/photo.jpg', 'photo']
    ]);
    const kv = new MockKV([
        ['share:' + exactShareId, { path: 'albums/' }],
        [childShareId, { path: 'albums/trips/' }],
        ['share:' + unrelatedShareId, { path: 'documents/' }]
    ]);

    const { response, body } = await rename(
        createEnv(bucket, kv),
        { type: 'directory', path: 'albums/' },
        '相册'
    );

    assert.equal(response.status, 200);
    assert.equal(body.affectedObjects, 3);
    assert.equal(body.updatedShares, 2);
    assert.equal(await bucket.head('albums/cover.jpg'), null);
    assert.ok(await bucket.head('相册/cover.jpg'));
    assert.ok(await bucket.head('相册/trips/photo.jpg'));
    assert.deepEqual(await kv.get('share:' + exactShareId, 'json'), { path: '相册/' });
    assert.deepEqual(await kv.get(childShareId, 'json'), { path: '相册/trips/' });
    assert.deepEqual(await kv.get('share:' + unrelatedShareId, 'json'), { path: 'documents/' });
});

test('renames folders that require more than one R2 listing page', async () => {
    const entries = Array.from(
        { length: 1001 },
        (_, index) => ['large/file-' + String(index).padStart(4, '0') + '.txt', String(index)]
    );
    const bucket = new MockR2Bucket(entries);

    const { response, body } = await rename(
        createEnv(bucket),
        { type: 'directory', path: 'large/' },
        'archive'
    );

    assert.equal(response.status, 200);
    assert.equal(body.affectedObjects, 1001);
    assert.equal(await bucket.head('large/file-0000.txt'), null);
    assert.ok(await bucket.head('archive/file-1000.txt'));
});

test('scans every KV page when updating folder shares', async () => {
    const unrelatedShares = Array.from(
        { length: 1000 },
        (_, index) => [
            'share:' + String(index).padStart(16, '0'),
            { path: 'unrelated/' }
        ]
    );
    const relatedShareId = 'ZZZZZZZZZZZZZZZZ';
    const bucket = new MockR2Bucket([['source/', '']]);
    const kv = new MockKV([
        ...unrelatedShares,
        ['share:' + relatedShareId, { path: 'source/child/' }]
    ]);

    const { response, body } = await rename(
        createEnv(bucket, kv),
        { type: 'directory', path: 'source/' },
        'renamed'
    );

    assert.equal(response.status, 200);
    assert.equal(body.updatedShares, 1);
    assert.deepEqual(
        await kv.get('share:' + relatedShareId, 'json'),
        { path: 'renamed/child/' }
    );
});

test('rolls back copied objects and prior share updates when a later KV write fails', async () => {
    const firstShare = 'AAAAAAAAAAAAAAAA';
    const secondShare = 'BBBBBBBBBBBBBBBB';
    const bucket = new MockR2Bucket([
        ['source/', ''],
        ['source/file.txt', 'content']
    ]);
    const kv = new MockKV([
        ['share:' + firstShare, { path: 'source/' }],
        ['share:' + secondShare, { path: 'source/child/' }]
    ]);
    kv.failPutKeys.add('share:' + secondShare);

    const { response } = await rename(
        createEnv(bucket, kv),
        { type: 'directory', path: 'source/' },
        'renamed'
    );

    assert.equal(response.status, 500);
    assert.ok(await bucket.head('source/file.txt'));
    assert.equal(await bucket.head('renamed/file.txt'), null);
    assert.deepEqual(await kv.get('share:' + firstShare, 'json'), { path: 'source/' });
    assert.deepEqual(await kv.get('share:' + secondShare, 'json'), { path: 'source/child/' });
});

test('restores deleted source objects and shares when deletion fails midway', async () => {
    const shareId = 'AAAAAAAAAAAAAAAA';
    const bucket = new MockR2Bucket([
        ['source/', ''],
        ['source/file.txt', 'content']
    ]);
    bucket.failDeleteOnce.add('source/file.txt');
    const kv = new MockKV([['share:' + shareId, { path: 'source/' }]]);

    const { response } = await rename(
        createEnv(bucket, kv),
        { type: 'directory', path: 'source/' },
        'renamed'
    );

    assert.equal(response.status, 500);
    assert.ok(await bucket.head('source/'));
    assert.ok(await bucket.head('source/file.txt'));
    assert.equal(await bucket.head('renamed/'), null);
    assert.equal(await bucket.head('renamed/file.txt'), null);
    assert.deepEqual(await kv.get('share:' + shareId, 'json'), { path: 'source/' });
});

test('rejects invalid names and attempts to rename the root or internal marker', async () => {
    const bucket = new MockR2Bucket([
        ['file.txt', 'content'],
        ['.null', 'marker']
    ]);
    const env = createEnv(bucket);

    for (const newName of ['', '..', 'nested/name']) {
        const { response } = await rename(env, { type: 'file', key: 'file.txt' }, newName);
        assert.equal(response.status, 400);
    }

    const rootResult = await rename(env, { type: 'directory', path: '/' }, 'root');
    assert.equal(rootResult.response.status, 400);
    const markerResult = await rename(env, { type: 'file', key: '.null' }, 'marker');
    assert.equal(markerResult.response.status, 400);
});
