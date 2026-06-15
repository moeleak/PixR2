import { FILE_CACHE_CONTROL, R2_PUBLIC_BASE_URL } from '../config.js';
import {
    buildMarkdownLink,
    buildObjectUrl,
    buildStoredFileName,
    buildUniqueR2Key,
    buildUploadTarget,
    detectImageType,
    generateRandomString,
    getFileTypeInfo,
    listR2Files,
    resolveUploadContentType,
} from '../utils/files.js';

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
            httpMetadata: {
                contentType: uploadTarget.contentType,
                cacheControl: FILE_CACHE_CONTROL
            }
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
        return new Response(JSON.stringify({
            success: false,
            message: "File upload failed, please try again."
        }), {
            status: 500,
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

        let key = fileName;
        if (path) {
            const formattedPath = path.endsWith('/') ? path : `${path}/`;
            key = `${formattedPath}${key}`;
        }

        if (!useRandomName) {
            key = await buildUniqueR2Key(bucket, key);
        }

        const storedFileName = key.split('/').pop() || fileName;
        const fileTypeInfo = getFileTypeInfo(storedFileName, contentType);

        await bucket.put(key, fileBuffer, {
            httpMetadata: {
                contentType,
                cacheControl: FILE_CACHE_CONTROL
            }
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
        return new Response(JSON.stringify({
            success: false,
            message: "File upload failed, please try again."
        }), {
            status: 500,
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
            httpMetadata: {
                contentType: uploadTarget.contentType,
                cacheControl: FILE_CACHE_CONTROL
            }
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
        return new Response(JSON.stringify({
            success: false,
            message: 'Failed to create multipart upload'
        }), {
            status: 500,
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
        const contentType = resolveUploadContentType(storedFileName, body.contentType || completedObject.httpMetadata?.contentType || '');
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

                const prefix = normalizedItem.path.endsWith('/') ? normalizedItem.path : `${normalizedItem.path}/`;
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
        let folderPath = body.path;

        if (!folderPath) {
            return new Response(JSON.stringify({
                success: false,
                message: "Folder path is required"
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 确保文件夹路径以斜杠结尾
        if (!folderPath.endsWith('/')) {
            folderPath += '/';
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
        return new Response(JSON.stringify({
            success: false,
            message: 'Failed to create folder'
        }), {
            status: 500,
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

        const shareId = generateRandomString(16);
        await env.SHARES_KV.put(shareId, JSON.stringify({ path }));

        const shareUrl = `${new URL(request.url).origin}/s/${shareId}`;

        return new Response(JSON.stringify({ success: true, shareId, path, url: shareUrl }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Create share error:', error);
        return new Response(JSON.stringify({ success: false, message: 'Failed to create share link' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
        const shares = [];

        for (const key of listResult.keys) {
            try {
                const value = await env.SHARES_KV.get(key.name, 'json');
                // 确保 value 不是 null 并且有 path 属性
                if (value && typeof value.path !== 'undefined') {
                    shares.push({
                        shareId: key.name,
                        path: value.path,
                        url: `${new URL(request.url).origin}/s/${key.name}`
                    });
                } else {
                    console.log(`Skipping malformed or null share key: ${key.name}`);
                }
            } catch (e) {
                console.error(`Error parsing JSON for share key ${key.name}:`, e);
            }
        }

        // 注意: 这个实现没有处理分页 (cursor). 如果分享链接超过1000个, 需要添加分页逻辑.
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
        if (!shareId) {
            return new Response(JSON.stringify({ success: false, message: 'shareId is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
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
        const shareData = await env.SHARES_KV.get(shareId, 'json');

        if (!shareData) {
            return new Response(JSON.stringify({ success: false, message: 'Share link not found or expired' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        const url = new URL(request.url);
        const requestPrefix = url.searchParams.get('prefix') || '';
        const fullPrefix = shareData.path + requestPrefix;

        return listR2Files(request, env.BUCKET_R2, fullPrefix);
    } catch (error) {
        console.error('List shared files error:', error);
        return new Response(JSON.stringify({ success: false, message: 'Failed to list files' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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

        const ACTION_CONCURRENCY = 8;
        const destinationParentPrefix = destinationPrefix === '/'
            ? ''
            : (destinationPrefix.endsWith('/') ? destinationPrefix : `${destinationPrefix}/`);
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
            if (typeof path !== 'string' || !path || path === '/') return '';
            return path.endsWith('/') ? path : `${path}/`;
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
