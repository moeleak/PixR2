import { FILE_CACHE_CONTROL, IMAGE_EXTENSIONS, MIME_EXTENSION_MAP, R2_PUBLIC_BASE_URL } from '../config.js';

export function buildObjectUrl(baseUrl, key) {
    return `${baseUrl.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * 根据文件内容的字节签名检测图片类型
 * @param {Uint8Array} uint8Array - 图片文件的字节数组
 * @returns {{mime: string, ext: string}|null} - 如果是支持的图片类型，返回MIME类型和扩展名，否则返回null
 */
export function detectImageType(uint8Array) {
    // 检查JPEG签名 (FF D8 FF)
    if (uint8Array.length >= 3 &&
        uint8Array[0] === 0xFF &&
        uint8Array[1] === 0xD8 &&
        uint8Array[2] === 0xFF) {
        return { mime: 'image/jpeg', ext: 'jpg' };
    }

    // 检查PNG签名 (89 50 4E 47 0D 0A 1A 0A)
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    if (uint8Array.length >= pngSignature.length) {
        const isPng = pngSignature.every(
            (byte, index) => uint8Array[index] === byte
        );
        if (isPng) return { mime: 'image/png', ext: 'png' };
    }

    // 检查GIF签名 (47 49 46 38)
    if (uint8Array.length >= 4 &&
        uint8Array[0] === 0x47 &&
        uint8Array[1] === 0x49 &&
        uint8Array[2] === 0x46 &&
        uint8Array[3] === 0x38) {
        return { mime: 'image/gif', ext: 'gif' };
    }

    // 检查WebP签名 (RIFF .... WEBP)
    if (uint8Array.length >= 12 &&
        uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x46 &&
        uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && uint8Array[10] === 0x42 && uint8Array[11] === 0x50) {
        return { mime: 'image/webp', ext: 'webp' };
    }

    return null;
}

export function getFileExtension(fileName = '') {
    const cleanName = fileName.split('?')[0].split('#')[0];
    const lastPart = cleanName.split('/').pop() || '';
    const dotIndex = lastPart.lastIndexOf('.');
    if (dotIndex <= 0 || dotIndex === lastPart.length - 1) return '';
    return lastPart.substring(dotIndex + 1).toLowerCase();
}

function stripFileExtension(fileName = '') {
    const lastPart = fileName.split('/').pop() || '';
    const dotIndex = lastPart.lastIndexOf('.');
    return dotIndex > 0 ? lastPart.substring(0, dotIndex) : lastPart;
}

function getFileNameFromUrl(url = '') {
    try {
        const parsedUrl = new URL(url);
        return decodeURIComponent(parsedUrl.pathname.split('/').pop() || '');
    } catch {
        return '';
    }
}

function sanitizeFileName(fileName = 'file') {
    const cleanName = fileName
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .replace(/[\\/:*?"<>|#%{}~`^]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
    return cleanName || 'file';
}

function getExtensionFromMime(mime = '') {
    const normalizedMime = mime.toLowerCase().split(';')[0].trim();
    if (MIME_EXTENSION_MAP[normalizedMime]) return MIME_EXTENSION_MAP[normalizedMime];
    if (normalizedMime.startsWith('image/')) return normalizedMime.substring(6).replace('jpeg', 'jpg');
    if (normalizedMime.startsWith('video/')) return normalizedMime.substring(6);
    if (normalizedMime.startsWith('audio/')) return normalizedMime.substring(6);
    if (normalizedMime.startsWith('text/')) return 'txt';
    return '';
}

function getMimeFromExtension(fileName = '') {
    const extension = getFileExtension(fileName);
    const extensionMimeMap = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        avif: 'image/avif',
        bmp: 'image/bmp',
        svg: 'image/svg+xml',
        pdf: 'application/pdf',
        zip: 'application/zip',
        '7z': 'application/x-7z-compressed',
        rar: 'application/x-rar-compressed',
        txt: 'text/plain',
        csv: 'text/csv',
        json: 'application/json',
        html: 'text/html',
        css: 'text/css',
        js: 'text/javascript',
        md: 'text/markdown',
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        flac: 'audio/flac',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    return extensionMimeMap[extension] || '';
}

export function getFileTypeInfo(fileName = '', mime = '') {
    const extension = getFileExtension(fileName);
    const normalizedMime = mime.toLowerCase().split(';')[0].trim();
    const isImage = normalizedMime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension);

    if (isImage) {
        return { isImage: true, category: 'image', iconClass: 'bi-file-earmark-image', label: '图片' };
    }
    if (extension === 'pdf' || normalizedMime === 'application/pdf') {
        return { isImage: false, category: 'pdf', iconClass: 'bi-file-earmark-pdf', label: 'PDF' };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
        return { isImage: false, category: 'archive', iconClass: 'bi-file-earmark-zip', label: '压缩包' };
    }
    if (normalizedMime.startsWith('video/') || ['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(extension)) {
        return { isImage: false, category: 'video', iconClass: 'bi-file-earmark-play', label: '视频' };
    }
    if (normalizedMime.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(extension)) {
        return { isImage: false, category: 'audio', iconClass: 'bi-file-earmark-music', label: '音频' };
    }
    if (['doc', 'docx', 'pages'].includes(extension)) {
        return { isImage: false, category: 'document', iconClass: 'bi-file-earmark-word', label: '文档' };
    }
    if (['xls', 'xlsx', 'csv', 'numbers'].includes(extension)) {
        return { isImage: false, category: 'spreadsheet', iconClass: 'bi-file-earmark-spreadsheet', label: '表格' };
    }
    if (['ppt', 'pptx', 'key'].includes(extension)) {
        return { isImage: false, category: 'presentation', iconClass: 'bi-file-earmark-slides', label: '演示文稿' };
    }
    if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'xml', 'md', 'py', 'go', 'rs', 'java', 'php', 'rb', 'sh'].includes(extension)) {
        return { isImage: false, category: 'code', iconClass: 'bi-file-earmark-code', label: '代码' };
    }
    if (normalizedMime.startsWith('text/') || ['txt', 'log'].includes(extension)) {
        return { isImage: false, category: 'text', iconClass: 'bi-file-earmark-text', label: '文本' };
    }
    return { isImage: false, category: 'file', iconClass: 'bi-file-earmark', label: extension ? extension.toUpperCase() : '文件' };
}

export function buildStoredFileName(originalName, detectedType, mime = '', useRandomName = true) {
    const date = new Date();
    const formattedDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const shortUUID = crypto.randomUUID().split('-')[0];
    const sourceName = sanitizeFileName(originalName || 'file');
    const baseName = sanitizeFileName(stripFileExtension(sourceName));
    const extension = detectedType?.ext || getFileExtension(sourceName) || getExtensionFromMime(mime) || 'bin';
    if (!useRandomName) return `${baseName}.${extension.toLowerCase()}`;
    return `${formattedDate}_${shortUUID}_${baseName}.${extension.toLowerCase()}`;
}

export async function buildUniqueR2Key(bucket, key) {
    if (!await bucket.head(key)) return key;

    const slashIndex = key.lastIndexOf('/');
    const prefix = slashIndex >= 0 ? key.substring(0, slashIndex + 1) : '';
    const fileName = slashIndex >= 0 ? key.substring(slashIndex + 1) : key;
    const dotIndex = fileName.lastIndexOf('.');
    const baseName = dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
    const extension = dotIndex > 0 ? fileName.substring(dotIndex) : '';

    for (let index = 1; index <= 100; index++) {
        const candidate = `${prefix}${baseName} (${index})${extension}`;
        if (!await bucket.head(candidate)) return candidate;
    }

    return `${prefix}${baseName}-${crypto.randomUUID().split('-')[0]}${extension}`;
}

export function buildMarkdownLink(fileName, url, isImage) {
    const label = sanitizeFileName(fileName || 'file').replace(/[\[\]]/g, '');
    return isImage ? `![${label}](${url})` : `[${label}](${url})`;
}

export function resolveUploadContentType(fileName = '', contentType = '') {
    const normalizedContentType = contentType.split(';')[0].trim();
    const inferredContentType = getMimeFromExtension(fileName);
    return !normalizedContentType || normalizedContentType === 'application/octet-stream'
        ? inferredContentType || 'application/octet-stream'
        : normalizedContentType;
}

export async function buildUploadTarget(bucket, { fileName: originalName = '', path = '', contentType = '', useRandomName = false }) {
    if (!originalName) throw new Error('No file provided');

    const resolvedContentType = resolveUploadContentType(originalName, contentType);
    const storedName = buildStoredFileName(originalName, null, resolvedContentType, useRandomName);
    let key = storedName;

    if (path) {
        const formattedPath = path.endsWith('/') ? path : `${path}/`;
        key = `${formattedPath}${key}`;
    }

    if (!useRandomName) {
        key = await buildUniqueR2Key(bucket, key);
    }

    const finalFileName = key.split('/').pop() || storedName;
    return {
        key,
        contentType: resolvedContentType,
        fileName: finalFileName,
        fileTypeInfo: getFileTypeInfo(finalFileName, resolvedContentType)
    };
}

export function escapeHtmlForTelegram(value = '') {
    const htmlEscapes = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return String(value).replace(/[&<>"']/g, char => htmlEscapes[char]);
}

/**
 * 处理来自Telegram的webhook请求
 * @param {Request} request - 传入的请求
 * @param {object} env - Cloudflare Workers的环境变量
 * @returns {Promise<Response>}

// --- 辅助函数 ---

/**
 * 从URL下载文件并上传到R2
 * @param {string} fileUrl - 要下载的文件URL
 * @param {R2Bucket} bucket - R2存储桶实例
 * @param {boolean} isDocument - 是否是作为文档发送的
 * @param {string} userPath - 用户指定的上传子路径
 * @param {string} originalName - 原始文件名
 * @param {string} mimeType - 已知 MIME 类型
 * @returns {Promise<object>} - 包含上传结果的对象
 */
export async function uploadFileToR2(fileUrl, bucket, isDocument = false, userPath = '', originalName = '', mimeType = '') {
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('下载文件失败');

        const buffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        const detectedType = detectImageType(uint8Array);
        const contentType = detectedType?.mime || mimeType || response.headers.get('Content-Type') || 'application/octet-stream';
        const fileName = buildStoredFileName(originalName || getFileNameFromUrl(fileUrl), detectedType, contentType);
        const fileTypeInfo = getFileTypeInfo(fileName, contentType);

        // 如果提供了用户路径，则构建完整的文件键
        let key = fileName;
        if (userPath) {
            // 确保路径格式正确（以斜杠结尾）
            const formattedPath = userPath.endsWith('/') ? userPath : `${userPath}/`;
            key = `${formattedPath}${key}`;
        }

        await bucket.put(key, buffer, {
            httpMetadata: {
                contentType,
                cacheControl: FILE_CACHE_CONTROL
            },
        });

        return { ok: true, key, fileName, isImage: fileTypeInfo.isImage };
    } catch (error) {
        console.error('上传失败:', error);
        return {
            ok: false,
            error: 'SERVER_ERROR',
            message: '文件上传失败，请稍后再试。'
        };
    }
}

/**
 * 生成指定长度的随机字符串
 * @param {number} length 字符串长度
 * @returns {string}
 */
export function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

/**
 * 通用的R2文件列表函数
 * @param {Request} request 传入的请求
 * @param {R2Bucket} bucket R2存储桶实例
 * @param {string|null} forcePrefix 强制使用的前缀，忽略URL参数
 * @returns {Promise<Response>}
 */
export async function listR2Files(request, bucket, forcePrefix = null) {
    try {
        const url = new URL(request.url);
        const prefix = forcePrefix !== null ? forcePrefix : (url.searchParams.get('prefix') || '');
        const delimiter = '/';

        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = parseInt(url.searchParams.get('pageSize') || '50', 10);

        const listResult = await bucket.list({
            prefix: prefix,
            delimiter: delimiter,
        });

        const directories = (listResult.delimitedPrefixes || []).map(delimitedPrefix => {
            const name = delimitedPrefix.substring(prefix.length).replace(/\/$/, '');
            return { name, path: delimitedPrefix, type: 'directory' };
        });

        const files = (listResult.objects || []).map(object => {
            if (object.key === prefix) return null;
            const name = object.key.substring(prefix.length);
            if (!name) return null;
            if (name === '.null' || object.key.endsWith('/')) return null;
            const objectUrl = buildObjectUrl(R2_PUBLIC_BASE_URL, object.key);
            const fileTypeInfo = getFileTypeInfo(object.key);
            return {
                name,
                key: object.key,
                size: object.size,
                uploaded: object.uploaded,
                type: 'file',
                isImage: fileTypeInfo.isImage,
                category: fileTypeInfo.category,
                iconClass: fileTypeInfo.iconClass,
                label: fileTypeInfo.label,
                url: objectUrl,
                directUrl: objectUrl
            };
        }).filter(Boolean);

        const totalFiles = files.length;
        const totalPages = Math.ceil(totalFiles / pageSize);
        const startIndex = (page - 1) * pageSize;
        const filesOnPage = files.slice(startIndex, startIndex + pageSize);

        let parentPath = '';
        if (prefix) {
            const parts = prefix.replace(/\/$/, '').split('/');
            parts.pop();
            parentPath = parts.join('/');
            if (parentPath) parentPath += '/';
        }

        return new Response(JSON.stringify({
            success: true,
            currentPath: prefix,
            parentPath: parentPath,
            directories: directories,
            files: filesOnPage,
            pagination: {
                currentPage: page,
                pageSize: pageSize,
                totalFiles: totalFiles,
                totalPages: totalPages
            }
        }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('List files error:', error);
        return new Response(JSON.stringify({ success: false, message: 'Failed to list files' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
