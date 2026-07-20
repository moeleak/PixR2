import { R2_PUBLIC_BASE_URL } from '../config.js';
import {
    buildMarkdownLink,
    buildObjectUrl,
    buildStoredFileName,
    buildUploadHttpMetadata,
    buildUniqueR2Key,
    buildUploadTarget,
    detectImageType,
    generateRandomString,
    getFileTypeInfo,
    listR2Files,
    normalizeR2Prefix,
    resolveSafeUploadContentType,
} from '../utils/files.js';
import { isValidShareId, SHARE_KV_PREFIX, shareKvKey } from '../storage-keys.js';

/**
 * 处理从网页界面上传的文件
 * @param {Request} request - 包含文件数据的请求
 * @param {R2Bucket} bucket - R2存储桶实例
 * @returns {Promise<Response>} - 包含上传结果的JSON响应
 */
export async function handleWebUpload(request, bucket) {
    try {
        const requestContentType = request.headers.get('Content-Type') || '';
        if (requestContentType.includes('multipart/form-data')) {
            return handleMultipartWebUpload(request, bucket);
        }

        const url = new URL(request.url);
        const originalName = url.searchParams.get('filename') || '';
        const path = url.searchParams.get('path') || '';
        const useRandomName = url.searchParams.get('randomName') === 'true';

        if (!originalName || !request.body) {
            return new Response(JSON.stringify({
                success: false,
                message: "No file provided"
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const uploadTarget = await buildUploadTarget(bucket, {
            fileName: originalName,
            path,
            contentType: requestContentType,
            useRandomName
        });

        await bucket.put(uploadTarget.key, request.body, {
            httpMetadata: buildUploadHttpMetadata(uploadTarget.fileName, requestContentType)
        });

        const fileUrl = buildObjectUrl(R2_PUBLIC_BASE_URL, uploadTarget.key);

        return new Response(JSON.stringify({
            success: true,
            url: fileUrl,
            markdown: buildMarkdownLink(uploadTarget.fileName, fileUrl, uploadTarget.fileTypeInfo.isImage),
            isImage: uploadTarget.fileTypeInfo.isImage,
            key: uploadTarget.key
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Upload failed:', error);
        const isInvalidPath = error.message === 'Invalid path';
        return new Response(JSON.stringify({
            success: false,
            message: isInvalidPath ? 'Invalid path' : "File upload failed, please try again."
        }), {
            status: isInvalidPath ? 400 : 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function handleMultipartWebUpload(request, bucket) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const path = formData.get('path') || '';
        const useRandomName = formData.get('randomName') === 'true';

        if (!file) {
            return new Response(JSON.stringify({
                success: false,
                message: "No file provided"
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const fileBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(fileBuffer);
        const detectedType = detectImageType(uint8Array);
        const contentType = detectedType?.mime || file.type || 'application/octet-stream';
        const fileName = buildStoredFileName(file.name, detectedType, contentType, useRandomName);
        const normalizedPath = normalizeR2Prefix(path);

        let key = fileName;
        if (normalizedPath) {
            key = `${normalizedPath}${key}`;
        }

        if (!useRandomName) {
            key = await buildUniqueR2Key(bucket, key);
        }

        const storedFileName = key.split('/').pop() || fileName;
        const safeContentType = resolveSafeUploadContentType(storedFileName, contentType);
        const fileTypeInfo = getFileTypeInfo(storedFileName, safeContentType);

        await bucket.put(key, fileBuffer, {
            httpMetadata: buildUploadHttpMetadata(storedFileName, contentType)
        });

        const fileUrl = buildObjectUrl(R2_PUBLIC_BASE_URL, key);

        return new Response(JSON.stringify({
            success: true,
            url: fileUrl,
            markdown: buildMarkdownLink(storedFileName, fileUrl, fileTypeInfo.isImage),
            isImage: fileTypeInfo.isImage,
            key
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Multipart upload failed:', error);
        const isInvalidPath = error.message === 'Invalid path';
        return new Response(JSON.stringify({
            success: false,
            message: isInvalidPath ? 'Invalid path' : "File upload failed, please try again."
        }), {
            status: isInvalidPath ? 400 : 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function handleCreateR2MultipartUpload(request, bucket) {
    try {
        const body = await request.json();
        const uploadTarget = await buildUploadTarget(bucket, {
            fileName: body.filename || '',
            path: body.path || '',
            contentType: body.contentType || '',
            useRandomName: body.randomName === true || body.randomName === 'true'
        });

        const multipartUpload = await bucket.createMultipartUpload(uploadTarget.key, {
            httpMetadata: buildUploadHttpMetadata(uploadTarget.fileName, uploadTarget.contentType)
        });

        return new Response(JSON.stringify({
            success: true,
            key: uploadTarget.key,
            uploadId: multipartUpload.uploadId,
            contentType: uploadTarget.contentType,
            fileName: uploadTarget.fileName,
            isImage: uploadTarget.fileTypeInfo.isImage
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Create multipart upload failed:', error);
        const isInvalidPath = error.message === 'Invalid path';
        return new Response(JSON.stringify({
            success: false,
            message: isInvalidPath ? 'Invalid path' : 'Failed to create multipart upload'
        }), {
            status: isInvalidPath ? 400 : 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function handleUploadR2MultipartPart(request, bucket) {
    try {
        const url = new URL(request.url);
        const key = url.searchParams.get('key') || '';
        const uploadId = url.searchParams.get('uploadId') || '';
        const partNumber = parseInt(url.searchParams.get('partNumber') || '', 10);

        if (!key || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || !request.body) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid multipart part request'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const multipartUpload = bucket.resumeMultipartUpload(key, uploadId);
        const part = await multipartUpload.uploadPart(partNumber, request.body);

        return new Response(JSON.stringify({
            success: true,
            part
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Upload multipart part failed:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Failed to upload multipart part'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function handleCompleteR2MultipartUpload(request, bucket) {
    try {
        const body = await request.json();
        const key = body.key || '';
        const uploadId = body.uploadId || '';
        const parts = Array.isArray(body.parts) ? body.parts : [];

        if (!key || !uploadId || parts.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid multipart complete request'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const multipartUpload = bucket.resumeMultipartUpload(key, uploadId);
        const completedObject = await multipartUpload.complete(
            parts
                .map(part => ({ partNumber: part.partNumber, etag: part.etag }))
                .sort((a, b) => a.partNumber - b.partNumber)
        );

        const storedFileName = key.split('/').pop() || key;
        const contentType = resolveSafeUploadContentType(storedFileName, body.contentType || completedObject.httpMetadata?.contentType || '');
        const fileTypeInfo = getFileTypeInfo(storedFileName, contentType);
        const fileUrl = buildObjectUrl(R2_PUBLIC_BASE_URL, key);

        return new Response(JSON.stringify({
            success: true,
            url: fileUrl,
            markdown: buildMarkdownLink(storedFileName, fileUrl, fileTypeInfo.isImage),
            isImage: fileTypeInfo.isImage,
            key
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Complete multipart upload failed:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Failed to complete multipart upload'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function handleAbortR2MultipartUpload(request, bucket) {
    try {
        const body = await request.json();
        const key = body.key || '';
        const uploadId = body.uploadId || '';

        if (!key || !uploadId) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid multipart abort request'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const multipartUpload = bucket.resumeMultipartUpload(key, uploadId);
        await multipartUpload.abort();

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Abort multipart upload failed:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Failed to abort multipart upload'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * 列出R2存储桶中的文件和目录（管理页面使用）
 * @param {Request} request - 传入的请求
 * @param {R2Bucket} bucket - R2存储桶实例
 * @returns {Promise<Response>} - 包含文件和目录列表的JSON响应
 */
export async function handleListFiles(request, bucket) {
    // 身份验证已由中间件处理
    return listR2Files(request, bucket);
}

/**
 * 从R2存储桶中删除文件
 * @param {Request} request - 包含要删除文件键(keys)数组的请求
 * @param {R2Bucket} bucket - R2存储桶实例
 * @returns {Promise<Response>} - 包含删除结果的JSON响应
 */
export async function handleDeleteFiles(request, bucket) {
    try {
        const body = await request.json();
        const items = Array.isArray(body.items)
            ? body.items
            : (Array.isArray(body.keys) ? body.keys.map(key => ({ type: 'file', key })) : []);

        if (items.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                message: "No valid items provided for deletion"
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const keysToDelete = new Set();
        for (const item of items) {
            const normalizedItem = typeof item === 'string' ? { type: 'file', key: item } : item;

            if (normalizedItem.type === 'file') {
                if (!normalizedItem.key || typeof normalizedItem.key !== 'string') {
                    return new Response(JSON.stringify({
                        success: false,
                        message: "Invalid file key"
                    }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                keysToDelete.add(normalizedItem.key);
                continue;
            }

            if (normalizedItem.type === 'directory') {
                if (!normalizedItem.path || typeof normalizedItem.path !== 'string' || normalizedItem.path === '/') {
                    return new Response(JSON.stringify({
                        success: false,
                        message: "Invalid directory path"
                    }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                let prefix = '';
                try {
                    prefix = normalizeR2Prefix(normalizedItem.path);
                } catch {
                    return new Response(JSON.stringify({
                        success: false,
                        message: "Invalid directory path"
                    }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                if (!prefix) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: "Invalid directory path"
                    }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                let cursor = undefined;
                while (true) {
                    const listResult = await bucket.list({
                        prefix,
                        cursor,
                        limit: 1000
                    });

                    for (const object of listResult.objects || []) {
                        keysToDelete.add(object.key);
                    }

                    if (!listResult.truncated) break;
                    cursor = listResult.cursor;
                }

                keysToDelete.add(prefix);
                keysToDelete.add(`${prefix}.null`);
                continue;
            }

            return new Response(JSON.stringify({
                success: false,
                message: "Invalid deletion item type"
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const deletedKeys = Array.from(keysToDelete);
        for (let i = 0; i < deletedKeys.length; i += 100) {
            const batch = deletedKeys.slice(i, i + 100);
            await Promise.all(batch.map(key => bucket.delete(key)));
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Successfully deleted ${items.length} item(s)`,
            deletedCount: deletedKeys.length
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Delete files error:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Failed to delete files'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * 在R2存储桶中创建文件夹
 * @param {Request} request - 包含文件夹路径(path)的请求
 * @param {R2Bucket} bucket - R2存储桶实例
 * @returns {Promise<Response>} - 包含创建结果的JSON响应
 */
export async function handleCreateFolder(request, bucket) {
    try {
        const body = await request.json();
        let folderPath = normalizeR2Prefix(body.path);

        if (!folderPath) {
            return new Response(JSON.stringify({
                success: false,
                message: "Folder path is required"
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        // R2/S3 没有真正的目录；写入以 / 结尾的零字节对象作为空目录标记。
        await bucket.put(folderPath, new Uint8Array(0), {
            httpMetadata: {
                contentType: 'application/x-directory'
            }
        });

        return new Response(JSON.stringify({
            success: true,
            message: "Folder created successfully",
            path: folderPath
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Create folder error:', error);
        const isInvalidPath = error.message === 'Invalid path';
        return new Response(JSON.stringify({
            success: false,
            message: isInvalidPath ? 'Invalid path' : 'Failed to create folder'
        }), {
            status: isInvalidPath ? 400 : 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// --- 新增分享功能处理函数 ---

/**
 * 处理创建新的分享链接的请求
 * @param {Request} request 传入的请求
 * @param {object} env 环境变量
 * @returns {Promise<Response>}
 */
export async function handleCreateShare(request, env) {
    try {
        const { path } = await request.json();
        // 路径是必需的，但根路径 "" 是有效的
        if (path === undefined || path === null) {
            return new Response(JSON.stringify({ success: false, message: 'Path is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const normalizedPath = normalizeR2Prefix(path);
        const shareId = generateRandomString(16);
        await env.SHARES_KV.put(shareKvKey(shareId), JSON.stringify({ path: normalizedPath }));

        const shareUrl = `${new URL(request.url).origin}/s/${shareId}`;

        return new Response(JSON.stringify({ success: true, shareId, path: normalizedPath, url: shareUrl }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Create share error:', error);
        const isInvalidPath = error.message === 'Invalid path';
        return new Response(JSON.stringify({ success: false, message: isInvalidPath ? 'Invalid path' : 'Failed to create share link' }), { status: isInvalidPath ? 400 : 500, headers: { 'Content-Type': 'application/json' } });
    }
}

/**
 * 处理列出所有分享链接的请求
 * @param {Request} request 传入的请求
 * @param {object} env 环境变量
 * @returns {Promise<Response>}
 */
export async function handleListShares(request, env) {
    try {
        const listResult = await env.SHARES_KV.list();
        const sharesById = new Map();

        for (const key of listResult.keys) {
            try {
                const shareId = key.name.startsWith(SHARE_KV_PREFIX)
                    ? key.name.slice(SHARE_KV_PREFIX.length)
                    : key.name;

                if (!isValidShareId(shareId)) {
                    continue;
                }

                const value = await env.SHARES_KV.get(key.name, 'json');
                // 确保 value 不是 null 并且有 path 属性
                if (value && typeof value.path !== 'undefined') {
                    const normalizedPath = normalizeR2Prefix(value.path || '');
                    if (!key.name.startsWith(SHARE_KV_PREFIX)) {
                        const existingValue = await env.SHARES_KV.get(shareKvKey(shareId), 'json');
                        if (existingValue && typeof existingValue.path !== 'undefined') {
                            await env.SHARES_KV.delete(key.name);
                            sharesById.set(shareId, {
                                shareId,
                                path: normalizeR2Prefix(existingValue.path || ''),
                                url: `${new URL(request.url).origin}/s/${shareId}`
                            });
                            continue;
                        }

                        await env.SHARES_KV.put(shareKvKey(shareId), JSON.stringify({ path: normalizedPath }));
                        await env.SHARES_KV.delete(key.name);
                    }

                    sharesById.set(shareId, {
                        shareId,
                        path: normalizedPath,
                        url: `${new URL(request.url).origin}/s/${shareId}`
                    });
                } else {
                    console.log(`Skipping malformed or null share key: ${key.name}`);
                }
            } catch (e) {
                console.error(`Error parsing JSON for share key ${key.name}:`, e);
            }
        }

        // 注意: 这个实现没有处理分页 (cursor). 如果分享链接超过1000个, 需要添加分页逻辑.
        const shares = Array.from(sharesById.values());
        return new Response(JSON.stringify({ success: true, shares }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('List shares error:', error);
        return new Response(JSON.stringify({ success: false, message: 'Failed to list share links' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

/**
 * 处理删除分享链接的请求
 * @param {Request} request 传入的请求
 * @param {object} env 环境变量
 * @returns {Promise<Response>}
 */
export async function handleDeleteShare(request, env) {
    try {
        const { shareId } = await request.json();
        if (!isValidShareId(shareId)) {
            return new Response(JSON.stringify({ success: false, message: 'shareId is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        await env.SHARES_KV.delete(shareKvKey(shareId));
        await env.SHARES_KV.delete(shareId);
        return new Response(JSON.stringify({ success: true, message: 'Share link deleted' }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Delete share error:', error);
        return new Response(JSON.stringify({ success: false, message: 'Failed to delete share link' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

/**
 * 列出公共分享链接中的文件和目录
 * @param {Request} request 传入的请求
 * @param {object} env 环境变量
 * @param {object} params URL参数, e.g., { shareId }
 * @returns {Promise<Response>}
 */
export async function handleListSharedFiles(request, env, params) {
    try {
        const { shareId } = params;
        const shareData = await getShareData(env, shareId);

        if (!shareData) {
            return new Response(JSON.stringify({ success: false, message: 'Share link not found or expired' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        const url = new URL(request.url);
        const sharePrefix = normalizeR2Prefix(shareData.path || '');
        const requestPrefix = normalizeR2Prefix(url.searchParams.get('prefix') || '');
        const fullPrefix = `${sharePrefix}${requestPrefix}`;

        return listR2Files(request, env.BUCKET_R2, fullPrefix);
    } catch (error) {
        console.error('List shared files error:', error);
        const isInvalidPath = error.message === 'Invalid path';
        return new Response(JSON.stringify({ success: false, message: isInvalidPath ? 'Invalid path' : 'Failed to list files' }), { status: isInvalidPath ? 400 : 500, headers: { 'Content-Type': 'application/json' } });
    }
}

async function getShareData(env, shareId) {
    const namespacedKey = shareKvKey(shareId);
    const shareData = await env.SHARES_KV.get(namespacedKey, 'json');
    if (shareData) return shareData;

    const legacyShareData = await env.SHARES_KV.get(shareId, 'json');
    if (!legacyShareData || typeof legacyShareData.path === 'undefined') {
        return legacyShareData;
    }

    const normalizedPath = normalizeR2Prefix(legacyShareData.path || '');
    const migratedShareData = { path: normalizedPath };
    await env.SHARES_KV.put(namespacedKey, JSON.stringify(migratedShareData));
    await env.SHARES_KV.delete(shareId);
    return migratedShareData;
}

const RENAME_CONCURRENCY = 8;
const MAX_R2_KEY_BYTES = 1024;

class RenameError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function renameJsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function normalizeRenameName(value) {
    if (typeof value !== 'string') {
        throw new RenameError(400, '请输入新名称');
    }

    const name = value.trim();
    if (
        !name ||
        name === '.' ||
        name === '..' ||
        name === '.null' ||
        /[\/\\\u0000-\u001f\u007f]/.test(name)
    ) {
        throw new RenameError(400, '名称不能为空，也不能包含斜杠或控制字符');
    }

    return name;
}

function assertR2KeyLength(key) {
    if (new TextEncoder().encode(key).length > MAX_R2_KEY_BYTES) {
        throw new RenameError(400, '新名称过长');
    }
}

function normalizeRenameFileKey(key) {
    if (
        typeof key !== 'string' ||
        !key ||
        key.endsWith('/') ||
        key.startsWith('/') ||
        /[\\\u0000-\u001f\u007f]/.test(key)
    ) {
        throw new RenameError(400, '无效的源文件');
    }

    const slashIndex = key.lastIndexOf('/');
    const parentPrefix = slashIndex >= 0 ? key.substring(0, slashIndex + 1) : '';
    const fileName = slashIndex >= 0 ? key.substring(slashIndex + 1) : key;

    if (!fileName || fileName === '.null') {
        throw new RenameError(400, '该项目不能重命名');
    }

    try {
        if (normalizeR2Prefix(parentPrefix) !== parentPrefix) {
            throw new Error('Invalid path');
        }
    } catch {
        throw new RenameError(400, '无效的源文件');
    }

    return { key, parentPrefix, fileName };
}

function normalizeRenameDirectoryPath(path) {
    let prefix = '';
    try {
        prefix = normalizeR2Prefix(path);
    } catch {
        throw new RenameError(400, '无效的源文件夹');
    }

    if (!prefix) {
        throw new RenameError(400, '根目录不能重命名');
    }

    const withoutSlash = prefix.slice(0, -1);
    const slashIndex = withoutSlash.lastIndexOf('/');
    return {
        prefix,
        parentPrefix: slashIndex >= 0 ? withoutSlash.substring(0, slashIndex + 1) : '',
        name: slashIndex >= 0 ? withoutSlash.substring(slashIndex + 1) : withoutSlash
    };
}

async function listAllObjects(bucket, prefix) {
    const objects = [];
    let cursor = undefined;

    while (true) {
        const result = await bucket.list({ prefix, cursor, limit: 1000 });
        objects.push(...(result.objects || []));
        if (!result.truncated) break;
        cursor = result.cursor;
    }

    return objects;
}

async function targetNameExists(bucket, baseKey) {
    if (await bucket.head(baseKey)) return true;
    const directoryPrefix = `${baseKey}/`;
    const result = await bucket.list({ prefix: directoryPrefix, limit: 1 });
    return (result.objects || []).length > 0;
}

async function runRenameTasks(tasks, worker) {
    const results = new Array(tasks.length);
    let nextIndex = 0;
    const workers = Array.from(
        { length: Math.min(RENAME_CONCURRENCY, Math.max(tasks.length, 1)) },
        async () => {
            while (nextIndex < tasks.length) {
                const index = nextIndex++;
                try {
                    await worker(tasks[index]);
                    results[index] = { success: true };
                } catch (error) {
                    results[index] = { success: false, error };
                }
            }
        }
    );
    await Promise.all(workers);
    return results;
}

function buildRenamedHttpMetadata(currentMetadata, newName) {
    const existing = { ...(currentMetadata || {}) };
    const safeMetadata = buildUploadHttpMetadata(newName, existing.contentType || '');
    const nextMetadata = { ...existing, ...safeMetadata };
    if (!safeMetadata.contentDisposition) delete nextMetadata.contentDisposition;
    return nextMetadata;
}

async function copyRenameTask(bucket, task) {
    const object = await bucket.get(task.source);
    if (object === null) {
        throw new Error(`Source not found: ${task.source}`);
    }

    task.sourceHttpMetadata = { ...(object.httpMetadata || {}) };
    task.sourceCustomMetadata = { ...(object.customMetadata || {}) };
    const httpMetadata = task.renameFileMetadata
        ? buildRenamedHttpMetadata(task.sourceHttpMetadata, task.newName)
        : task.sourceHttpMetadata;

    await bucket.put(task.destination, object.body, {
        httpMetadata,
        customMetadata: task.sourceCustomMetadata
    });
}

function getShareIdForKey(keyName) {
    const shareId = keyName.startsWith(SHARE_KV_PREFIX)
        ? keyName.slice(SHARE_KV_PREFIX.length)
        : keyName;
    return isValidShareId(shareId) ? shareId : '';
}

async function updateRenamedSharePaths(kv, sourcePrefix, destinationPrefix, changes) {
    const updatedShareIds = new Set();
    let cursor = undefined;

    while (true) {
        const result = await kv.list({ cursor, limit: 1000 });
        for (const key of result.keys || []) {
            const shareId = getShareIdForKey(key.name);
            if (!shareId) continue;

            const previous = await kv.get(key.name, 'json');
            if (!previous || typeof previous.path === 'undefined') continue;

            const previousPath = normalizeR2Prefix(previous.path || '');
            if (!previousPath.startsWith(sourcePrefix)) continue;

            const nextValue = {
                ...previous,
                path: `${destinationPrefix}${previousPath.substring(sourcePrefix.length)}`
            };
            await kv.put(key.name, JSON.stringify(nextValue));
            changes.push({ key: key.name, previous });
            updatedShareIds.add(shareId);
        }

        if (result.list_complete || !result.cursor) break;
        cursor = result.cursor;
    }

    return updatedShareIds.size;
}

async function rollbackShareChanges(kv, changes) {
    const errors = [];
    for (const change of changes.slice().reverse()) {
        try {
            await kv.put(change.key, JSON.stringify(change.previous));
        } catch (error) {
            errors.push(error);
        }
    }
    return errors;
}

async function deleteKeys(bucket, keys) {
    return runRenameTasks(keys, key => bucket.delete(key));
}

async function rollbackRename(env, copiedTasks, deletedTasks, shareChanges) {
    const rollbackErrors = [];

    if (deletedTasks.length > 0) {
        const restoreResults = await runRenameTasks(deletedTasks, async task => {
            const object = await env.BUCKET_R2.get(task.destination);
            if (object === null) throw new Error(`Rollback source missing: ${task.destination}`);
            await env.BUCKET_R2.put(task.source, object.body, {
                httpMetadata: task.sourceHttpMetadata,
                customMetadata: task.sourceCustomMetadata
            });
        });
        rollbackErrors.push(...restoreResults.filter(result => !result.success).map(result => result.error));
    }

    rollbackErrors.push(...await rollbackShareChanges(env.SHARES_KV, shareChanges));

    const safeDestinationKeys = [];
    for (const task of copiedTasks) {
        try {
            if (await env.BUCKET_R2.head(task.source)) safeDestinationKeys.push(task.destination);
        } catch (error) {
            rollbackErrors.push(error);
        }
    }
    const cleanupResults = await deleteKeys(env.BUCKET_R2, safeDestinationKeys);
    rollbackErrors.push(...cleanupResults.filter(result => !result.success).map(result => result.error));

    if (rollbackErrors.length > 0) {
        console.error('Rename rollback was incomplete:', rollbackErrors);
    }
}

/**
 * 重命名单个R2文件或文件夹，并保持文件夹分享链接有效。
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<Response>}
 */
export async function handleRenameItem(request, env) {
    const copiedTasks = [];
    const deletedTasks = [];
    const shareChanges = [];

    try {
        let body;
        try {
            body = await request.json();
        } catch {
            throw new RenameError(400, '无效的请求内容');
        }

        const sourceItem = body?.sourceItem;
        const newName = normalizeRenameName(body?.newName);
        if (!sourceItem || !['file', 'directory'].includes(sourceItem.type)) {
            throw new RenameError(400, '请选择一个要重命名的项目');
        }

        let sourceIdentifier;
        let destinationIdentifier;
        let destinationBaseKey;
        let tasks;
        let responseItem;
        let shareSourcePrefix = '';
        let shareDestinationPrefix = '';

        if (sourceItem.type === 'file') {
            const source = normalizeRenameFileKey(sourceItem.key);
            sourceIdentifier = source.key;
            destinationIdentifier = `${source.parentPrefix}${newName}`;
            destinationBaseKey = destinationIdentifier;
            assertR2KeyLength(destinationIdentifier);

            if (!await env.BUCKET_R2.head(source.key)) {
                throw new RenameError(404, '源文件不存在');
            }
            if (destinationIdentifier === source.key) {
                return renameJsonResponse({
                    success: true,
                    message: '名称未变更',
                    item: { type: 'file', key: source.key },
                    affectedObjects: 0,
                    updatedShares: 0,
                    skipped: true
                });
            }

            tasks = [{
                source: source.key,
                destination: destinationIdentifier,
                renameFileMetadata: true,
                newName
            }];
            responseItem = { type: 'file', key: destinationIdentifier };
        } else {
            const source = normalizeRenameDirectoryPath(sourceItem.path);
            sourceIdentifier = source.prefix;
            destinationIdentifier = `${source.parentPrefix}${newName}/`;
            destinationBaseKey = destinationIdentifier.slice(0, -1);
            assertR2KeyLength(destinationIdentifier);

            const sourceObjects = await listAllObjects(env.BUCKET_R2, source.prefix);
            if (sourceObjects.length === 0) {
                throw new RenameError(404, '源文件夹不存在');
            }
            if (destinationIdentifier === source.prefix) {
                return renameJsonResponse({
                    success: true,
                    message: '名称未变更',
                    item: { type: 'directory', path: source.prefix },
                    affectedObjects: 0,
                    updatedShares: 0,
                    skipped: true
                });
            }

            tasks = sourceObjects.map(object => {
                const destination = `${destinationIdentifier}${object.key.substring(source.prefix.length)}`;
                assertR2KeyLength(destination);
                return { source: object.key, destination };
            });
            responseItem = { type: 'directory', path: destinationIdentifier };
            shareSourcePrefix = source.prefix;
            shareDestinationPrefix = destinationIdentifier;
        }

        if (await targetNameExists(env.BUCKET_R2, destinationBaseKey)) {
            throw new RenameError(409, '同一目录下已存在同名文件或文件夹');
        }

        const copyResults = await runRenameTasks(tasks, async task => {
            await copyRenameTask(env.BUCKET_R2, task);
            copiedTasks.push(task);
        });
        if (copyResults.some(result => !result.success)) {
            await rollbackRename(env, copiedTasks, [], []);
            throw new RenameError(500, '重命名失败，原项目已保留');
        }

        let updatedShares = 0;
        if (sourceItem.type === 'directory') {
            try {
                updatedShares = await updateRenamedSharePaths(
                    env.SHARES_KV,
                    shareSourcePrefix,
                    shareDestinationPrefix,
                    shareChanges
                );
            } catch (error) {
                await rollbackRename(env, copiedTasks, [], shareChanges);
                throw new RenameError(500, '无法更新文件夹分享链接，重命名已取消');
            }
        }

        const deleteResults = await runRenameTasks(tasks, async task => {
            await env.BUCKET_R2.delete(task.source);
            deletedTasks.push(task);
        });
        if (deleteResults.some(result => !result.success)) {
            await rollbackRename(env, copiedTasks, deletedTasks, shareChanges);
            throw new RenameError(500, '无法删除旧项目，重命名已取消');
        }

        return renameJsonResponse({
            success: true,
            message: sourceItem.type === 'directory' ? '文件夹重命名成功' : '文件重命名成功',
            item: responseItem,
            source: sourceIdentifier,
            destination: destinationIdentifier,
            affectedObjects: tasks.length,
            updatedShares
        });
    } catch (error) {
        if (error instanceof RenameError) {
            return renameJsonResponse({ success: false, message: error.message }, error.status);
        }
        console.error('Rename item error:', error);
        return renameJsonResponse({ success: false, message: '重命名失败，请稍后重试' }, 500);
    }
}

/**
 * 处理文件操作，如移动或复制
 * @param {Request} request 传入的请求
 * @param {R2Bucket} bucket R2存储桶实例
 * @returns {Promise<Response>}
 */
export async function handleFileAction(request, bucket) {
    try {
        const body = await request.json();
        const { action, sourceKeys, sourceDirectories, destinationPrefix } = body;

        if (!['move', 'copy'].includes(action)) {
            return new Response(JSON.stringify({ success: false, message: "Invalid action" }), { status: 400 });
        }
        if (typeof destinationPrefix !== 'string') {
            return new Response(JSON.stringify({ success: false, message: "Invalid destination" }), { status: 400 });
        }

        let destinationParentPrefix = '';
        try {
            destinationParentPrefix = normalizeR2Prefix(destinationPrefix);
        } catch {
            return new Response(JSON.stringify({ success: false, message: "Invalid destination" }), { status: 400 });
        }

        const ACTION_CONCURRENCY = 8;
        const sourceItems = Array.isArray(body.sourceItems)
            ? body.sourceItems
            : [
                ...(Array.isArray(sourceKeys) ? sourceKeys.map(key => ({ type: 'file', key })) : []),
                ...(Array.isArray(sourceDirectories) ? sourceDirectories.map(path => ({ type: 'directory', path })) : [])
            ];
        const actionTasks = [];
        const skippedResults = [];

        if (sourceItems.length === 0) {
            return new Response(JSON.stringify({ success: false, message: "No source items specified" }), { status: 400 });
        }

        function normalizeDirectoryPath(path) {
            try {
                return normalizeR2Prefix(path);
            } catch {
                return '';
            }
        }

        function getDirectoryName(path) {
            const normalizedPath = normalizeDirectoryPath(path);
            return normalizedPath.replace(/\/$/, '').split('/').pop() || '';
        }

        async function addDirectoryTasks(sourcePath) {
            const sourcePrefix = normalizeDirectoryPath(sourcePath);
            if (!sourcePrefix) {
                return { source: sourcePath, status: 'error', error: 'Invalid directory path' };
            }

            if (destinationParentPrefix === sourcePrefix || destinationParentPrefix.startsWith(sourcePrefix)) {
                return { source: sourcePrefix, status: 'error', error: 'Cannot move or copy a folder into itself' };
            }

            const folderName = getDirectoryName(sourcePrefix);
            const destinationFolderPrefix = `${destinationParentPrefix}${folderName}/`;
            if (destinationFolderPrefix === sourcePrefix) {
                return { source: sourcePrefix, destination: destinationFolderPrefix, status: 'success', skipped: true };
            }

            let cursor = undefined;
            let foundObjects = 0;
            while (true) {
                const listResult = await bucket.list({
                    prefix: sourcePrefix,
                    cursor,
                    limit: 1000
                });

                for (const object of listResult.objects || []) {
                    foundObjects += 1;
                    actionTasks.push({
                        source: object.key,
                        destination: `${destinationFolderPrefix}${object.key.substring(sourcePrefix.length)}`,
                        sourceDirectory: sourcePrefix
                    });
                }

                if (!listResult.truncated) break;
                cursor = listResult.cursor;
            }

            if (foundObjects === 0) {
                actionTasks.push({
                    source: sourcePrefix,
                    destination: destinationFolderPrefix,
                    sourceDirectory: sourcePrefix,
                    createDirectoryMarker: true
                });
            }

            return null;
        }

        for (const item of sourceItems) {
            const normalizedItem = typeof item === 'string' ? { type: 'file', key: item } : item;

            if (normalizedItem.type === 'file') {
                if (!normalizedItem.key || typeof normalizedItem.key !== 'string') {
                    return new Response(JSON.stringify({ success: false, message: "Invalid source file" }), { status: 400 });
                }

                const fileName = normalizedItem.key.split('/').pop();
                const destinationKey = `${destinationParentPrefix}${fileName}`;
                if (destinationKey === normalizedItem.key) {
                    skippedResults.push({
                        source: normalizedItem.key,
                        destination: destinationKey,
                        status: 'success',
                        skipped: true
                    });
                } else {
                    actionTasks.push({
                        source: normalizedItem.key,
                        destination: destinationKey
                    });
                }
                continue;
            }

            if (normalizedItem.type === 'directory') {
                const directoryResult = await addDirectoryTasks(normalizedItem.path);
                if (directoryResult?.status === 'error') {
                    return new Response(JSON.stringify({
                        success: false,
                        message: directoryResult.error,
                        results: [directoryResult]
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                if (directoryResult?.skipped) skippedResults.push(directoryResult);
                continue;
            }

            return new Response(JSON.stringify({ success: false, message: "Invalid source item type" }), { status: 400 });
        }

        const results = new Array(actionTasks.length);
        let nextIndex = 0;

        const performAction = async (task) => {
            if (!task.source || !task.destination) {
                return { source: task.source, status: 'error', error: 'Invalid source item' };
            }

            if (task.destination === task.source) {
                return { source: task.source, destination: task.destination, status: 'success', skipped: true };
            }

            try {
                if (task.createDirectoryMarker) {
                    await bucket.put(task.destination, new Uint8Array(0), {
                        httpMetadata: { contentType: 'application/x-directory' }
                    });
                    return { source: task.source, destination: task.destination, status: 'success' };
                }

                const object = await bucket.get(task.source);
                if (object === null) {
                    return { source: task.source, status: 'error', error: 'Source not found' };
                }

                await bucket.put(task.destination, object.body, {
                    httpMetadata: object.httpMetadata,
                    customMetadata: object.customMetadata,
                });

                if (action === 'move') {
                    await bucket.delete(task.source);
                }
                return {
                    source: task.source,
                    destination: task.destination,
                    sourceDirectory: task.sourceDirectory,
                    status: 'success'
                };
            } catch (e) {
                return { source: task.source, status: 'error', error: e.message };
            }
        };

        const workers = Array.from({ length: Math.min(ACTION_CONCURRENCY, Math.max(actionTasks.length, 1)) }, async () => {
            while (nextIndex < actionTasks.length) {
                const currentIndex = nextIndex++;
                results[currentIndex] = await performAction(actionTasks[currentIndex]);
            }
        });

        await Promise.all(workers);

        const allResults = [...skippedResults, ...results.filter(Boolean)];
        const successCount = allResults.filter(r => r.status === 'success').length;
        const actionText = action === 'move' ? '移动' : '复制';

        return new Response(JSON.stringify({
            success: true,
            message: `成功${actionText} ${successCount} 个项目`,
            results: allResults,
        }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('File action error:', error);
        return new Response(JSON.stringify({ success: false, message: 'Failed to perform file action' }), { status: 500 });
    }
}

/**
 * 列出R2存储桶中所有的目录
 * @param {Request} request 传入的请求
 * @param {R2Bucket} bucket R2存储桶实例
 * @returns {Promise<Response>}
 */
export async function handleListDirectories(request, bucket) {
    try {
        const directorySet = new Set();

        async function fetchDirectories(prefix = '') {
            let cursor = undefined;
            while (true) {
                const listResult = await bucket.list({
                    prefix: prefix,
                    delimiter: '/',
                    cursor: cursor,
                    limit: 1000
                });

                for (const dir of listResult.delimitedPrefixes) {
                    if (!directorySet.has(dir)) {
                        directorySet.add(dir);
                        await fetchDirectories(dir); // 递归获取子目录
                    }
                }

                if (!listResult.truncated) {
                    break;
                }
                cursor = listResult.cursor;
            }
        }

        await fetchDirectories();

        const directories = Array.from(directorySet).map(path => {
            const parts = path.replace(/\/$/, '').split('/');
            const name = parts.pop() || '';
            const parent = parts.length > 0 ? parts.join('/') + '/' : '/';
            return { name, path, parent };
        }).sort((a, b) => a.path.localeCompare(b.path));

        return new Response(JSON.stringify({
            success: true,
            directories,
        }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('List directories error:', error);
        return new Response(JSON.stringify({ success: false, message: 'Failed to list directories' }), { status: 500 });
    }
}
