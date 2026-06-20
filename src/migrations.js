import { isAuthenticated } from './auth.js';
import { FILE_CACHE_CONTROL } from './config.js';
import { isValidShareId, SHARE_KV_PREFIX, shareKvKey, telegramPathKey, TELEGRAM_PATH_KV_PREFIX } from './storage-keys.js';
import { buildUploadHttpMetadata, normalizeR2Prefix } from './utils/files.js';

const MIGRATION_STATE_KEY = 'pixr2:migration:security-v1';
const MIGRATION_LOCK_KEY = 'pixr2:migration:security-v1:lock';
const MIGRATION_LOCK_TTL_SECONDS = 60;
const DEFAULT_KV_BATCH_SIZE = 100;
const DEFAULT_R2_BATCH_SIZE = 5;
const MAX_KV_BATCH_SIZE = 500;
const MAX_R2_BATCH_SIZE = 25;

const AUTO_MIGRATION_PATHS = new Set([
    '/explorer',
    '/api/list',
    '/api/share/list',
    '/api/directories'
]);

export async function scheduleAutomaticSecurityMigration(request, env, ctx) {
    if (!ctx?.waitUntil || !shouldTriggerAutomaticSecurityMigration(request)) return;
    if (!await isAuthenticated(request, env.SECRET_KEY)) return;

    ctx.waitUntil(runAutomaticSecurityMigration(env));
}

export function shouldTriggerAutomaticSecurityMigration(request) {
    if (request.method !== 'GET') return false;
    const { pathname } = new URL(request.url);
    return AUTO_MIGRATION_PATHS.has(pathname);
}

export async function runAutomaticSecurityMigration(env) {
    try {
        if (!env.SHARES_KV || !env.INDEXES_KV || !env.BUCKET_R2) return;
        if (await env.INDEXES_KV.get(MIGRATION_LOCK_KEY)) return;

        await env.INDEXES_KV.put(MIGRATION_LOCK_KEY, Date.now().toString(), {
            expirationTtl: MIGRATION_LOCK_TTL_SECONDS
        });

        const state = await readMigrationState(env);
        const kvLimit = readBoundedInteger(env.SECURITY_MIGRATION_KV_BATCH_SIZE, DEFAULT_KV_BATCH_SIZE, 1, MAX_KV_BATCH_SIZE);
        const r2Limit = readBoundedInteger(env.SECURITY_MIGRATION_R2_BATCH_SIZE, DEFAULT_R2_BATCH_SIZE, 1, MAX_R2_BATCH_SIZE);

        if (!state.shares.complete) {
            await migrateLegacyShareKeys(env, state, kvLimit);
        }

        if (!state.telegramPaths.complete) {
            await migrateLegacyTelegramPathKeys(env, state, kvLimit);
        }

        if (!state.r2Metadata.complete) {
            await migrateUnsafeR2Metadata(env, state, r2Limit);
        }

        state.updatedAt = new Date().toISOString();
        if (state.shares.complete && state.telegramPaths.complete && state.r2Metadata.complete && !state.completedAt) {
            state.completedAt = state.updatedAt;
        }

        await writeMigrationState(env, state);
        await env.INDEXES_KV.delete(MIGRATION_LOCK_KEY);
    } catch (error) {
        console.error('Automatic security migration failed:', error);
    }
}

async function migrateLegacyShareKeys(env, state, limit) {
    const listResult = await env.SHARES_KV.list({
        cursor: state.shares.cursor || undefined,
        limit
    });

    for (const key of listResult.keys) {
        const keyName = key.name;
        if (keyName.startsWith(SHARE_KV_PREFIX) || !isValidShareId(keyName)) continue;

        try {
            const value = await env.SHARES_KV.get(keyName, 'json');
            if (!value || typeof value.path === 'undefined') continue;

            const normalizedPath = normalizeR2Prefix(value.path || '');
            const namespacedKey = shareKvKey(keyName);
            const existingValue = await env.SHARES_KV.get(namespacedKey, 'json');
            if (!existingValue || typeof existingValue.path === 'undefined') {
                await env.SHARES_KV.put(namespacedKey, JSON.stringify({ path: normalizedPath }));
            }
            await env.SHARES_KV.delete(keyName);
            state.shares.migrated += 1;
        } catch (error) {
            state.shares.errors += 1;
            console.error(`Failed to migrate legacy share key ${keyName}:`, error);
        }
    }

    state.shares.cursor = listResult.list_complete ? null : listResult.cursor;
    state.shares.complete = Boolean(listResult.list_complete);
}

async function migrateLegacyTelegramPathKeys(env, state, limit) {
    const allowedChatIds = getAllowedTelegramChatIds(env);
    if (allowedChatIds.size === 0) {
        state.telegramPaths.complete = true;
        state.telegramPaths.cursor = null;
        return;
    }

    const listResult = await env.INDEXES_KV.list({
        cursor: state.telegramPaths.cursor || undefined,
        limit
    });

    for (const key of listResult.keys) {
        const keyName = key.name;
        if (!isLegacyTelegramPathKey(keyName) || !allowedChatIds.has(keyName)) continue;

        try {
            const path = await env.INDEXES_KV.get(keyName);
            if (path === null) continue;

            const normalizedPath = normalizeTelegramPath(path);
            const namespacedKey = telegramPathKey(keyName);
            const existingValue = await env.INDEXES_KV.get(namespacedKey);
            if (existingValue === null) {
                await env.INDEXES_KV.put(namespacedKey, normalizedPath);
            }
            await env.INDEXES_KV.delete(keyName);
            state.telegramPaths.migrated += 1;
        } catch (error) {
            state.telegramPaths.errors += 1;
            console.error(`Failed to migrate legacy Telegram path key ${keyName}:`, error);
        }
    }

    state.telegramPaths.cursor = listResult.list_complete ? null : listResult.cursor;
    state.telegramPaths.complete = Boolean(listResult.list_complete);
}

async function migrateUnsafeR2Metadata(env, state, limit) {
    const listResult = await env.BUCKET_R2.list({
        cursor: state.r2Metadata.cursor || undefined,
        limit
    });

    for (const objectSummary of listResult.objects) {
        const key = objectSummary.key;
        if (!key || key.endsWith('/')) continue;

        try {
            const head = await env.BUCKET_R2.head(key);
            const targetMetadata = getForcedDownloadMetadata(key, head?.httpMetadata);
            if (!head || !targetMetadata) continue;

            const object = await env.BUCKET_R2.get(key);
            if (!object?.body) continue;

            await env.BUCKET_R2.put(key, object.body, {
                httpMetadata: targetMetadata,
                customMetadata: head.customMetadata
            });
            state.r2Metadata.migrated += 1;
        } catch (error) {
            state.r2Metadata.errors += 1;
            console.error(`Failed to migrate R2 metadata for ${key}:`, error);
        }
    }

    state.r2Metadata.cursor = listResult.truncated ? listResult.cursor : null;
    state.r2Metadata.complete = !listResult.truncated;
}

function getForcedDownloadMetadata(key, currentMetadata = {}) {
    const fileName = key.split('/').pop() || key;
    const currentContentType = currentMetadata?.contentType || '';
    const targetMetadata = buildUploadHttpMetadata(fileName, currentContentType);

    if (!targetMetadata.contentDisposition) return null;

    const nextMetadata = {
        ...currentMetadata,
        ...targetMetadata,
        cacheControl: targetMetadata.cacheControl || currentMetadata?.cacheControl || FILE_CACHE_CONTROL
    };

    if (
        currentMetadata?.contentType === nextMetadata.contentType &&
        currentMetadata?.contentDisposition === nextMetadata.contentDisposition &&
        currentMetadata?.cacheControl === nextMetadata.cacheControl
    ) {
        return null;
    }

    return nextMetadata;
}

async function readMigrationState(env) {
    const savedState = await env.INDEXES_KV.get(MIGRATION_STATE_KEY, 'json');
    return {
        shares: normalizeStepState(savedState?.shares),
        telegramPaths: normalizeStepState(savedState?.telegramPaths),
        r2Metadata: normalizeStepState(savedState?.r2Metadata),
        updatedAt: savedState?.updatedAt || null,
        completedAt: savedState?.completedAt || null
    };
}

async function writeMigrationState(env, state) {
    await env.INDEXES_KV.put(MIGRATION_STATE_KEY, JSON.stringify(state));
}

function normalizeStepState(stepState = {}) {
    return {
        cursor: stepState.cursor || null,
        complete: Boolean(stepState.complete),
        migrated: Number.isSafeInteger(stepState.migrated) ? stepState.migrated : 0,
        errors: Number.isSafeInteger(stepState.errors) ? stepState.errors : 0
    };
}

function normalizeTelegramPath(path = '') {
    return path === '/' ? '' : normalizeR2Prefix(path);
}

function isLegacyTelegramPathKey(keyName = '') {
    return /^-?\d{1,32}$/.test(keyName)
        && !keyName.startsWith(TELEGRAM_PATH_KV_PREFIX)
        && keyName !== MIGRATION_LOCK_KEY
        && keyName !== MIGRATION_STATE_KEY;
}

function getAllowedTelegramChatIds(env) {
    return new Set((env.USER_ID || env.CHAT_ID || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean));
}

function readBoundedInteger(value, fallback, min, max) {
    const parsedValue = parseInt(value, 10);
    if (!Number.isFinite(parsedValue)) return fallback;
    return Math.min(max, Math.max(min, parsedValue));
}
