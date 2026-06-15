const R2_PUBLIC_BASE_URL = 'https://box.leak.moe';
const FILE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg']);
const MIME_EXTENSION_MAP = {
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'application/x-7z-compressed': '7z',
    'application/x-rar-compressed': 'rar',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/json': 'json'
};

function buildObjectUrl(baseUrl, key) {
    return `${baseUrl.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

// 简易路由器类
class Router {
    constructor() {
        // 存储所有路由规则的数组
        this.routes = [];
    }

    /**
     * 添加一个新的路由规则
     * @param {string} method - HTTP方法 (e.g., 'GET', 'POST')
     * @param {string} path - URL路径 (e.g., '/', '/upload')
     * @param {function} handler - 处理该路由的函数
     */
    add(method, path, handler) {
        // 将路径字符串转换为正则表达式，以便处理动态参数
        const regex = new RegExp(`^${path.replace(/:\w+\+/g, '(.+)').replace(/:\w+/g, '([^/]+)')}$`);
        this.routes.push({ method, path, handler, regex });
    }

    /**
     * 添加一个GET方法的路由
     * @param {string} path - URL路径
     * @param {function} handler - 处理函数
     */
    get(path, handler) {
        this.add('GET', path, handler);
    }

    /**
     * 添加一个POST方法的路由
     * @param {string} path - URL路径
     * @param {function} handler - 处理函数
     */
    post(path, handler) {
        this.add('POST', path, handler);
    }

    /**
     * 处理传入的请求，并匹配到对应的路由
     * @param {Request} request - Cloudflare Workers接收到的请求对象
     * @param {...any} args - 其他传递给处理函数的参数 (例如 env)
     * @returns {Promise<Response>} - 返回一个响应对象
     */
    async handle(request, ...args) {
        const url = new URL(request.url);
        const method = request.method;
        const path = url.pathname;

        for (const route of this.routes) {
            if (route.method !== method) continue;

            const match = path.match(route.regex);
            if (match) {
                const params = {};
                const paramNames = (route.path.match(/:\w+/g) || []).map(name => name.substring(1));
                paramNames.forEach((name, index) => {
                    params[name] = match[index + 1];
                });
                return route.handler(request, ...args, params);
            }
        }
        return new Response('Not found', { status: 404 });
    }
}

// 用于身份验证的中间件
const requireAuth = (handler) => async (request, env, ...args) => {
    // 检查用户是否已通过身份验证
    if (!await isAuthenticated(request, env.SECRET_KEY)) {
        const url = new URL(request.url);
        // 如果是API请求，返回401 Unauthorized
        if (url.pathname.startsWith('/api/')) {
            return new Response('Unauthorized', { status: 401 });
        }
        // 如果是页面请求，重定向到登录页面
        return Response.redirect(new URL('/', request.url).toString(), 302);
    }
    // 如果验证通过，则执行原始的处理函数
    return handler(request, env, ...args);
};


// Cloudflare Workers 的主入口点
export default {
    async fetch(request, env) {
        // --- HTTP to HTTPS Redirection ---
        const redirectUrl = new URL(request.url);
        if (redirectUrl.protocol === 'http:') {
            redirectUrl.protocol = 'https:';
            return Response.redirect(redirectUrl.href, 301); // 301 表示永久重定向
        }

        // --- 环境变量检查 ---
        // 定义所有必需的环境变量
        let requiredEnvVars = ['SECRET_KEY', 'BUCKET_R2', 'SHARES_KV', 'INDEXES_KV'];
        
        // 如果启用了Telegram Bot，则添加相关环境变量为必需
        if (env.ENABLE_TELEGRAM_BOT === 'true') {
            requiredEnvVars.push('TELEGRAM_BOT_TOKEN');
        }

        const missingEnvVars = requiredEnvVars.filter(key => !env[key]);

        // 如果启用了Telegram Bot，则检查 USER_ID 或 CHAT_ID 是否存在
        if (env.ENABLE_TELEGRAM_BOT === 'true' && !env.USER_ID && !env.CHAT_ID) {
            missingEnvVars.push('USER_ID or CHAT_ID');
        }

        // 如果有任何环境变量缺失，则返回一个错误页面
        if (missingEnvVars.length > 0) {
            return serveErrorPage(missingEnvVars);
        }

        // --- BASE_URL 格式化 ---
        const url = new URL(request.url);
        const path = url.pathname;

        // --- 路由器设置 ---
        const router = new Router();

        // 网页界面路由
        router.get('/', () => serveLoginPage());
        router.get('/index.html', () => serveLoginPage());
        router.post('/login', (req) => handleLogin(req, env.SECRET_KEY));

        // 公共分享路由
        router.get('/s/:shareId', (req, env, params) => {
            if (!params.shareId || params.shareId.length < 16) {
                return new Response('Not found', { status: 404 });
            }
            return serveSharePage(params.shareId);
        });
        router.get('/api/s/:shareId/list', (req, env, params) => {
            if (!params.shareId || params.shareId.length < 16) {
                return new Response('Not found', { status: 404 });
            }
            return handleListSharedFiles(req, env, params);
        });

        // 需要身份验证的网页界面路由
        router.get('/upload', requireAuth(serveUploadPage));
        router.get('/gallery', requireAuth(serveGalleryPage));

        // 需要身份验证的API路由
        router.post('/api/upload', requireAuth((req, env) => handleWebUpload(req, env.BUCKET_R2)));
        router.post('/api/upload/multipart/create', requireAuth((req, env) => handleCreateR2MultipartUpload(req, env.BUCKET_R2)));
        router.post('/api/upload/multipart/part', requireAuth((req, env) => handleUploadR2MultipartPart(req, env.BUCKET_R2)));
        router.post('/api/upload/multipart/complete', requireAuth((req, env) => handleCompleteR2MultipartUpload(req, env.BUCKET_R2)));
        router.post('/api/upload/multipart/abort', requireAuth((req, env) => handleAbortR2MultipartUpload(req, env.BUCKET_R2)));
        router.get('/api/list', requireAuth((req, env) => handleListFiles(req, env.BUCKET_R2)));
        router.post('/api/delete', requireAuth((req, env) => handleDeleteFiles(req, env.BUCKET_R2)));
        router.post('/api/create-folder', requireAuth((req, env) => handleCreateFolder(req, env.BUCKET_R2)));
        router.post('/api/share/create', requireAuth(handleCreateShare));
        router.get('/api/share/list', requireAuth(handleListShares));
        router.post('/api/share/delete', requireAuth(handleDeleteShare));
        // 文件操作（移动/复制）和目录列表路由
        router.post('/api/files/action', requireAuth((req, env) => handleFileAction(req, env.BUCKET_R2)));
        router.get('/api/directories', requireAuth((req, env) => handleListDirectories(req, env.BUCKET_R2)));

        // 如果启用了Telegram Bot，则注册相关路由
        if (env.ENABLE_TELEGRAM_BOT === 'true') {
            // Telegram机器人路由
            router.post('/webhook', (req) => handleTelegramWebhook(req, env)); // 处理Telegram的webhook更新
            // 设置Telegram webhook的辅助路由
            router.get('/setWebhook', async (req) => {
                const url = new URL(req.url);
                const webhookUrl = `${url.protocol}//${url.host}/webhook`;
                const TELEGRAM_API_URL = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
                const webhookResponse = await setWebhook(webhookUrl, TELEGRAM_API_URL);
                if (webhookResponse.ok) {
                    return new Response(`Webhook set successfully to ${webhookUrl}`);
                }
                return new Response('Failed to set webhook', { status: 500 });
            });
        }

        // --- 处理请求 ---
        try {
            // 使用路由器处理请求
            return await router.handle(request, env);
        } catch (err) {
            console.error(err);
            return new Response('Server error: ' + err.message, { status: 500 });
        }
    }
};

/**
 * 提供一个显示环境变量配置错误的HTML页面
 * @param {string[]} missingEnvVars - 缺失的环境变量键名数组
 * @returns {Response} - 包含错误信息的HTML响应
 */
function serveErrorPage(missingEnvVars) {
    const missingVarsHtml = missingEnvVars.map(key => `<li class="list-group-item font-monospace">${key}</li>`).join('');
    const errorMessage = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>PixR2 - 配置错误</title>
            <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.3.7/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background-color: #f8f9fa; }
                .container { max-width: 600px; }
            </style>
            <script>
                const svgIcon = \`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none"><path fill="url(#fluentColorSettings480)" d="M19.494 43.468c1.479.353 2.993.531 4.513.531a19.4 19.4 0 0 0 4.503-.534a1.94 1.94 0 0 0 1.474-1.672l.338-3.071a2.32 2.32 0 0 1 2.183-2.075c.367-.016.732.053 1.068.2l2.807 1.231a1.92 1.92 0 0 0 1.554.01c.247-.105.468-.261.65-.458a20.4 20.4 0 0 0 4.51-7.779a1.94 1.94 0 0 0-.7-2.133l-2.494-1.84a2.326 2.326 0 0 1 0-3.764l2.486-1.836a1.94 1.94 0 0 0 .7-2.138a20.3 20.3 0 0 0-4.515-7.777a1.94 1.94 0 0 0-2.192-.45l-2.806 1.236c-.29.131-.606.2-.926.2a2.34 2.34 0 0 1-2.32-2.088l-.34-3.06a1.94 1.94 0 0 0-1.5-1.681a21.7 21.7 0 0 0-4.469-.519a22 22 0 0 0-4.5.52a1.935 1.935 0 0 0-1.5 1.677l-.34 3.062a2.35 2.35 0 0 1-.768 1.488a2.53 2.53 0 0 1-1.569.6a2.3 2.3 0 0 1-.923-.194l-2.8-1.236a1.94 1.94 0 0 0-2.2.452a20.35 20.35 0 0 0-4.51 7.775a1.94 1.94 0 0 0 .7 2.137l2.488 1.836a2.344 2.344 0 0 1 .701 2.938a2.34 2.34 0 0 1-.7.829l-2.49 1.839a1.94 1.94 0 0 0-.7 2.135a20.3 20.3 0 0 0 4.51 7.782a1.93 1.93 0 0 0 2.193.454l2.818-1.237c.291-.128.605-.194.923-.194h.008a2.34 2.34 0 0 1 2.32 2.074l.338 3.057a1.94 1.94 0 0 0 1.477 1.673M24 30.25a6.25 6.25 0 1 1 0-12.5a6.25 6.25 0 0 1 0 12.5"/><defs><linearGradient id="fluentColorSettings480" x1="33.588" x2="11.226" y1="42.451" y2="7.607" gradientUnits="userSpaceOnUse"><stop stop-color="#70777d"/><stop offset="1" stop-color="#b9c0c7"/></linearGradient></defs></g></svg>\`;
                const blob = new Blob([svgIcon], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('link');
                link.rel = 'icon';
                link.type = 'image/svg+xml';
                link.href = url;
                document.head.appendChild(link);
            </script>
        </head>
        <body class="text-center">
            <div class="container p-4 p-md-5">
                <div class="card shadow-sm">
                    <div class="card-body p-5">
                        <h1 class="h3 mb-3 fw-normal text-danger">配置错误</h1>
                        <p class="text-muted">检测到以下环境变量缺失：</p>
                        <ul class="list-group mb-4">${missingVarsHtml}</ul>
                        <p class="text-muted small">请前往 Cloudflare 面板，添加这些环境变量</p>
                        <p class="text-muted small">缺失 BUCKET_R2, SHARES_KV, INDEXES_KV 时，请检查你的 R2/KV 是否绑定成功</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
    return new Response(errorMessage, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 500
    });
}

/**
 * 调用Telegram API来设置webhook
 * @param {string} webhookUrl - 要设置的webhook URL
 * @param {string} apiUrl - Telegram Bot API的基础URL
 * @returns {Promise<object>} - Telegram API的响应结果
 */
async function setWebhook(webhookUrl, apiUrl) {
    try {
        const response = await fetch(`${apiUrl}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl }),
        });

        const result = await response.json();

        if (!result.ok) {
            console.error('Failed to set webhook:', result.description);
        }

        return result;
    } catch (error) {
        console.error('Error setting webhook:', error);
        return { ok: false, description: error.message };
    }
}

/**
 * 根据文件内容的字节签名检测图片类型
 * @param {Uint8Array} uint8Array - 图片文件的字节数组
 * @returns {{mime: string, ext: string}|null} - 如果是支持的图片类型，返回MIME类型和扩展名，否则返回null
 */
function detectImageType(uint8Array) {
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

function getFileExtension(fileName = '') {
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

function getFileTypeInfo(fileName = '', mime = '') {
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

function buildStoredFileName(originalName, detectedType, mime = '', useRandomName = true) {
    const date = new Date();
    const formattedDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const shortUUID = crypto.randomUUID().split('-')[0];
    const sourceName = sanitizeFileName(originalName || 'file');
    const baseName = sanitizeFileName(stripFileExtension(sourceName));
    const extension = detectedType?.ext || getFileExtension(sourceName) || getExtensionFromMime(mime) || 'bin';
    if (!useRandomName) return `${baseName}.${extension.toLowerCase()}`;
    return `${formattedDate}_${shortUUID}_${baseName}.${extension.toLowerCase()}`;
}

async function buildUniqueR2Key(bucket, key) {
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

function buildMarkdownLink(fileName, url, isImage) {
    const label = sanitizeFileName(fileName || 'file').replace(/[\[\]]/g, '');
    return isImage ? `![${label}](${url})` : `[${label}](${url})`;
}

function resolveUploadContentType(fileName = '', contentType = '') {
    const normalizedContentType = contentType.split(';')[0].trim();
    const inferredContentType = getMimeFromExtension(fileName);
    return !normalizedContentType || normalizedContentType === 'application/octet-stream'
        ? inferredContentType || 'application/octet-stream'
        : normalizedContentType;
}

async function buildUploadTarget(bucket, { fileName: originalName = '', path = '', contentType = '', useRandomName = false }) {
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

function escapeHtmlForTelegram(value = '') {
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
 */
async function handleTelegramWebhook(request, env) {
    try {
        const update = await request.json();

        // 如果更新中没有消息，直接返回OK
        if (!update.message) {
            return new Response('OK');
        }

        const chatId = update.message.chat.id;

        // 检查用户是否已授权 (USER_ID/CHAT_ID环境变量中是否包含该用户的ID)
        const allowedChatIds = (env.USER_ID || env.CHAT_ID).split(',');
        if (!allowedChatIds.includes(chatId.toString())) {
            await sendMessage(chatId, '用户未授权！', `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`);
            return new Response('OK');
        }

        // 获取用户当前上传路径的函数
        async function getUserPath(chatId) {
            const path = await env.INDEXES_KV.get(chatId.toString());
            if (path === '/') {
                return ''; // 根路径返回空字符串
            }
            return path || ''; // 默认为空字符串 (根路径)
        }

        // 设置用户上传路径的函数
        async function setUserPath(chatId, path) {
            await env.INDEXES_KV.put(chatId.toString(), path);
        }

        // 处理媒体文件上传的函数
        async function handleMediaUpload(chatId, fileId, messageId, isDocument = false, originalName = '', mimeType = '') {
            try {
                const fileUrl = await getFileUrl(fileId, env.TELEGRAM_BOT_TOKEN);
                const userPath = await getUserPath(chatId);
                const uploadResult = await uploadFileToR2(fileUrl, env.BUCKET_R2, isDocument, userPath, originalName, mimeType);

                if (uploadResult.ok) {
                    const fileUrl = buildObjectUrl(R2_PUBLIC_BASE_URL, uploadResult.key);
                    const markdownLink = buildMarkdownLink(uploadResult.fileName, fileUrl, uploadResult.isImage);
                    const messageText = `直链:\n<code>${escapeHtmlForTelegram(fileUrl)}</code>\nMarkdown:\n<code>${escapeHtmlForTelegram(markdownLink)}</code>`;
                    await sendMessage(chatId, messageText, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`, {
                        parse_mode: "HTML",
                        reply_to_message_id: messageId
                    });
                } else {
                    await sendMessage(chatId, uploadResult.message, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`, {
                        reply_to_message_id: messageId
                    });
                }
            } catch (error) {
                console.error('处理文件失败:', error);
                await sendMessage(chatId, '文件处理失败，请稍后再试。', `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`, {
                    reply_to_message_id: messageId
                });
            }
        }

        // 处理文本消息
        if (update.message.text) {
            const text = update.message.text.trim();

            // 处理 /modify 命令，用于修改上传路径
            if (text.startsWith('/modify')) {
                const parts = text.split(' ');
                if (parts.length >= 2) {
                    const newPath = parts[1].trim();
                    await setUserPath(chatId, newPath);
                    await sendMessage(chatId, `修改路径为${newPath}`, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`);
                } else {
                    await sendMessage(chatId, '请指定路径，例如: /modify blog', `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`);
                }
                return new Response('OK');
            }

            // 处理 /status 命令，用于查看当前上传路径
            if (text === '/status') {
                const currentPath = await getUserPath(chatId);
                const statusMessage = currentPath ? `当前路径: ${currentPath}` : '当前路径: / (默认)';
                await sendMessage(chatId, statusMessage, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`);
                return new Response('OK');
            }

            // 对于其他文本消息，发送帮助信息
            let mes = `请发送文件或图片！\n或者使用以下命令：\n/modify 修改上传文件的存储路径\n/status 查看当前上传路径`;
            await sendMessage(chatId, mes, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`);
            return new Response('OK');
        }

        // 处理以文件形式发送的内容
        if (update.message.document) {
            const doc = update.message.document;
            await handleMediaUpload(chatId, doc.file_id, update.message.message_id, true, doc.file_name || '', doc.mime_type || '');
            return new Response('OK');
        }

        // 处理以图片形式发送的内容
        if (update.message.photo) {
            // Telegram会发送多个尺寸的图片，选择最大尺寸的
            const fileId = update.message.photo.slice(-1)[0].file_id;
            await handleMediaUpload(chatId, fileId, update.message.message_id);
            return new Response('OK');
        }

        return new Response('OK');
    } catch (err) {
        console.error(err);
        return new Response('Error processing request', { status: 500 });
    }
}

// --- 身份验证相关函数 ---

/**
 * 检查请求的cookie中是否包含有效的认证信息
 * @param {Request} request - 传入的请求
 * @param {string} secretKey - 用于验证的密钥
 * @returns {Promise<boolean>} - 如果已认证则返回true，否则返回false
 */
async function isAuthenticated(request, secretKey) {
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    // 比较cookie中的auth值与密钥的哈希值
    return cookies.auth === hashKey(secretKey).replace(/=/g, '');
}

/**
 * 处理登录请求
 * @param {Request} request - 传入的请求
 * @param {string} secretKey - 用于验证的密钥
 * @returns {Promise<Response>} - 成功则重定向到上传页面，失败则返回登录页面并显示错误信息
 */
async function handleLogin(request, secretKey) {
    const formData = await request.formData();
    const inputKey = formData.get('key');

    // 检查输入的密钥是否正确
    if (inputKey === secretKey) {
        const headers = new Headers();
        // 登录成功，设置一个有效期为一天的HttpOnly cookie
        headers.append('Set-Cookie', `auth=${hashKey(secretKey).replace(/=/g, '')}; SameSite=Lax; Secure; HttpOnly; Path=/; Max-Age=86400`);
        // 重定向到上传页面
        headers.append('Location', '/upload');
        return new Response(null, {
            status: 302,
            headers
        });
    }

    // 密钥错误，返回登录页面并显示错误信息
    return serveLoginPage("密钥错误，请重新输入");
}

/**
 * 对密钥进行简单的哈希处理（Base64编码）
 * @param {string} key - 要哈希的字符串
 * @returns {string} - 哈希后的字符串
 */
function hashKey(key) {
    return btoa(key);
}

/**
 * 解析cookie字符串为对象
 * @param {string} cookieString - 从请求头获取的cookie字符串
 * @returns {object} - 解析后的cookie键值对对象
 */
function parseCookies(cookieString) {
    const cookies = {};
    cookieString.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name) cookies[name] = value;
    });
    return cookies;
}

// --- 页面渲染函数 ---

function getMotionStyles() {
    return `
            :root {
                --pixr2-ease: cubic-bezier(0.22, 1, 0.36, 1);
                --pixr2-fast: 160ms;
                --pixr2-normal: 240ms;
            }
            .navbar-brand,
            .nav-link,
            .btn,
            .btn-close,
            .form-control,
            .list-group-item,
            .page-link {
                transition:
                    color var(--pixr2-fast) var(--pixr2-ease),
                    background-color var(--pixr2-fast) var(--pixr2-ease),
                    border-color var(--pixr2-fast) var(--pixr2-ease),
                    box-shadow var(--pixr2-fast) var(--pixr2-ease),
                    opacity var(--pixr2-fast) var(--pixr2-ease),
                    transform var(--pixr2-fast) var(--pixr2-ease);
            }
            .navbar-brand:hover,
            .nav-link:hover,
            .btn:hover:not(:disabled),
            .page-link:hover,
            .form-control:focus {
                transform: translateY(-1px);
            }
            .btn:active:not(:disabled),
            .page-link:active {
                transform: translateY(0) scale(0.98);
            }
            .modal.fade .modal-dialog {
                transform: translateY(12px) scale(0.98);
                transition: transform var(--pixr2-normal) var(--pixr2-ease);
            }
            .modal.show .modal-dialog {
                transform: none;
            }
            .toast {
                transition:
                    opacity var(--pixr2-normal) var(--pixr2-ease),
                    transform var(--pixr2-normal) var(--pixr2-ease);
            }
            @keyframes pixr2-fade-up {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @media (prefers-reduced-motion: reduce) {
                *,
                *::before,
                *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    scroll-behavior: auto !important;
                    transition-duration: 0.01ms !important;
                }
                .navbar-brand:hover,
                .nav-link:hover,
                .btn:hover:not(:disabled),
                .page-link:hover,
                .btn:active:not(:disabled),
                .page-link:active,
                .form-control:focus {
                    transform: none;
                }
            }
    `;
}

/**
 * 提供登录页面的HTML
 * @param {string|null} errorMessage - 如果有错误，则显示此消息
 * @returns {Response} - 包含登录页面HTML的响应
 */
function serveLoginPage(errorMessage = null) {
    const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PixR2 - 登录</title>
        <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.3.7/css/bootstrap.min.css" rel="stylesheet">
        <style>
            ${getMotionStyles()}
            body {
                display: flex;
                align-items: flex-start;
                justify-content: center;
                min-height: 100vh;
                min-height: 100dvh;
                margin: 0;
                padding: 2rem 1rem;
                background-color: #f8f9fa;
            }
            .form-signin {
                width: 100%;
                max-width: 400px;
                padding: 0;
                margin: min(12vh, 5rem) auto 0;
            }
            .form-signin .card {
                animation: pixr2-fade-up var(--pixr2-normal) var(--pixr2-ease) both;
            }
            @media (max-width: 575.98px) {
                body {
                    min-height: 100svh;
                    padding-top: 1.25rem;
                }
                .form-signin {
                    margin-top: 0;
                }
                .form-signin .card-body {
                    padding: 2rem !important;
                }
            }
        </style>
        <script>
            // SVG 原始代码
            const svgIcon = \`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none"><path fill="url(#fluentColorSettings480)" d="M19.494 43.468c1.479.353 2.993.531 4.513.531a19.4 19.4 0 0 0 4.503-.534a1.94 1.94 0 0 0 1.474-1.672l.338-3.071a2.32 2.32 0 0 1 2.183-2.075c.367-.016.732.053 1.068.2l2.807 1.231a1.92 1.92 0 0 0 1.554.01c.247-.105.468-.261.65-.458a20.4 20.4 0 0 0 4.51-7.779a1.94 1.94 0 0 0-.7-2.133l-2.494-1.84a2.326 2.326 0 0 1 0-3.764l2.486-1.836a1.94 1.94 0 0 0 .7-2.138a20.3 20.3 0 0 0-4.515-7.777a1.94 1.94 0 0 0-2.192-.45l-2.806 1.236c-.29.131-.606.2-.926.2a2.34 2.34 0 0 1-2.32-2.088l-.34-3.06a1.94 1.94 0 0 0-1.5-1.681a21.7 21.7 0 0 0-4.469-.519a22 22 0 0 0-4.5.52a1.935 1.935 0 0 0-1.5 1.677l-.34 3.062a2.35 2.35 0 0 1-.768 1.488a2.53 2.53 0 0 1-1.569.6a2.3 2.3 0 0 1-.923-.194l-2.8-1.236a1.94 1.94 0 0 0-2.2.452a20.35 20.35 0 0 0-4.51 7.775a1.94 1.94 0 0 0 .7 2.137l2.488 1.836a2.344 2.344 0 0 1 .701 2.938a2.34 2.34 0 0 1-.7.829l-2.49 1.839a1.94 1.94 0 0 0-.7 2.135a20.3 20.3 0 0 0 4.51 7.782a1.93 1.93 0 0 0 2.193.454l2.818-1.237c.291-.128.605-.194.923-.194h.008a2.34 2.34 0 0 1 2.32 2.074l.338 3.057a1.94 1.94 0 0 0 1.477 1.673M24 30.25a6.25 6.25 0 1 1 0-12.5a6.25 6.25 0 0 1 0 12.5"/><defs><linearGradient id="fluentColorSettings480" x1="33.588" x2="11.226" y1="42.451" y2="7.607" gradientUnits="userSpaceOnUse"><stop stop-color="#70777d"/><stop offset="1" stop-color="#b9c0c7"/></linearGradient></defs></g></svg>\`;                 
            // 创建 blob 和 URL
            const blob = new Blob([svgIcon], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);                  
            // 创建 favicon link
            const link = document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/svg+xml';
            link.href = url;                    
            // 插入到 head 中
            document.head.appendChild(link);
        </script>
    </head>
    <body class="text-center">
        <main class="form-signin">
            <div class="card shadow-sm">
                <div class="card-body p-5">
                    <h1 class="h3 mb-4 fw-normal">PixR2</h1>
                    <form action="/login" method="post">
                        <div class="form-floating mb-3">
                            <input type="password" class="form-control" id="floatingPassword" name="key" placeholder="访问密钥"
                                required>
                            <label for="floatingPassword">访问密钥</label>
                        </div>
                        <button class="w-100 btn btn-lg btn-primary" type="submit">登录</button>
                        ${errorMessage ? `<p class="mt-3 text-danger">${errorMessage}</p>` : ''}
                    </form>
                </div>
            </div>
        </main>
    </body>
    </html>
    `;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

/**
 * 提供文件上传页面的HTML
 * @returns {Response} - 包含上传页面HTML的响应
 */
function serveUploadPage() {
    const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PixR2 - 上传</title>
        <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.3.7/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdn.bootcdn.net/ajax/libs/bootstrap-icons/1.13.1/font/bootstrap-icons.min.css">
        <style>
            ${getMotionStyles()}
            main > .card {
                animation: pixr2-fade-up var(--pixr2-normal) var(--pixr2-ease) both;
            }
            .dropzone {
                border: 2px dashed #dee2e6;
                border-radius: .375rem;
                cursor: pointer;
                transition:
                    background-color var(--pixr2-normal) var(--pixr2-ease),
                    border-color var(--pixr2-normal) var(--pixr2-ease),
                    box-shadow var(--pixr2-normal) var(--pixr2-ease),
                    transform var(--pixr2-normal) var(--pixr2-ease);
            }
            .dropzone:hover, .dropzone.active {
                border-color: #0d6efd;
                background-color: rgba(13, 110, 253, 0.05);
                box-shadow: 0 .75rem 1.5rem rgba(13, 110, 253, 0.12);
                transform: translateY(-2px);
            }
            .dropzone .bi {
                transition: transform var(--pixr2-normal) var(--pixr2-ease);
            }
            .dropzone:hover .bi,
            .dropzone.active .bi {
                transform: translateY(-2px) scale(1.06);
            }
            #selectedFiles .list-group-item,
            #modalContent .alert,
            #modalContent .card {
                animation: pixr2-fade-up var(--pixr2-normal) var(--pixr2-ease) both;
            }
            .min-w-0 {
                min-width: 0;
            }
            .upload-progress-wrap .progress {
                height: .45rem;
            }
            .upload-progress-wrap .progress-bar {
                transition: width 160ms var(--pixr2-ease);
            }
        </style>
        <script>
            // SVG 原始代码
            const svgIcon = \`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none"><path fill="url(#fluentColorSettings480)" d="M19.494 43.468c1.479.353 2.993.531 4.513.531a19.4 19.4 0 0 0 4.503-.534a1.94 1.94 0 0 0 1.474-1.672l.338-3.071a2.32 2.32 0 0 1 2.183-2.075c.367-.016.732.053 1.068.2l2.807 1.231a1.92 1.92 0 0 0 1.554.01c.247-.105.468-.261.65-.458a20.4 20.4 0 0 0 4.51-7.779a1.94 1.94 0 0 0-.7-2.133l-2.494-1.84a2.326 2.326 0 0 1 0-3.764l2.486-1.836a1.94 1.94 0 0 0 .7-2.138a20.3 20.3 0 0 0-4.515-7.777a1.94 1.94 0 0 0-2.192-.45l-2.806 1.236c-.29.131-.606.2-.926.2a2.34 2.34 0 0 1-2.32-2.088l-.34-3.06a1.94 1.94 0 0 0-1.5-1.681a21.7 21.7 0 0 0-4.469-.519a22 22 0 0 0-4.5.52a1.935 1.935 0 0 0-1.5 1.677l-.34 3.062a2.35 2.35 0 0 1-.768 1.488a2.53 2.53 0 0 1-1.569.6a2.3 2.3 0 0 1-.923-.194l-2.8-1.236a1.94 1.94 0 0 0-2.2.452a20.35 20.35 0 0 0-4.51 7.775a1.94 1.94 0 0 0 .7 2.137l2.488 1.836a2.344 2.344 0 0 1 .701 2.938a2.34 2.34 0 0 1-.7.829l-2.49 1.839a1.94 1.94 0 0 0-.7 2.135a20.3 20.3 0 0 0 4.51 7.782a1.93 1.93 0 0 0 2.193.454l2.818-1.237c.291-.128.605-.194.923-.194h.008a2.34 2.34 0 0 1 2.32 2.074l.338 3.057a1.94 1.94 0 0 0 1.477 1.673M24 30.25a6.25 6.25 0 1 1 0-12.5a6.25 6.25 0 0 1 0 12.5"/><defs><linearGradient id="fluentColorSettings480" x1="33.588" x2="11.226" y1="42.451" y2="7.607" gradientUnits="userSpaceOnUse"><stop stop-color="#70777d"/><stop offset="1" stop-color="#b9c0c7"/></linearGradient></defs></g></svg>\`;                 
            // 创建 blob 和 URL
            const blob = new Blob([svgIcon], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);                  
            // 创建 favicon link
            const link = document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/svg+xml';
            link.href = url;                    
            // 插入到 head 中
            document.head.appendChild(link);
        </script>
    </head>
    <body class="bg-light">
        <header>
            <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
                <div class="container">
                    <a class="navbar-brand fw-bold" href="/upload">PixR2</a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
	                            <li class="nav-item">
	                                <a class="nav-link active" aria-current="page" href="/upload">上传文件</a>
	                            </li>
	                            <li class="nav-item">
	                                <a class="nav-link" href="/gallery">文件管理</a>
	                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
        </header>

        <main class="container my-5">
            <div class="card shadow-sm">
                <div class="card-body p-4 p-md-5">
	                    <h1 class="card-title h3 mb-4">上传文件</h1>
	                    <div class="dropzone text-center p-5 mb-3" id="dropzone">
	                        <i class="bi bi-upload fs-1 text-primary"></i>
	                        <p class="mt-3">拖拽文件到此处或点击选择文件</p>
	                        <p class="text-muted small">支持图片、文档、压缩包、音视频和其他常见文件</p>
	                        <input type="file" id="fileInput" class="d-none" multiple>
                    </div>

	                    <div class="form-check form-switch mb-3">
	                        <input class="form-check-input" type="checkbox" role="switch" id="randomName">
	                        <label class="form-check-label" for="randomName">使用随机文件名</label>
	                    </div>

	                    <div id="selectedFiles" class="mb-3"></div>

	                    <button id="uploadBtn" class="btn btn-primary w-100" disabled>上传文件</button>
                </div>
            </div>
        </main>

        <!-- Success Modal -->
        <div class="modal fade" id="successModal" tabindex="-1" aria-labelledby="successModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="successModalLabel">上传结果</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="modalContent">
                        <!-- Links will be populated here -->
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.3.7/js/bootstrap.bundle.min.js"></script>
        <script>
            document.addEventListener('DOMContentLoaded', () => {
                const dropzone = document.getElementById('dropzone');
                const fileInput = document.getElementById('fileInput');
                const selectedFilesContainer = document.getElementById('selectedFiles');
	                const uploadBtn = document.getElementById('uploadBtn');
	                const randomName = document.getElementById('randomName');
	                const successModalEl = document.getElementById('successModal');
                const successModal = new bootstrap.Modal(successModalEl);
                const modalContent = document.getElementById('modalContent');

                let selectedFiles = [];
                let uploadInProgress = false;
                let uploadProgress = [];
                const MULTIPART_CHUNK_SIZE = 8 * 1024 * 1024;
                const MULTIPART_CONCURRENCY = 4;

                function escapeHtml(value = '') {
                    const htmlEscapes = {
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#39;'
                    };
                    return String(value).replace(/[&<>"']/g, char => htmlEscapes[char]);
                }

                dropzone.addEventListener('click', () => fileInput.click());
                dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('active'); });
                dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('active'); });
                dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('active'); handleFiles(e.dataTransfer.files); });
                fileInput.addEventListener('change', () => { handleFiles(fileInput.files); });

                function formatFileSize(bytes) {
                    if (bytes < 1024) return bytes + ' B';
                    const i = Math.floor(Math.log(bytes) / Math.log(1024));
                    return \`\${(bytes / Math.pow(1024, i)).toFixed(2)} \${['B', 'KB', 'MB', 'GB'][i]}\`;
                }

                function getClientFileIcon(file) {
                    const name = file.name.toLowerCase();
                    const type = (file.type || '').toLowerCase();
                    const ext = name.includes('.') ? name.split('.').pop() : '';
                    if (type.startsWith('image/')) return 'bi-file-earmark-image';
                    if (type.startsWith('video/')) return 'bi-file-earmark-play';
                    if (type.startsWith('audio/')) return 'bi-file-earmark-music';
                    if (ext === 'pdf') return 'bi-file-earmark-pdf';
                    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'bi-file-earmark-zip';
                    if (['doc', 'docx'].includes(ext)) return 'bi-file-earmark-word';
                    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'bi-file-earmark-spreadsheet';
                    if (['ppt', 'pptx'].includes(ext)) return 'bi-file-earmark-slides';
                    if (['js', 'ts', 'html', 'css', 'json', 'md', 'py', 'go', 'rs', 'java', 'php', 'sh'].includes(ext)) return 'bi-file-earmark-code';
                    if (type.startsWith('text/') || ['txt', 'log'].includes(ext)) return 'bi-file-earmark-text';
                    return 'bi-file-earmark';
                }

                function handleFiles(files) {
                    if (uploadInProgress) return;
                    const validFiles = Array.from(files).filter(file => file && file.name);
                    if (validFiles.length === 0) return;
                    selectedFiles = [...selectedFiles, ...validFiles];
                    updateFilePreview();
                    uploadBtn.disabled = selectedFiles.length === 0;
                }

                function updateFilePreview() {
                    selectedFilesContainer.innerHTML = '';
                    if (selectedFiles.length === 0) return;

                    const list = document.createElement('ul');
                    list.className = 'list-group';
                    selectedFiles.forEach((file, index) => {
                        const item = document.createElement('li');
                        const safeName = escapeHtml(file.name);
                        const progress = uploadProgress[index] || { percent: 0, status: '等待上传' };
                        const progressPercent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
                        const progressClass = progress.error ? 'bg-danger' : progress.done ? 'bg-success' : '';
		                        item.className = 'list-group-item d-flex justify-content-between align-items-center gap-3';
		                        item.innerHTML = \`
		                            <div class="flex-grow-1 min-w-0">
		                                <div class="d-flex align-items-center min-w-0">
		                                    <i class="bi \${getClientFileIcon(file)} me-2 text-secondary flex-shrink-0"></i>
		                                    <span class="text-truncate" title="\${safeName}">\${safeName}</span>
		                                    <small class="text-muted ms-2 flex-shrink-0">\${formatFileSize(file.size)}</small>
		                                </div>
		                                \${uploadInProgress ? \`
		                                    <div class="upload-progress-wrap mt-2" data-index="\${index}">
		                                        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="\${progressPercent}">
		                                            <div class="progress-bar \${progressClass}" style="width: \${progressPercent}%"></div>
		                                        </div>
		                                        <div class="small text-muted mt-1 upload-progress-label">\${escapeHtml(progress.status || progressPercent + '%')}</div>
		                                    </div>
		                                \` : ''}
		                            </div>
		                            <button type="button" class="btn-close" aria-label="Remove" data-index="\${index}" \${uploadInProgress ? 'disabled' : ''}></button>
	                        \`;
                        list.appendChild(item);
                    });
                    selectedFilesContainer.appendChild(list);

                    document.querySelectorAll('#selectedFiles .btn-close').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const index = parseInt(e.target.dataset.index);
                            if (uploadInProgress) return;
                            selectedFiles.splice(index, 1);
                            updateFilePreview();
                            uploadBtn.disabled = selectedFiles.length === 0;
                        });
                    });
                }

                function setUploadProgress(index, state) {
                    uploadProgress[index] = { ...(uploadProgress[index] || {}), ...state };
                    const progress = uploadProgress[index];
                    const progressPercent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
                    const wrap = selectedFilesContainer.querySelector(\`.upload-progress-wrap[data-index="\${index}"]\`);
                    if (!wrap) return;

                    const progressElement = wrap.querySelector('.progress');
                    const progressBar = wrap.querySelector('.progress-bar');
                    const progressLabel = wrap.querySelector('.upload-progress-label');
                    if (progressElement) progressElement.setAttribute('aria-valuenow', String(progressPercent));
                    if (progressBar) {
                        progressBar.style.width = progressPercent + '%';
                        progressBar.classList.toggle('bg-success', !!progress.done);
                        progressBar.classList.toggle('bg-danger', !!progress.error);
                    }
                    if (progressLabel) progressLabel.textContent = progress.status || progressPercent + '%';
                }

                async function postUploadJson(endpoint, payload) {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok || !data.success) {
                        throw new Error(data.message || '上传失败');
                    }
                    return data;
                }

                function uploadChunk(uploadUrl, chunk, contentType, onProgress) {
                    return new Promise(resolve => {
                        const xhr = new XMLHttpRequest();
                        xhr.open('POST', uploadUrl);
                        xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');

                        xhr.upload.onprogress = event => {
                            if (event.lengthComputable) {
                                onProgress(event.loaded);
                            }
                        };

                        xhr.onload = () => {
                            let response = {};
                            try {
                                response = JSON.parse(xhr.responseText || '{}');
                            } catch {
                                response = {};
                            }
                            if (xhr.status >= 200 && xhr.status < 300 && !response.error) {
                                resolve(response);
                                return;
                            }
                            resolve({ error: true, message: response.message || '上传失败' });
                        };

                        xhr.onerror = () => {
                            resolve({ error: true, message: '网络错误' });
                        };

                        xhr.onabort = () => {
                            resolve({ error: true, message: '已取消' });
                        };

                        xhr.send(chunk);
                    });
                }

                async function uploadFile(file, index) {
                    let multipartUpload = null;
                    try {
                        const contentType = file.type || 'application/octet-stream';
                        setUploadProgress(index, { percent: 0, status: '准备上传' });
                        multipartUpload = await postUploadJson('/api/upload/multipart/create', {
                            filename: file.name,
                            path: '',
                            randomName: randomName.checked,
                            contentType
                        });

                        const totalParts = Math.max(1, Math.ceil(file.size / MULTIPART_CHUNK_SIZE));
                        const uploadedParts = new Array(totalParts);
                        const partLoadedBytes = new Array(totalParts).fill(0);
                        const parallelCount = Math.min(MULTIPART_CONCURRENCY, totalParts);
                        let nextPartNumber = 1;
                        let completedParts = 0;
                        let failed = false;
                        const errors = [];

                        const updateTotalProgress = (partNumber, loaded) => {
                            partLoadedBytes[partNumber - 1] = loaded;
                            const uploadedBytes = partLoadedBytes.reduce((sum, value) => sum + value, 0);
                            const percent = file.size > 0 ? Math.round((uploadedBytes / file.size) * 100) : 100;
                            setUploadProgress(index, {
                                percent,
                                status: \`上传中 \${percent}%（\${completedParts}/\${totalParts}，并发 \${parallelCount}）\`
                            });
                        };

                        const uploadPart = async partNumber => {
                            const start = (partNumber - 1) * MULTIPART_CHUNK_SIZE;
                            const end = Math.min(start + MULTIPART_CHUNK_SIZE, file.size);
                            const chunk = file.slice(start, end);
                            const partUrl = new URL('/api/upload/multipart/part', window.location.origin);
                            partUrl.searchParams.set('key', multipartUpload.key);
                            partUrl.searchParams.set('uploadId', multipartUpload.uploadId);
                            partUrl.searchParams.set('partNumber', String(partNumber));

                            const partResult = await uploadChunk(
                                partUrl.pathname + partUrl.search,
                                chunk,
                                contentType,
                                loaded => updateTotalProgress(partNumber, loaded)
                            );

                            if (partResult.error || !partResult.part) {
                                throw new Error(partResult.message || '上传分片失败');
                            }
                            uploadedParts[partNumber - 1] = partResult.part;
                            completedParts += 1;
                            updateTotalProgress(partNumber, end - start);
                            const uploadedBytes = partLoadedBytes.reduce((sum, value) => sum + value, 0);
                            const percent = file.size > 0 ? Math.round((uploadedBytes / file.size) * 100) : 100;
                            setUploadProgress(index, {
                                percent,
                                status: \`上传中 \${percent}%（\${completedParts}/\${totalParts}，并发 \${parallelCount}）\`
                            });
                        };

                        const workers = Array.from({ length: parallelCount }, async () => {
                            while (!failed && nextPartNumber <= totalParts) {
                                const partNumber = nextPartNumber++;
                                try {
                                    await uploadPart(partNumber);
                                } catch (error) {
                                    failed = true;
                                    errors.push(error);
                                }
                            }
                        });

                        await Promise.all(workers);
                        if (errors.length > 0) throw errors[0];

                        const completedUpload = await postUploadJson('/api/upload/multipart/complete', {
                            key: multipartUpload.key,
                            uploadId: multipartUpload.uploadId,
                            parts: uploadedParts.filter(Boolean),
                            contentType: multipartUpload.contentType
                        });

                        setUploadProgress(index, { percent: 100, status: '上传完成', done: true });
                        return completedUpload;
                    } catch (error) {
                        if (multipartUpload?.key && multipartUpload?.uploadId) {
                            await postUploadJson('/api/upload/multipart/abort', {
                                key: multipartUpload.key,
                                uploadId: multipartUpload.uploadId
                            }).catch(() => {});
                        }
                        setUploadProgress(index, { status: '上传失败', error: true });
                        return { error: true, message: error.message || '上传失败', name: file.name };
                    }
                }

                uploadBtn.addEventListener('click', async () => {
                    if (selectedFiles.length === 0) return;
                    uploadBtn.disabled = true;
                    uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 上传中...';
                    uploadInProgress = true;
                    uploadProgress = selectedFiles.map(() => ({ percent: 0, status: '等待上传' }));
                    updateFilePreview();

                    const uploadPromises = selectedFiles.map((file, index) => uploadFile(file, index));

                    const results = await Promise.all(uploadPromises);
                    displayResults(results);

                    uploadBtn.disabled = false;
	                    uploadBtn.textContent = '上传文件';
                    uploadInProgress = false;
                    uploadProgress = [];
                    selectedFiles = [];
                    updateFilePreview();
                    uploadBtn.disabled = true;
                });

                function displayResults(results) {
                    modalContent.innerHTML = '';
                    const successfulUploads = results.filter(r => !r.error);
                    const failedUploads = results.filter(r => r.error);

	                    if (failedUploads.length > 0) {
	                        const errorAlert = document.createElement('div');
	                        const failedNames = failedUploads.map(f => escapeHtml(f.name || '未知文件')).join(', ');
	                        errorAlert.className = 'alert alert-danger';
	                        errorAlert.innerHTML = \`<strong>\${failedUploads.length} 个文件上传失败:</strong> \${failedNames}\`;
	                        modalContent.appendChild(errorAlert);
	                    }

                    if (successfulUploads.length > 0) {
                        successfulUploads.forEach(result => {
                            const linkItem = document.createElement('div');
                            const safeKey = escapeHtml(result.key || '');
                            const safeUrl = escapeHtml(result.url || '');
                            const safeMarkdown = escapeHtml(result.markdown || '');
                            linkItem.className = 'card mb-3';
                            linkItem.innerHTML = \`
                                <div class="card-header">\${safeKey}</div>
                                <div class="card-body">
                                    <div class="mb-2">
                                        <label class="form-label small">直接链接</label>
                                        <div class="input-group">
                                            <input type="text" class="form-control form-control-sm" value="\${safeUrl}" readonly>
                                            <button class="btn btn-outline-secondary btn-sm copy-btn" data-text="\${safeUrl}">复制</button>
                                        </div>
                                    </div>
                                    <div>
		                                        <label class="form-label small">Markdown</label>
		                                        <div class="input-group">
		                                            <input type="text" class="form-control form-control-sm" value="\${safeMarkdown}" readonly>
		                                            <button class="btn btn-outline-secondary btn-sm copy-btn" data-text="\${safeMarkdown}">复制</button>
		                                        </div>
	                                    </div>
                                </div>
                            \`;
                            modalContent.appendChild(linkItem);
                        });
                    }
                    successModal.show();

                    document.querySelectorAll('.copy-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const textToCopy = e.currentTarget.dataset.text;
                            navigator.clipboard.writeText(textToCopy).then(() => {
                                const originalText = e.currentTarget.textContent;
                                e.currentTarget.textContent = '已复制';
                                setTimeout(() => { e.currentTarget.textContent = originalText; }, 1500);
                            });
                        });
                    });
                }
            });
        </script>
    </body>
    </html>
    `;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

/**
 * 提供图库页面的HTML
 * @returns {Response} - 包含图库页面HTML的响应
 */
function serveGalleryPage() {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PixR2 - 图库</title>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.3.7/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.bootcdn.net/ajax/libs/bootstrap-icons/1.13.1/font/bootstrap-icons.min.css">
    <style>
        ${getMotionStyles()}
        .container > .card {
            animation: pixr2-fade-up var(--pixr2-normal) var(--pixr2-ease) both;
        }
        .breadcrumb a {
            display: inline-block;
            transition:
                color var(--pixr2-fast) var(--pixr2-ease),
                transform var(--pixr2-fast) var(--pixr2-ease);
        }
        .breadcrumb a:hover {
            transform: translateY(-1px);
        }
	        .gallery .item {
	            animation: pixr2-fade-up 220ms var(--pixr2-ease) both;
	        }
	        .gallery .item .card {
	            cursor: pointer;
	            overflow: hidden;
	            display: flex;
	            flex-direction: column;
	            transition:
	                border-color var(--pixr2-normal) var(--pixr2-ease),
	                box-shadow var(--pixr2-normal) var(--pixr2-ease),
                transform var(--pixr2-normal) var(--pixr2-ease);
        }
	        .gallery .item .card:hover {
	            transform: translateY(-4px);
	            box-shadow: 0 .75rem 1.5rem rgba(0,0,0,.16)!important;
	        }
	        .file-visual-shell {
	            position: relative;
	            width: 100%;
	            aspect-ratio: 4 / 3;
	            overflow: hidden;
	            flex: 0 0 auto;
	        }
	        .gallery .item .file-image-shell {
	            background: #f1f5f9;
	        }
	        .gallery .item .file-image-shell.loaded {
	            background: #f8f9fa;
	        }
	        .gallery .item .file-image {
            display: block;
            width: 100%;
	            height: 100%;
	            object-fit: cover;
	            opacity: 0;
	            transform: scale(1.01);
	            transition:
	                opacity var(--pixr2-normal) var(--pixr2-ease),
	                transform var(--pixr2-normal) var(--pixr2-ease);
	        }
	        .gallery .item .file-image.loaded {
            animation: none;
            opacity: 1;
            transform: scale(1);
        }
        .image-loading-indicator {
            position: absolute;
            inset: 0;
	            display: flex;
	            align-items: center;
	            justify-content: center;
	            background-color: rgba(248, 249, 250, 0.72);
	            opacity: 1;
	            transform: scale(1);
	            transition:
                opacity var(--pixr2-normal) var(--pixr2-ease),
                transform var(--pixr2-normal) var(--pixr2-ease),
                visibility var(--pixr2-normal) var(--pixr2-ease);
            pointer-events: none;
        }
        .image-loading-indicator .spinner-border {
            width: 1.75rem;
            height: 1.75rem;
        }
        .file-image-shell.loaded .image-loading-indicator {
            opacity: 0;
	            transform: scale(0.94);
	            visibility: hidden;
	        }
	        .gallery .item .card:hover .file-image {
	            transform: scale(1.025);
	        }
	        .file-icon-shell {
	            display: flex;
	            flex-direction: column;
	            align-items: center;
            justify-content: center;
            gap: .5rem;
	            background: linear-gradient(180deg, #f8f9fa 0%, #eef2f7 100%);
	            color: #6c757d;
	        }
	        .directory-shell {
	            background: linear-gradient(180deg, #fff8df 0%, #fff2b8 100%);
	            color: #ffc107;
	        }
	        .file-icon-shell .file-type-icon {
	            font-size: clamp(2.75rem, 8vw, 4.25rem);
	            line-height: 1;
	        }
	        .file-icon-shell .file-type-label {
            max-width: 80%;
            font-size: .75rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        .gallery .item .card:hover .file-type-icon {
            transform: scale(1.04);
        }
	        .file-type-icon {
	            transition: transform var(--pixr2-normal) var(--pixr2-ease);
	        }
	        .gallery .item .checkbox {
	            position: absolute;
	            top: 0.5rem;
	            right: 0.5rem;
	            z-index: 10;
	            background-color: #fff;
	            transition:
                box-shadow var(--pixr2-fast) var(--pixr2-ease),
                transform var(--pixr2-fast) var(--pixr2-ease);
        }
        .gallery .item.selected .card {
            border-color: var(--bs-primary);
            box-shadow: 0 0 0 .2rem rgba(13, 110, 253, 0.16)!important;
            transform: translateY(-2px);
        }
	        .gallery .item.selected .checkbox {
	            transform: scale(1.05);
	        }
	        .file-card-footer {
	            flex: 1 0 auto;
	            min-height: 4.6rem;
	            display: flex;
	            align-items: center;
	            padding: .65rem .75rem;
	        }
	        .file-meta {
	            min-width: 0;
	        }
	        .file-name {
	            color: #212529;
	            font-size: .95rem;
	            font-weight: 500;
	            line-height: 1.25;
	        }
	        .file-subtitle {
	            color: #6c757d;
	            font-size: .82rem;
	            line-height: 1.3;
	        }
	        .file-actions .btn {
	            width: 2.15rem;
	            height: 2.15rem;
	            display: inline-flex;
	            align-items: center;
	            justify-content: center;
	            padding: 0;
	        }
	        .gallery-placeholder .card {
	            cursor: default;
	            pointer-events: none;
	        }
	        .gallery .gallery-placeholder .card:hover {
	            transform: none;
	            box-shadow: none!important;
	        }
	        .skeleton-block,
	        .skeleton-line {
	            background-color: #eef2f7;
	            animation: pixr2-skeleton-pulse 850ms ease-in-out infinite alternate;
	        }
	        .skeleton-line {
	            display: block;
	            height: .82rem;
	            border-radius: 999px;
	            margin-bottom: .55rem;
	        }
	        .skeleton-line-name {
	            width: 78%;
	        }
	        .skeleton-line-size {
	            width: 42%;
	            height: .72rem;
	            margin-bottom: 0;
	        }
	        @keyframes pixr2-skeleton-pulse {
	            from { opacity: .48; }
	            to { opacity: 1; }
	        }
	        .gallery {
	            --pixr2-card-media: 9.25rem;
	            --pixr2-card-footer: 4.85rem;
	            display: grid;
	            grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
	            gap: 1rem;
	            align-items: start;
	            transition: opacity var(--pixr2-fast) var(--pixr2-ease);
	        }
	        .gallery.is-refreshing {
	            opacity: .78;
	            pointer-events: none;
	        }
	        .gallery .item .card {
	            flex-direction: column;
	            height: calc(var(--pixr2-card-media) + var(--pixr2-card-footer));
	            min-height: 0;
	            overflow: hidden;
	        }
	        .gallery .item .card:hover {
	            transform: translateY(-3px);
	        }
	        .file-visual-shell {
	            width: 100%;
	            min-width: 0;
	            height: var(--pixr2-card-media);
	            aspect-ratio: auto;
	            border-right: 0;
	            border-bottom: 1px solid rgba(0, 0, 0, .08);
	        }
	        .gallery .item .file-image {
	            position: absolute;
	            inset: 0;
	        }
	        .file-icon-shell {
	            gap: .3rem;
	        }
	        .directory-shell {
	            background: linear-gradient(135deg, #fff8db 0%, #ffeaa7 100%);
	        }
	        .file-icon-shell .file-type-icon {
	            font-size: 4.35rem;
	        }
	        .file-icon-shell .file-type-label {
	            font-size: .72rem;
	        }
	        .file-card-footer {
	            flex: 0 0 var(--pixr2-card-footer);
	            min-width: 0;
	            height: var(--pixr2-card-footer);
	            min-height: var(--pixr2-card-footer);
	            border-top: 0;
	            padding: .75rem .85rem;
	            background-color: #fff;
	        }
	        .file-name {
	            font-size: .98rem;
	            font-weight: 600;
	        }
	        .file-subtitle {
	            font-size: .84rem;
	        }
	        .file-actions .btn {
	            width: 2.1rem;
	            height: 2.1rem;
	        }
	        .gallery .item .item-checkbox {
	            position: absolute !important;
	            top: .6rem !important;
	            right: .6rem !important;
	            width: 1.55rem;
	            height: 1.55rem;
	            margin: 0 !important;
	            opacity: 0;
	            z-index: 40;
	            cursor: pointer;
	        }
	        .selection-mark {
	            position: absolute;
	            top: .6rem;
	            right: .6rem;
	            width: 1.55rem;
	            height: 1.55rem;
	            display: inline-flex;
	            align-items: center;
	            justify-content: center;
	            border: 2px solid #6c757d;
	            border-radius: .45rem;
	            background: rgba(255, 255, 255, .96);
	            color: #fff;
	            box-shadow: 0 .25rem .65rem rgba(15, 23, 42, .18);
	            z-index: 35;
	            pointer-events: none;
	            transition:
	                background-color var(--pixr2-fast) var(--pixr2-ease),
	                border-color var(--pixr2-fast) var(--pixr2-ease),
	                transform var(--pixr2-fast) var(--pixr2-ease);
	        }
	        .selection-mark i {
	            font-size: 1rem;
	            line-height: 1;
	            opacity: 0;
	            transition: opacity var(--pixr2-fast) var(--pixr2-ease);
	        }
	        .item-checkbox:checked + .selection-mark {
	            border-color: var(--bs-primary);
	            background: var(--bs-primary);
	            transform: scale(1.03);
	        }
	        .item-checkbox:checked + .selection-mark i {
	            opacity: 1;
	        }
	        .gallery .item.selected .card {
	            border-color: var(--bs-primary);
	            background-color: rgba(13, 110, 253, .04);
	            box-shadow: 0 0 0 .18rem rgba(13, 110, 253, .18)!important;
	        }
	        .gallery .item.selected .file-card-footer {
	            background-color: rgba(13, 110, 253, .035);
	        }
	        @media (max-width: 575.98px) {
	            .gallery {
	                --pixr2-card-media: 7.5rem;
	                --pixr2-card-footer: 4.6rem;
	                grid-template-columns: repeat(auto-fill, minmax(9.75rem, 1fr));
	                gap: .75rem;
	            }
	            .file-actions .btn {
	                width: 1.9rem;
	                height: 1.9rem;
	            }
	            .file-icon-shell .file-type-icon {
	                font-size: 3.6rem;
	            }
	        }
	        .toast-container {
	            z-index: 1100;
	        }
	        .dropzone {
	            border: 2px dashed #dee2e6;
	            border-radius: .375rem;
	            cursor: pointer;
	            transition:
	                background-color var(--pixr2-normal) var(--pixr2-ease),
	                border-color var(--pixr2-normal) var(--pixr2-ease),
	                box-shadow var(--pixr2-normal) var(--pixr2-ease),
	                transform var(--pixr2-normal) var(--pixr2-ease);
	        }
	        .dropzone:hover,
	        .dropzone.active {
	            border-color: #0d6efd;
	            background-color: rgba(13, 110, 253, 0.05);
	            box-shadow: 0 .75rem 1.5rem rgba(13, 110, 253, 0.12);
	            transform: translateY(-2px);
	        }
	        .dropzone .bi {
	            transition: transform var(--pixr2-normal) var(--pixr2-ease);
	        }
	        .dropzone:hover .bi,
	        .dropzone.active .bi {
	            transform: translateY(-2px) scale(1.06);
	        }
	        .min-w-0 {
	            min-width: 0;
	        }
	        .upload-progress-wrap .progress {
	            height: .45rem;
	        }
	        .upload-progress-wrap .progress-bar {
	            transition: width 160ms var(--pixr2-ease);
	        }
	        #gallerySelectedFiles .list-group-item,
	        #galleryUploadResults .alert,
	        #galleryUploadResults .card {
	            animation: pixr2-fade-up var(--pixr2-normal) var(--pixr2-ease) both;
	        }
        .image-preview-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
	            background-color: rgba(248, 249, 250, 0.88);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1200;
            cursor: pointer;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition:
                opacity 220ms var(--pixr2-ease),
                visibility 220ms var(--pixr2-ease);
        }
        .image-preview-overlay.show {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
        }
        .preview-content {
            max-width: 90vw;
            max-height: 90vh;
            object-fit: contain;
            cursor: default;
            border-radius: .5rem;
            box-shadow: 0 1.25rem 3rem rgba(15, 23, 42, 0.28);
            opacity: 0;
            transform: scale(0.96);
            transition:
                opacity 220ms var(--pixr2-ease),
                transform 220ms var(--pixr2-ease);
        }
        .image-preview-overlay.show .preview-content {
            opacity: 1;
            transform: scale(1);
        }
        .image-preview-overlay.is-loading .preview-content {
            opacity: 0;
            transform: scale(0.98);
        }
        .preview-loader {
            position: absolute;
            inset: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transform: scale(0.96);
            transition:
                opacity var(--pixr2-normal) var(--pixr2-ease),
                transform var(--pixr2-normal) var(--pixr2-ease);
            pointer-events: none;
        }
        .image-preview-overlay.is-loading .preview-loader {
            opacity: 1;
            transform: scale(1);
        }
        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
	            background-color: rgba(248, 249, 250, 0.78);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1250;
            opacity: 0;
            visibility: hidden;
            transition:
                opacity var(--pixr2-normal) var(--pixr2-ease),
                visibility var(--pixr2-normal) var(--pixr2-ease);
        }
        .loading-overlay.show {
            opacity: 1;
            visibility: visible;
        }
        .loading-overlay .spinner-border {
            transform: scale(0.92);
            transition: transform var(--pixr2-normal) var(--pixr2-ease);
        }
        .loading-overlay.show .spinner-border {
            transform: scale(1);
        }
    </style>
    <script>
        // SVG 原始代码
        const svgIcon = \`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none"><path fill="url(#fluentColorSettings480)" d="M19.494 43.468c1.479.353 2.993.531 4.513.531a19.4 19.4 0 0 0 4.503-.534a1.94 1.94 0 0 0 1.474-1.672l.338-3.071a2.32 2.32 0 0 1 2.183-2.075c.367-.016.732.053 1.068.2l2.807 1.231a1.92 1.92 0 0 0 1.554.01c.247-.105.468-.261.65-.458a20.4 20.4 0 0 0 4.51-7.779a1.94 1.94 0 0 0-.7-2.133l-2.494-1.84a2.326 2.326 0 0 1 0-3.764l2.486-1.836a1.94 1.94 0 0 0 .7-2.138a20.3 20.3 0 0 0-4.515-7.777a1.94 1.94 0 0 0-2.192-.45l-2.806 1.236c-.29.131-.606.2-.926.2a2.34 2.34 0 0 1-2.32-2.088l-.34-3.06a1.94 1.94 0 0 0-1.5-1.681a21.7 21.7 0 0 0-4.469-.519a22 22 0 0 0-4.5.52a1.935 1.935 0 0 0-1.5 1.677l-.34 3.062a2.35 2.35 0 0 1-.768 1.488a2.53 2.53 0 0 1-1.569.6a2.3 2.3 0 0 1-.923-.194l-2.8-1.236a1.94 1.94 0 0 0-2.2.452a20.35 20.35 0 0 0-4.51 7.775a1.94 1.94 0 0 0 .7 2.137l2.488 1.836a2.344 2.344 0 0 1 .701 2.938a2.34 2.34 0 0 1-.7.829l-2.49 1.839a1.94 1.94 0 0 0-.7 2.135a20.3 20.3 0 0 0 4.51 7.782a1.93 1.93 0 0 0 2.193.454l2.818-1.237c.291-.128.605-.194.923-.194h.008a2.34 2.34 0 0 1 2.32 2.074l.338 3.057a1.94 1.94 0 0 0 1.477 1.673M24 30.25a6.25 6.25 0 1 1 0-12.5a6.25 6.25 0 0 1 0 12.5"/><defs><linearGradient id="fluentColorSettings480" x1="33.588" x2="11.226" y1="42.451" y2="7.607" gradientUnits="userSpaceOnUse"><stop stop-color="#70777d"/><stop offset="1" stop-color="#b9c0c7"/></linearGradient></defs></g></svg>\`;                 
        // 创建 blob 和 URL
        const blob = new Blob([svgIcon], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);                  
        // 创建 favicon link
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = url;                    
        // 插入到 head 中
        document.head.appendChild(link);
    </script>
</head>
<body class="bg-light">
    <header>
      <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
        <div class="container">
          <a class="navbar-brand fw-bold" href="/upload">PixR2</a>
  
          <!-- 移动端折叠按钮 -->
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarButtons" aria-controls="navbarButtons" aria-expanded="false" aria-label="切换导航">
                <span class="navbar-toggler-icon"></span>
            </button>
  
          <!-- 按钮区 -->
          <div class="collapse navbar-collapse justify-content-end" id="navbarButtons">
            <div class="d-flex flex-lg-row flex-column align-items-lg-center pt-2 pt-lg-0">
	                <button id="openUploadModalBtn" class="btn btn-primary me-lg-2 mb-2 mb-lg-0" type="button">
	                    <i class="bi bi-upload me-1"></i>上传文件
                </button>
                <button id="newFolderBtn" class="btn btn-outline-secondary me-lg-2 mb-2 mb-lg-0">
                    <i class="bi bi-folder-plus me-1"></i>新建文件夹
                </button>

                <!-- Share Dropdown -->
                <div class="btn-group me-lg-2 mb-2 mb-lg-0">
                    <button type="button" class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="bi bi-share me-1"></i>分享
                    </button>
                    <ul class="dropdown-menu">
                        <li><button id="shareFolderBtn" class="dropdown-item" type="button">分享当前文件夹</button></li>
                        <li><button id="manageSharesBtn" class="dropdown-item" type="button">管理所有分享</button></li>
                    </ul>
                </div>

                <!-- File Actions Dropdown -->
                <div class="btn-group me-lg-2 mb-2 mb-lg-0">
                    <button type="button" class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" id="actionsDropdown" disabled>
                        <i class="bi bi-pencil-square me-1"></i>操作
                    </button>
                    <ul class="dropdown-menu">
                        <li><button id="moveBtn" class="dropdown-item" type="button">移动到...</button></li>
                        <li><button id="copyBtn" class="dropdown-item" type="button">复制到...</button></li>
                    </ul>
                </div>

                <button id="deleteBtn" class="btn btn-danger" disabled>
                    <i class="bi bi-trash me-1"></i>删除
                </button>
            </div>
          </div>
        </div>
      </nav>
    </header>

    <div class="container my-4">
        <div class="card shadow-sm">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap">
                    <nav id="breadcrumb" style="--bs-breadcrumb-divider: '>';" aria-label="breadcrumb"></nav>
                    <div class="form-check" id="selectAllContainer" style="display: none;">
                        <input class="form-check-input" type="checkbox" id="selectAllCheckbox">
                        <label class="form-check-label" for="selectAllCheckbox">&nbsp全选</label>
                    </div>
                </div>

                <div class="gallery" id="gallery">
                </div>

                <nav id="paginationContainer" class="mt-4" aria-label="Page navigation">
                    <ul class="pagination justify-content-center" id="pagination"></ul>
                </nav>
            </div>
        </div>
    </div>

    <!-- Modals -->
    <div class="modal fade" id="folderModal" tabindex="-1" aria-labelledby="folderModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="folderModalLabel">新建文件夹</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <label for="folderName" class="form-label">文件夹名称</label>
                    <input type="text" id="folderName" class="form-control" placeholder="请输入文件夹名称">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                    <button type="button" id="createFolderBtn" class="btn btn-primary">创建</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="uploadModal" tabindex="-1" aria-labelledby="uploadModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="uploadModalLabel">上传文件</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="small text-muted mb-3">当前位置：<span id="uploadCurrentPath" class="font-monospace">/</span></div>
                    <div class="dropzone text-center p-5 mb-3" id="galleryDropzone">
                        <i class="bi bi-upload fs-1 text-primary"></i>
                        <p class="mt-3 mb-1">拖拽文件到此处或点击选择文件</p>
                        <p class="text-muted small mb-0">支持图片、文档、压缩包、音视频和其他常见文件</p>
                        <input type="file" id="galleryFileInput" class="d-none" multiple>
                    </div>
                    <div class="form-check form-switch mb-3">
                        <input class="form-check-input" type="checkbox" role="switch" id="galleryRandomName">
                        <label class="form-check-label" for="galleryRandomName">使用随机文件名</label>
                    </div>
                    <div id="gallerySelectedFiles" class="mb-3"></div>
                    <div id="galleryUploadResults"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">关闭</button>
                    <button type="button" id="galleryUploadBtn" class="btn btn-primary" disabled>上传文件</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="moveCopyModal" tabindex="-1" aria-labelledby="moveCopyModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="moveCopyModalLabel">选择目标文件夹</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div id="directoryTree" class="list-group" style="max-height: 300px; overflow-y: auto;"></div>
                    <div class="input-group mt-3">
                        <input type="text" id="newFolderNameInModal" class="form-control" placeholder="在此创建新文件夹">
                        <button class="btn btn-outline-secondary" type="button" id="createFolderInModalBtn">创建</button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                    <button type="button" id="confirmMoveCopyBtn" class="btn btn-primary" disabled>移动到此处</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="shareCreatedModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">分享链接已创建</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>已为文件夹 <strong id="sharedPath" class="font-monospace"></strong> 创建分享链接:</p>
                    <div class="input-group">
                        <input type="text" id="shareLinkInput" class="form-control" readonly>
                        <button class="btn btn-outline-secondary" id="copyShareLinkBtn">复制</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="manageSharesModal" tabindex="-1">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">管理分享链接</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>分享路径</th>
                                <th>链接</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="sharesList"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <div id="loading-overlay" class="loading-overlay">
        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
            <span class="visually-hidden">Loading...</span>
        </div>
    </div>

    <div class="toast-container position-fixed top-0 end-0 p-3">
        <div id="notification" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header">
                <strong class="me-auto">通知</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body"></div>
        </div>
    </div>

    <div id="imagePreview" class="image-preview-overlay">
        <div class="preview-loader"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>
        <button id="previewCloseBtn" class="btn-close position-absolute top-0 end-0 m-3 fs-4" style="z-index: 1201;"></button>
        <button id="previewPrevBtn" class="btn btn-outline-dark position-absolute top-50 start-0 translate-middle-y m-3 fs-3"><</button>
        <button id="previewNextBtn" class="btn btn-outline-dark position-absolute top-50 end-0 translate-middle-y m-3 fs-3">></button>
        <img class="preview-content" id="previewImage">
    </div>

    <script src="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.3.7/js/bootstrap.bundle.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            let currentPath = '';
            let selectedItems = [];
            let currentPage = 1;
            let loadingTimer = null;
            let loadingHideTimer = null;
            let loadingRequests = 0;
            let loadingStart = 0;
            let currentImageList = [];
            let currentImageIndex = -1;
	            let previewCloseTimer = null;
	            let previewRequestId = 0;
	            const imageCache = new Map();
	            const loadedImageUrls = new Set();
		            const galleryCache = new Map();
		            let hasRenderedGallery = false;
		            let galleryRequestId = 0;

            function escapeHtml(value = '') {
                const htmlEscapes = {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                };
                return String(value).replace(/[&<>"']/g, char => htmlEscapes[char]);
            }
            
            const galleryEl = document.getElementById('gallery');
            const breadcrumbEl = document.getElementById('breadcrumb');
            const paginationEl = document.getElementById('pagination');
            const deleteBtn = document.getElementById('deleteBtn');
            const selectAllCheckbox = document.getElementById('selectAllCheckbox');
            const selectAllContainer = document.getElementById('selectAllContainer');
            const imagePreview = document.getElementById('imagePreview');
            const previewImage = document.getElementById('previewImage');
            const loadingOverlay = document.getElementById('loading-overlay');
            const previewCloseBtn = document.getElementById('previewCloseBtn');
            const previewPrevBtn = document.getElementById('previewPrevBtn');
            const previewNextBtn = document.getElementById('previewNextBtn');
            
            const folderModal = new bootstrap.Modal(document.getElementById('folderModal'));
            const notificationToast = new bootstrap.Toast(document.getElementById('notification'));
            const shareCreatedModal = new bootstrap.Modal(document.getElementById('shareCreatedModal'));
            const manageSharesModal = new bootstrap.Modal(document.getElementById('manageSharesModal'));
            const moveCopyModal = new bootstrap.Modal(document.getElementById('moveCopyModal'));
            const uploadModalEl = document.getElementById('uploadModal');
            const uploadModal = new bootstrap.Modal(uploadModalEl);
            const sharesListEl = document.getElementById('sharesList');
            const openUploadModalBtn = document.getElementById('openUploadModalBtn');
            const galleryDropzone = document.getElementById('galleryDropzone');
            const galleryFileInput = document.getElementById('galleryFileInput');
            const gallerySelectedFilesContainer = document.getElementById('gallerySelectedFiles');
            const galleryUploadBtn = document.getElementById('galleryUploadBtn');
            const galleryRandomName = document.getElementById('galleryRandomName');
            const galleryUploadResults = document.getElementById('galleryUploadResults');
            const uploadCurrentPath = document.getElementById('uploadCurrentPath');
            
            let currentAction = ''; // 'move' or 'copy'
            let gallerySelectedFiles = [];
            let galleryUploadInProgress = false;
            let galleryUploadProgress = [];
            let galleryUploadCompleted = false;
            const MULTIPART_CHUNK_SIZE = 8 * 1024 * 1024;
            const MULTIPART_CONCURRENCY = 4;

            const urlParams = new URLSearchParams(window.location.search);
            currentPage = parseInt(urlParams.get('page')) || 1;

	            async function apiCall(endpoint, options = {}, useGlobalLoading = true) {
	                if (useGlobalLoading) showLoading(true);
	                try {
	                    const response = await fetch(endpoint, options);
	                    if (!response.ok) throw new Error('网络响应失败');
                    return await response.json();
                } catch (error) {
	                    showNotification('操作失败: ' + error.message, 'danger');
	                    return { success: false, error };
	                } finally {
	                    if (useGlobalLoading) showLoading(false);
	                }
	            }

	            async function loadGallery({ force = false } = {}) {
	                const cacheKey = \`\${currentPath}|\${currentPage}\`;
	                const cachedData = !force ? galleryCache.get(cacheKey) : null;
	                const requestId = ++galleryRequestId;

	                if (cachedData) {
	                    applyGalleryData(cachedData);
	                } else if (!hasRenderedGallery) {
	                    renderGalleryLoading();
	                } else {
	                    galleryEl.classList.add('is-refreshing');
	                }

	                const data = await apiCall(\`/api/list?prefix=\${encodeURIComponent(currentPath)}&page=\${currentPage}\`, {}, false);
	                if (requestId !== galleryRequestId) return;
	                galleryEl.classList.remove('is-refreshing');

	                if (data && data.success) {
	                    galleryCache.set(cacheKey, data);
	                    if (!cachedData || JSON.stringify(cachedData) !== JSON.stringify(data)) {
	                        applyGalleryData(data);
	                    }
	                } else if (!cachedData) {
	                    galleryEl.innerHTML = '<div class="col"><p class="text-danger">加载失败，请稍后再试。</p></div>';
	                }
	            }

	            function applyGalleryData(data) {
	                updateBreadcrumb();
	                renderGallery(data.directories, data.files);
	                renderPagination(data.pagination);
	                selectedItems = [];
	                hasRenderedGallery = true;
	                updateControls();
	            }

	            function refreshGallery() {
	                galleryCache.clear();
	                loadGallery({ force: true });
	            }

	            function renderGalleryLoading(count = 8) {
	                galleryEl.innerHTML = Array.from({ length: count }, (_, index) => \`
	                    <div class="col item gallery-placeholder" aria-hidden="true" style="animation-delay: \${index * 18}ms">
	                        <div class="card h-100">
	                            <div class="file-visual-shell skeleton-block"></div>
	                            <div class="card-footer file-card-footer text-body-secondary small">
	                                <div class="file-meta w-100">
	                                    <span class="skeleton-line skeleton-line-name"></span>
	                                    <span class="skeleton-line skeleton-line-size"></span>
	                                </div>
	                            </div>
	                        </div>
	                    </div>
	                \`).join('');
	            }

	            function updateBreadcrumb() {
                breadcrumbEl.innerHTML = '<ol class="breadcrumb mb-0"></ol>';
                const ol = breadcrumbEl.querySelector('ol');
                let path = '';
                const homeItem = document.createElement('li');
                homeItem.className = 'breadcrumb-item';
                homeItem.innerHTML = '<a href="#" data-path="">首页</a>';
                ol.appendChild(homeItem);

                if (currentPath) {
                    const parts = currentPath.replace(/\\/$/, '').split('/');
                    parts.forEach((part, index) => {
	                        if(!part) return;
	                        path += part + '/';
	                        const item = document.createElement('li');
	                        item.className = 'breadcrumb-item';
	                        item.innerHTML = \`<a href="#" data-path="\${escapeHtml(path)}">\${escapeHtml(part)}</a>\`;
	                        ol.appendChild(item);
	                    });
	                }
	                ol.lastChild.classList.add('active');
	                ol.lastChild.setAttribute('aria-current', 'page');
	                ol.lastChild.textContent = ol.lastChild.textContent;
	            }

            breadcrumbEl.addEventListener('click', e => {
                if (e.target.tagName === 'A' && e.target.dataset.path !== undefined) {
                    e.preventDefault();
                    currentPath = e.target.dataset.path;
                    currentPage = 1;
                    const url = new URL(window.location);
                    url.searchParams.delete('page');
                    window.history.pushState({}, '', url);
	                    loadGallery();
                }
            });

            function renderGallery(directories, files) {
                galleryEl.innerHTML = '';
                currentImageList = files
                    .filter(file => file.name !== '.null' && file.isImage)
                    .map(file => file.url);

                const items = [
                    ...directories.map(dir => ({...dir, isDir: true})),
                    ...files.map(file => ({...file, isFile: true}))
                ];
                selectAllContainer.style.display = items.length > 0 ? 'flex' : 'none';

                if (items.length === 0) {
                    galleryEl.innerHTML = '<div class="col"><p class="text-muted">当前文件夹为空</p></div>';
                    return;
                }

	                items.forEach(item => {
	                    const col = document.createElement('div');
	                    col.className = 'col item';
	                    const safeName = escapeHtml(item.name || '');
	                    const safePath = escapeHtml(item.path || '');
	                    const safeUrl = escapeHtml(item.url || '');
	                    const safeDirectUrl = escapeHtml(item.directUrl || item.url || '');
	                    const safeIconClass = escapeHtml(item.iconClass || 'bi-file-earmark');
	                    const safeLabel = escapeHtml(item.label || '文件');
	                    const imageAlreadyLoaded = item.isImage && loadedImageUrls.has(item.url);
		                    if (item.isDir) {
		                        col.dataset.itemType = 'directory';
		                        col.dataset.path = item.path;
		                        col.innerHTML = \`
		                            <div class="card h-100 position-relative" data-path="\${safePath}">
		                                <input type="checkbox" class="form-check-input checkbox item-checkbox position-absolute top-0 end-0 m-2">
		                                <span class="selection-mark" aria-hidden="true"><i class="bi bi-check2"></i></span>
		                                <div class="file-visual-shell file-icon-shell directory-shell">
		                                    <i class="bi bi-folder-fill file-type-icon"></i>
		                                </div>
		                                <div class="card-footer file-card-footer text-body-secondary small">
		                                    <div class="file-meta w-100">
		                                        <p class="card-text file-name text-truncate mb-1" title="\${safeName}">\${safeName}</p>
		                                        <p class="card-text file-subtitle mb-0">文件夹</p>
		                                    </div>
		                                </div>
		                            </div>
		                        \`;
	                    } else { // isFile
                       col.dataset.key = item.key;
                       col.dataset.itemType = 'file';
                       if (item.isImage) col.dataset.previewUrl = item.url;
                       col.innerHTML = \`
                           <div class="card h-100 position-relative">
                               <input type="checkbox" class="form-check-input checkbox item-checkbox position-absolute top-0 end-0 m-2">
                               <span class="selection-mark" aria-hidden="true"><i class="bi bi-check2"></i></span>
	                               \${item.name === '.null'
	                                   ? '<div class="card-body text-center d-flex flex-column justify-content-center align-items-center"><i class="bi bi-file-earmark-binary fs-1"></i></div>'
		                                   : item.isImage
		                                       ? \`
		                                           <div class="file-visual-shell file-image-shell\${imageAlreadyLoaded ? ' loaded' : ''}">
		                                               <img \${imageAlreadyLoaded ? \`src="\${safeUrl}"\` : \`data-src="\${safeUrl}"\`} class="card-img-top file-image\${imageAlreadyLoaded ? ' loaded' : ' lazyload'}" alt="\${safeName}" loading="\${imageAlreadyLoaded ? 'eager' : 'lazy'}">
		                                               <div class="image-loading-indicator">
		                                                   <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
		                                               </div>
		                                           </div>
		                                       \`
		                                       : \`
		                                           <div class="file-visual-shell file-icon-shell">
		                                               <i class="bi \${safeIconClass} file-type-icon"></i>
		                                               <span class="file-type-label text-truncate">\${safeLabel}</span>
		                                           </div>
		                                       \`
		                               }
	                               <div class="card-footer file-card-footer text-body-secondary small">
		                                   <div class="d-flex justify-content-between align-items-center w-100 gap-2">
		                                       <div class="file-meta flex-grow-1">
		                                           <p class="card-text file-name text-truncate mb-1" title="\${safeName}">\${safeName}</p>
		                                           <p class="card-text file-subtitle mb-0">\${formatFileSize(item.size)}</p>
		                                       </div>
		                                       \${item.name !== '.null' ? \`
		                                           <div class="btn-group flex-shrink-0 file-actions">
		                                               <button class="btn btn-sm btn-outline-secondary copy-direct-url-btn" data-url="\${safeDirectUrl}" title="复制直链"><i class="bi bi-link-45deg"></i></button>
		                                           </div>
		                                       \` : ''}
                                   </div>
                               </div>
                           </div>
                       \`;
                    }
                    galleryEl.appendChild(col);
                });
                observeLazyLoad();
            }
            
            function observeLazyLoad() {
               const lazyImages = document.querySelectorAll('.lazyload');
               const imageObserver = new IntersectionObserver((entries, observer) => {
                   entries.forEach(entry => {
                       if (entry.isIntersecting) {
                           const image = entry.target;
                           loadGalleryImage(image);
                           observer.unobserve(image);
                       }
                   });
               });

               lazyImages.forEach(image => {
                   imageObserver.observe(image);
               });
           }

            function preloadImage(url) {
                if (!url) return Promise.resolve();
                if (imageCache.has(url)) return imageCache.get(url);

                const promise = new Promise(resolve => {
                    const image = new Image();
                    image.decoding = 'async';
                    const done = () => {
                        loadedImageUrls.add(url);
                        resolve(url);
                    };
                    image.onload = done;
                    image.onerror = done;
                    image.src = url;
                });
                imageCache.set(url, promise);
                return promise;
            }

	            function loadGalleryImage(image) {
	                const src = image.dataset.src;
	                if (!src || image.dataset.loading === 'true') return;
	                image.dataset.loading = 'true';

	                const shell = image.closest('.file-image-shell');
	                const markLoaded = () => requestAnimationFrame(() => {
	                    loadedImageUrls.add(src);
	                    image.classList.add('loaded');
	                    if (shell) shell.classList.add('loaded');
	                });

	                let loadPromise = imageCache.get(src);
	                if (!loadPromise) {
	                    loadPromise = new Promise(resolve => {
	                        const done = () => {
	                            image.onload = null;
	                            image.onerror = null;
	                            loadedImageUrls.add(src);
	                            resolve(src);
	                        };
	                        image.onload = done;
	                        image.onerror = done;
	                        image.src = src;
	                        if (image.complete) done();
	                    });
	                    imageCache.set(src, loadPromise);
	                } else {
	                    image.src = src;
	                }

	                image.classList.remove('lazyload');
	                loadPromise.then(markLoaded);
	            }

            function preloadAdjacentImages() {
                [currentImageIndex - 1, currentImageIndex + 1].forEach(index => {
                    if (index >= 0 && index < currentImageList.length) {
                        preloadImage(currentImageList[index]);
                    }
                });
            }

            function writeToClipboard(text) {
                if (navigator.clipboard && window.isSecureContext) {
                    return navigator.clipboard.writeText(text);
                }

                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                const copied = document.execCommand('copy');
                textarea.remove();
                return copied ? Promise.resolve() : Promise.reject(new Error('Copy failed'));
            }

            function copyDirectUrl(button) {
                const url = button.dataset.url;
                if (!url) return;
                const originalHtml = button.innerHTML;
                const originalClassName = button.className;
                writeToClipboard(url).then(() => {
                    button.className = 'btn btn-sm btn-success copy-direct-url-btn';
                    button.innerHTML = '<i class="bi bi-check2"></i>';
                    showNotification('文件直链已复制', 'success');
                    setTimeout(() => {
                        button.className = originalClassName;
                        button.innerHTML = originalHtml;
                    }, 1200);
                }).catch(() => showNotification('复制失败，请手动复制', 'danger'));
            }

            function getSelectionFromElement(itemEl) {
                if (itemEl.dataset.itemType === 'directory') {
                    return { type: 'directory', path: itemEl.dataset.path };
                }
                return { type: 'file', key: itemEl.dataset.key };
            }

            function getSelectionId(selection) {
                return selection.type === 'directory' ? \`directory:\${selection.path}\` : \`file:\${selection.key}\`;
            }

            function getSelectedFileKeys() {
                return selectedItems.filter(item => item.type === 'file').map(item => item.key);
            }

            function hasSelectedDirectory() {
                return selectedItems.some(item => item.type === 'directory');
            }

            function toggleSelection(itemEl, checked = null) {
                const selection = getSelectionFromElement(itemEl);
                if (!selection.key && !selection.path) return;

                const selectionId = getSelectionId(selection);
                const index = selectedItems.findIndex(item => getSelectionId(item) === selectionId);
                const shouldSelect = checked === null ? index === -1 : checked;
                const checkbox = itemEl.querySelector('.item-checkbox');

                if (shouldSelect && index === -1) {
                    selectedItems.push(selection);
                    itemEl.classList.add('selected');
                    if (checkbox) checkbox.checked = true;
                } else if (!shouldSelect && index > -1) {
                    selectedItems.splice(index, 1);
                    itemEl.classList.remove('selected');
                    if (checkbox) checkbox.checked = false;
                } else if (checkbox) {
                    checkbox.checked = shouldSelect;
                }
                updateControls();
            }

            galleryEl.addEventListener('click', e => {
                const itemEl = e.target.closest('.item');
                if (!itemEl) return;

                const checkbox = e.target.closest('.item-checkbox');
                if (checkbox) {
                    e.stopPropagation();
                    toggleSelection(itemEl, checkbox.checked);
                    return;
                }

                const dirCard = itemEl.querySelector('.card[data-path]');
                if (dirCard) {
                    currentPath = dirCard.dataset.path;
                    currentPage = 1;
	                    loadGallery();
                    return;
                }

                if (itemEl.dataset.key) {
                    const copyBtn = e.target.closest('.copy-direct-url-btn');
                    if (copyBtn) {
                        e.stopPropagation();
                        copyDirectUrl(copyBtn);
                        return;
                    }

                    if (itemEl.dataset.previewUrl) {
                        e.stopPropagation();
                        openPreview(itemEl.dataset.previewUrl);
                        return;
                    }

                    const isSelectableTarget = e.target.classList.contains('checkbox') ||
                                               e.target.closest('.file-icon-shell') ||
                                               e.target.classList.contains('bi-file-earmark-binary') ||
                                               e.target.closest('.card-footer');

                    if (isSelectableTarget) {
                        toggleSelection(itemEl);
                    }
                }
            });

            function renderPagination({ totalPages }) {
                paginationEl.innerHTML = '';
                if (totalPages <= 1) return;

                const createPageItem = (page, text, isActive = false, isDisabled = false) => {
                    const li = document.createElement('li');
                    li.className = \`page-item \${isActive ? 'active' : ''} \${isDisabled ? 'disabled' : ''}\`;
                    li.innerHTML = \`<a class="page-link" href="#" data-page="\${page}">\${text}</a>\`;
                    return li;
                };

                paginationEl.appendChild(createPageItem(currentPage - 1, '«', false, currentPage === 1));
                for (let i = 1; i <= totalPages; i++) {
                    paginationEl.appendChild(createPageItem(i, i, i === currentPage));
                }
                paginationEl.appendChild(createPageItem(currentPage + 1, '»', false, currentPage === totalPages));
            }

            paginationEl.addEventListener('click', e => {
                if (e.target.tagName === 'A' && e.target.dataset.page) {
                    e.preventDefault();
                    const page = parseInt(e.target.dataset.page);
                    if (page !== currentPage && page > 0 && !isNaN(page)) {
                        currentPage = page;
                        const url = new URL(window.location);
                        url.searchParams.set('page', currentPage);
                        window.history.pushState({}, '', url);
	                        loadGallery();
                    }
                }
            });

            function updateControls() {
                const numItems = galleryEl.querySelectorAll('.item[data-item-type]').length;
                const hasSelection = selectedItems.length > 0;
                deleteBtn.disabled = !hasSelection;
                document.getElementById('actionsDropdown').disabled = !hasSelection || hasSelectedDirectory() || getSelectedFileKeys().length === 0;
                selectAllCheckbox.checked = numItems > 0 && selectedItems.length === numItems;
                selectAllCheckbox.indeterminate = selectedItems.length > 0 && selectedItems.length < numItems;
            }

            selectAllCheckbox.addEventListener('change', () => {
                const selectableItems = galleryEl.querySelectorAll('.item[data-item-type]');
                selectedItems = [];
                selectableItems.forEach(item => {
                    const checkbox = item.querySelector('.item-checkbox');
                    if (selectAllCheckbox.checked) {
                        selectedItems.push(getSelectionFromElement(item));
                        item.classList.add('selected');
                        checkbox.checked = true;
                    } else {
                        item.classList.remove('selected');
                        checkbox.checked = false;
                    }
                });
                updateControls();
            });

            function getClientFileIcon(file) {
                const name = file.name.toLowerCase();
                const type = (file.type || '').toLowerCase();
                const ext = name.includes('.') ? name.split('.').pop() : '';
                if (type.startsWith('image/')) return 'bi-file-earmark-image';
                if (type.startsWith('video/')) return 'bi-file-earmark-play';
                if (type.startsWith('audio/')) return 'bi-file-earmark-music';
                if (ext === 'pdf') return 'bi-file-earmark-pdf';
                if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'bi-file-earmark-zip';
                if (['doc', 'docx'].includes(ext)) return 'bi-file-earmark-word';
                if (['xls', 'xlsx', 'csv'].includes(ext)) return 'bi-file-earmark-spreadsheet';
                if (['ppt', 'pptx'].includes(ext)) return 'bi-file-earmark-slides';
                if (['js', 'ts', 'html', 'css', 'json', 'md', 'py', 'go', 'rs', 'java', 'php', 'sh'].includes(ext)) return 'bi-file-earmark-code';
                if (type.startsWith('text/') || ['txt', 'log'].includes(ext)) return 'bi-file-earmark-text';
                return 'bi-file-earmark';
            }

            function resetGalleryUpload() {
                gallerySelectedFiles = [];
                galleryUploadProgress = [];
                galleryUploadInProgress = false;
                galleryUploadCompleted = false;
                gallerySelectedFilesContainer.innerHTML = '';
                galleryUploadResults.innerHTML = '';
                galleryFileInput.value = '';
                galleryRandomName.checked = false;
                galleryUploadBtn.disabled = true;
                galleryUploadBtn.textContent = '上传文件';
            }

            function updateGalleryUploadPreview() {
                gallerySelectedFilesContainer.innerHTML = '';
                if (gallerySelectedFiles.length === 0) {
                    galleryUploadBtn.disabled = true;
                    return;
                }

                const list = document.createElement('ul');
                list.className = 'list-group';
                gallerySelectedFiles.forEach((file, index) => {
                    const item = document.createElement('li');
                    const safeName = escapeHtml(file.name);
                    const progress = galleryUploadProgress[index] || { percent: 0, status: '等待上传' };
                    const progressPercent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
                    const progressClass = progress.error ? 'bg-danger' : progress.done ? 'bg-success' : '';
                    item.className = 'list-group-item d-flex justify-content-between align-items-center gap-3';
                    item.innerHTML = \`
                        <div class="flex-grow-1 min-w-0">
                            <div class="d-flex align-items-center min-w-0">
                                <i class="bi \${getClientFileIcon(file)} me-2 text-secondary flex-shrink-0"></i>
                                <span class="text-truncate" title="\${safeName}">\${safeName}</span>
                                <small class="text-muted ms-2 flex-shrink-0">\${formatFileSize(file.size)}</small>
                            </div>
                            \${galleryUploadInProgress ? \`
                                <div class="upload-progress-wrap mt-2" data-index="\${index}">
                                    <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="\${progressPercent}">
                                        <div class="progress-bar \${progressClass}" style="width: \${progressPercent}%"></div>
                                    </div>
                                    <div class="small text-muted mt-1 upload-progress-label">\${escapeHtml(progress.status || progressPercent + '%')}</div>
                                </div>
                            \` : ''}
                        </div>
                        <button type="button" class="btn-close" aria-label="Remove" data-index="\${index}" \${galleryUploadInProgress ? 'disabled' : ''}></button>
                    \`;
                    list.appendChild(item);
                });
                gallerySelectedFilesContainer.appendChild(list);
                galleryUploadBtn.disabled = galleryUploadInProgress || gallerySelectedFiles.length === 0;

                gallerySelectedFilesContainer.querySelectorAll('.btn-close').forEach(btn => {
                    btn.addEventListener('click', event => {
                        if (galleryUploadInProgress) return;
                        const index = parseInt(event.currentTarget.dataset.index);
                        gallerySelectedFiles.splice(index, 1);
                        updateGalleryUploadPreview();
                    });
                });
            }

            function handleGalleryUploadFiles(files) {
                if (galleryUploadInProgress) return;
                const validFiles = Array.from(files).filter(file => file && file.name);
                if (validFiles.length === 0) return;
                galleryUploadResults.innerHTML = '';
                gallerySelectedFiles = [...gallerySelectedFiles, ...validFiles];
                updateGalleryUploadPreview();
            }

            function setGalleryUploadProgress(index, state) {
                galleryUploadProgress[index] = { ...(galleryUploadProgress[index] || {}), ...state };
                const progress = galleryUploadProgress[index];
                const progressPercent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
                const wrap = gallerySelectedFilesContainer.querySelector(\`.upload-progress-wrap[data-index="\${index}"]\`);
                if (!wrap) return;

                const progressElement = wrap.querySelector('.progress');
                const progressBar = wrap.querySelector('.progress-bar');
                const progressLabel = wrap.querySelector('.upload-progress-label');
                if (progressElement) progressElement.setAttribute('aria-valuenow', String(progressPercent));
                if (progressBar) {
                    progressBar.style.width = progressPercent + '%';
                    progressBar.classList.toggle('bg-success', !!progress.done);
                    progressBar.classList.toggle('bg-danger', !!progress.error);
                }
                if (progressLabel) progressLabel.textContent = progress.status || progressPercent + '%';
            }

            async function postUploadJson(endpoint, payload) {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.success) {
                    throw new Error(data.message || '上传失败');
                }
                return data;
            }

            function uploadGalleryChunk(uploadUrl, chunk, contentType, onProgress) {
                return new Promise(resolve => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', uploadUrl);
                    xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');

                    xhr.upload.onprogress = event => {
                        if (event.lengthComputable) {
                            onProgress(event.loaded);
                        }
                    };

                    xhr.onload = () => {
                        let response = {};
                        try {
                            response = JSON.parse(xhr.responseText || '{}');
                        } catch {
                            response = {};
                        }
                        if (xhr.status >= 200 && xhr.status < 300 && !response.error) {
                            resolve(response);
                            return;
                        }
                        resolve({ error: true, message: response.message || '上传失败' });
                    };

                    xhr.onerror = () => {
                        resolve({ error: true, message: '网络错误' });
                    };

                    xhr.send(chunk);
                });
            }

            async function uploadGalleryFile(file, index) {
                let multipartUpload = null;
                try {
                    const contentType = file.type || 'application/octet-stream';
                    setGalleryUploadProgress(index, { percent: 0, status: '准备上传' });
                    multipartUpload = await postUploadJson('/api/upload/multipart/create', {
                        filename: file.name,
                        path: currentPath,
                        randomName: galleryRandomName.checked,
                        contentType
                    });

                    const totalParts = Math.max(1, Math.ceil(file.size / MULTIPART_CHUNK_SIZE));
                    const uploadedParts = new Array(totalParts);
                    const partLoadedBytes = new Array(totalParts).fill(0);
                    const parallelCount = Math.min(MULTIPART_CONCURRENCY, totalParts);
                    let nextPartNumber = 1;
                    let completedParts = 0;
                    let failed = false;
                    const errors = [];

                    const updateTotalProgress = (partNumber, loaded) => {
                        partLoadedBytes[partNumber - 1] = loaded;
                        const uploadedBytes = partLoadedBytes.reduce((sum, value) => sum + value, 0);
                        const percent = file.size > 0 ? Math.round((uploadedBytes / file.size) * 100) : 100;
                        setGalleryUploadProgress(index, {
                            percent,
                            status: \`上传中 \${percent}%（\${completedParts}/\${totalParts}，并发 \${parallelCount}）\`
                        });
                    };

                    const uploadPart = async partNumber => {
                        const start = (partNumber - 1) * MULTIPART_CHUNK_SIZE;
                        const end = Math.min(start + MULTIPART_CHUNK_SIZE, file.size);
                        const chunk = file.slice(start, end);
                        const partUrl = new URL('/api/upload/multipart/part', window.location.origin);
                        partUrl.searchParams.set('key', multipartUpload.key);
                        partUrl.searchParams.set('uploadId', multipartUpload.uploadId);
                        partUrl.searchParams.set('partNumber', String(partNumber));

                        const partResult = await uploadGalleryChunk(
                            partUrl.pathname + partUrl.search,
                            chunk,
                            contentType,
                            loaded => updateTotalProgress(partNumber, loaded)
                        );

                        if (partResult.error || !partResult.part) {
                            throw new Error(partResult.message || '上传分片失败');
                        }
                        uploadedParts[partNumber - 1] = partResult.part;
                        completedParts += 1;
                        updateTotalProgress(partNumber, end - start);
                        const uploadedBytes = partLoadedBytes.reduce((sum, value) => sum + value, 0);
                        const percent = file.size > 0 ? Math.round((uploadedBytes / file.size) * 100) : 100;
                        setGalleryUploadProgress(index, {
                            percent,
                            status: \`上传中 \${percent}%（\${completedParts}/\${totalParts}，并发 \${parallelCount}）\`
                        });
                    };

                    const workers = Array.from({ length: parallelCount }, async () => {
                        while (!failed && nextPartNumber <= totalParts) {
                            const partNumber = nextPartNumber++;
                            try {
                                await uploadPart(partNumber);
                            } catch (error) {
                                failed = true;
                                errors.push(error);
                            }
                        }
                    });

                    await Promise.all(workers);
                    if (errors.length > 0) throw errors[0];

                    const completedUpload = await postUploadJson('/api/upload/multipart/complete', {
                        key: multipartUpload.key,
                        uploadId: multipartUpload.uploadId,
                        parts: uploadedParts.filter(Boolean),
                        contentType: multipartUpload.contentType
                    });

                    setGalleryUploadProgress(index, { percent: 100, status: '上传完成', done: true });
                    return completedUpload;
                } catch (error) {
                    if (multipartUpload?.key && multipartUpload?.uploadId) {
                        await postUploadJson('/api/upload/multipart/abort', {
                            key: multipartUpload.key,
                            uploadId: multipartUpload.uploadId
                        }).catch(() => {});
                    }
                    setGalleryUploadProgress(index, { status: '上传失败', error: true });
                    return { error: true, message: error.message || '上传失败', name: file.name };
                }
            }

            function displayGalleryUploadResults(results) {
                galleryUploadResults.innerHTML = '';
                const successfulUploads = results.filter(result => !result.error);
                const failedUploads = results.filter(result => result.error);

                if (failedUploads.length > 0) {
                    const errorAlert = document.createElement('div');
                    const failedNames = failedUploads.map(file => escapeHtml(file.name || '未知文件')).join(', ');
                    errorAlert.className = 'alert alert-danger';
                    errorAlert.innerHTML = \`<strong>\${failedUploads.length} 个文件上传失败:</strong> \${failedNames}\`;
                    galleryUploadResults.appendChild(errorAlert);
                }

                successfulUploads.forEach(result => {
                    const linkItem = document.createElement('div');
                    const safeKey = escapeHtml(result.key || '');
                    const safeUrl = escapeHtml(result.url || '');
                    const safeMarkdown = escapeHtml(result.markdown || '');
                    linkItem.className = 'card mb-3';
                    linkItem.innerHTML = \`
                        <div class="card-header">\${safeKey}</div>
                        <div class="card-body">
                            <div class="mb-2">
                                <label class="form-label small">直接链接</label>
                                <div class="input-group">
                                    <input type="text" class="form-control form-control-sm" value="\${safeUrl}" readonly>
                                    <button class="btn btn-outline-secondary btn-sm upload-copy-btn" data-text="\${safeUrl}">复制</button>
                                </div>
                            </div>
                            <div>
                                <label class="form-label small">Markdown</label>
                                <div class="input-group">
                                    <input type="text" class="form-control form-control-sm" value="\${safeMarkdown}" readonly>
                                    <button class="btn btn-outline-secondary btn-sm upload-copy-btn" data-text="\${safeMarkdown}">复制</button>
                                </div>
                            </div>
                        </div>
                    \`;
                    galleryUploadResults.appendChild(linkItem);
                });

                galleryUploadResults.querySelectorAll('.upload-copy-btn').forEach(btn => {
                    btn.addEventListener('click', event => {
                        const button = event.currentTarget;
                        writeToClipboard(button.dataset.text).then(() => {
                            const originalText = button.textContent;
                            button.textContent = '已复制';
                            setTimeout(() => { button.textContent = originalText; }, 1500);
                        });
                    });
                });
            }

            openUploadModalBtn.addEventListener('click', () => {
                resetGalleryUpload();
                uploadCurrentPath.textContent = currentPath || '/';
                uploadModal.show();
            });

            uploadModalEl.addEventListener('hide.bs.modal', event => {
                if (galleryUploadInProgress) {
                    event.preventDefault();
                }
            });

            uploadModalEl.addEventListener('hidden.bs.modal', () => {
                if (!galleryUploadInProgress) resetGalleryUpload();
            });

            galleryDropzone.addEventListener('click', () => galleryFileInput.click());
            galleryDropzone.addEventListener('dragover', event => {
                event.preventDefault();
                galleryDropzone.classList.add('active');
            });
            galleryDropzone.addEventListener('dragleave', () => galleryDropzone.classList.remove('active'));
            galleryDropzone.addEventListener('drop', event => {
                event.preventDefault();
                galleryDropzone.classList.remove('active');
                handleGalleryUploadFiles(event.dataTransfer.files);
            });
            galleryFileInput.addEventListener('change', () => handleGalleryUploadFiles(galleryFileInput.files));

            galleryUploadBtn.addEventListener('click', async () => {
                if (gallerySelectedFiles.length === 0 || galleryUploadInProgress) return;
                galleryUploadBtn.disabled = true;
                galleryUploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 上传中...';
                galleryUploadInProgress = true;
                galleryUploadProgress = gallerySelectedFiles.map(() => ({ percent: 0, status: '等待上传' }));
                updateGalleryUploadPreview();

                const results = await Promise.all(gallerySelectedFiles.map((file, index) => uploadGalleryFile(file, index)));
                displayGalleryUploadResults(results);

                galleryUploadInProgress = false;
                galleryUploadCompleted = results.some(result => !result.error);
                gallerySelectedFiles = [];
                galleryUploadProgress = [];
                updateGalleryUploadPreview();
                galleryUploadBtn.textContent = '上传文件';
                galleryUploadBtn.disabled = true;
                galleryFileInput.value = '';
                if (galleryUploadCompleted) {
                    showNotification('上传完成', 'success');
                    refreshGallery();
                }
            });

            document.getElementById('newFolderBtn').addEventListener('click', () => folderModal.show());
            document.getElementById('createFolderBtn').addEventListener('click', async () => {
                const folderName = document.getElementById('folderName').value.trim();
                if (!folderName) return;
                const path = currentPath + folderName + '/';
                const result = await apiCall('/api/create-folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path })
                });
                if (result.success) {
                    folderModal.hide();
                    document.getElementById('folderName').value = '';
                    showNotification('文件夹创建成功', 'success');
	                    refreshGallery();
                }
            });

            deleteBtn.addEventListener('click', async () => {
                const deleteMessage = hasSelectedDirectory()
                    ? \`确定要删除选中的 \${selectedItems.length} 个项目吗？文件夹内所有内容都会被删除。\`
                    : \`确定要删除选中的 \${selectedItems.length} 个项目吗？\`;
                if (selectedItems.length === 0 || !confirm(deleteMessage)) return;
                const result = await apiCall('/api/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: selectedItems })
                });
                if (result.success) {
                    showNotification('删除成功', 'success');
	                    refreshGallery();
                }
            });

            document.getElementById('shareFolderBtn').addEventListener('click', async () => {
                const result = await apiCall('/api/share/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: currentPath })
                });
                if (result.success) {
                    document.getElementById('sharedPath').textContent = result.path || '/';
                    document.getElementById('shareLinkInput').value = result.url;
                    shareCreatedModal.show();
                }
            });

            document.getElementById('copyShareLinkBtn').addEventListener('click', (e) => {
                const input = document.getElementById('shareLinkInput');
                navigator.clipboard.writeText(input.value).then(() => {
                    const btn = e.currentTarget;
                    const originalText = btn.textContent;
                    btn.textContent = '已复制!';
                    setTimeout(() => { btn.textContent = originalText; }, 2000);
                });
            });

            document.getElementById('manageSharesBtn').addEventListener('click', async () => {
                const result = await apiCall('/api/share/list');
                if (result.success) {
                    sharesListEl.innerHTML = '';
                    if (result.shares.length === 0) {
                        sharesListEl.innerHTML = '<tr><td colspan="3" class="text-center">没有已创建的分享链接</td></tr>';
                    } else {
                        result.shares.forEach(share => {
                            const tr = document.createElement('tr');
                            tr.innerHTML = \`
                                <td><span class="font-monospace">\${share.path || '/'}</span></td>
                                <td><a href="\${share.url}" target="_blank">\${share.url}</a></td>
                                <td>
                                    <button class="btn btn-sm btn-danger revoke-share-btn" data-share-id="\${share.shareId}">撤销</button>
                                </td>
                            \`;
                            sharesListEl.appendChild(tr);
                        });
                    }
                    manageSharesModal.show();
                }
            });

            sharesListEl.addEventListener('click', async (e) => {
                if (e.target.classList.contains('revoke-share-btn')) {
                    const shareId = e.target.dataset.shareId;
                    if (confirm(\`确定要撤销这个分享链接吗？\`)) {
                        const result = await apiCall('/api/share/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ shareId })
                        });
                        if (result.success) {
                            showNotification('分享链接已撤销', 'success');
                            e.target.closest('tr').remove();
                            if (sharesListEl.children.length === 0) {
                                sharesListEl.innerHTML = '<tr><td colspan="3" class="text-center">没有已创建的分享链接</td></tr>';
                            }
                        }
                    }
                }
            });

            let selectedDestination = null;

            function setupMoveCopy(action) {
                if (hasSelectedDirectory()) {
                    showNotification('文件夹暂不支持移动或复制，请只选择文件', 'danger');
                    return;
                }
                currentAction = action;
                const confirmBtn = document.getElementById('confirmMoveCopyBtn');
                confirmBtn.textContent = action === 'move' ? '移动到此处' : '复制到此处';
                selectedDestination = null;
                confirmBtn.disabled = true;
                loadDirectoryTree();
                moveCopyModal.show();
            }

            async function loadDirectoryTree() {
                const treeContainer = document.getElementById('directoryTree');
                treeContainer.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div></div>';
                const data = await apiCall('/api/directories');
                if (data.success) {
                    renderDirectoryTree(data.directories, treeContainer);
                } else {
                    treeContainer.innerHTML = '<p class="text-danger">无法加载目录</p>';
                }
            }

            function renderDirectoryTree(nodes, container) {
                container.innerHTML = '';

                const buildTree = (parentPath, parentElement, level) => {
                    const children = nodes.filter(n => n.parent === parentPath);
                    
                    children.forEach(node => {
                        const hasChildren = nodes.some(n => n.parent === node.path);
                        
                        const item = document.createElement('a');
                        item.href = '#';
                        item.className = 'list-group-item list-group-item-action';
                        item.dataset.path = node.path;
                        item.style.paddingLeft = (1.25 + level * 1.5) + 'rem';

                        let togglerHtml = '';
                        
                        if (hasChildren) {
                            const targetId = 'tree-' + node.path.replace(/[^a-zA-Z0-9]/g, '-');
                            item.setAttribute('data-bs-toggle', 'collapse');
                            item.setAttribute('data-bs-target', '#' + targetId);
                            togglerHtml = '<i class="bi bi-chevron-right me-2 toggle-icon"></i>';
                        } else {
                            togglerHtml = '<span class="me-2" style="width: 1em; display: inline-block;"></span>';
                        }

                        item.innerHTML = togglerHtml + '<i class="bi bi-folder me-2"></i> ' + node.name;
                        parentElement.appendChild(item);

                        if (hasChildren) {
                            const subContainer = document.createElement('div');
                            subContainer.className = 'collapse';
                            subContainer.id = 'tree-' + node.path.replace(/[^a-zA-Z0-9]/g, '-');
                            buildTree(node.path, subContainer, level + 1);
                            parentElement.appendChild(subContainer);
                        }
                    });
                };

                const rootItem = document.createElement('a');
                rootItem.href = '#';
                rootItem.className = 'list-group-item list-group-item-action';
                rootItem.dataset.path = '/';
                rootItem.innerHTML = '<i class="bi bi-folder-fill me-2"></i> 根目录';
                container.appendChild(rootItem);

                buildTree('/', container, 0);
            }

            document.getElementById('directoryTree').addEventListener('click', (e) => {
                e.preventDefault();
                const target = e.target.closest('.list-group-item');
                if (target) {
                    document.querySelectorAll('#directoryTree .list-group-item').forEach(i => i.classList.remove('active'));
                    target.classList.add('active');
                    selectedDestination = target.dataset.path;
                    document.getElementById('confirmMoveCopyBtn').disabled = false;

                    const icon = target.querySelector('.toggle-icon');
                    if (icon) {
                        icon.classList.toggle('bi-chevron-right');
                        icon.classList.toggle('bi-chevron-down');
                    }
                }
            });

            document.getElementById('createFolderInModalBtn').addEventListener('click', async () => {
                const newNameInput = document.getElementById('newFolderNameInModal');
                const folderName = newNameInput.value.trim();
                if (!folderName || !selectedDestination) {
                    showNotification('请先选择一个父目录并输入文件夹名称', 'danger');
                    return;
                }
                const path = (selectedDestination === '/' ? '' : selectedDestination) + folderName + '/';
                const result = await apiCall('/api/create-folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path })
                });
                if (result.success) {
                    showNotification('文件夹创建成功', 'success');
                    newNameInput.value = '';
                    await loadDirectoryTree();
                    // Reselect the parent after reload
                    const parentItem = document.querySelector('#directoryTree [data-path="' + selectedDestination + '"]');
                    if(parentItem) parentItem.click();
                }
            });

            document.getElementById('moveBtn').addEventListener('click', () => setupMoveCopy('move'));
            document.getElementById('copyBtn').addEventListener('click', () => setupMoveCopy('copy'));

            document.getElementById('confirmMoveCopyBtn').addEventListener('click', async () => {
                const sourceKeys = getSelectedFileKeys();
                if (sourceKeys.length === 0 || selectedDestination === null) return;

                const result = await apiCall('/api/files/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: currentAction,
                        sourceKeys,
                        destinationPrefix: selectedDestination
                    })
                });

                if (result.success) {
                    showNotification(result.message, 'success');
	                    refreshGallery();
                }
                moveCopyModal.hide();
            });

            function showLoading(show) {
                const DELAY = 100; // ms to wait before showing loader
                const MIN_TIME = 350; // ms minimum display time for loader

                if (show) {
                    loadingRequests += 1;
                    clearTimeout(loadingHideTimer);
                    if (loadingOverlay.classList.contains('show') || loadingTimer) return;

                    loadingTimer = setTimeout(() => {
                        loadingOverlay.classList.add('show');
                        loadingStart = Date.now();
                        loadingTimer = null;
                    }, DELAY);
                } else {
                    loadingRequests = Math.max(0, loadingRequests - 1);
                    if (loadingRequests > 0) return;

                    clearTimeout(loadingTimer); // Cancel showing the loader if it hasn't appeared yet
                    loadingTimer = null;
                    clearTimeout(loadingHideTimer);

                    if (loadingStart > 0) { // If the loader was shown
                        const elapsed = Date.now() - loadingStart;
                        const remaining = MIN_TIME - elapsed;
                        if (remaining > 0) {
                            loadingHideTimer = setTimeout(() => {
                                loadingOverlay.classList.remove('show');
                                loadingStart = 0;
                                loadingHideTimer = null;
                            }, remaining);
                        } else {
                            loadingOverlay.classList.remove('show');
                            loadingStart = 0;
                        }
                    }
                }
            }

            function showNotification(message, type = 'success') {
                const toastBody = document.querySelector('#notification .toast-body');
                const toastEl = document.getElementById('notification');
                toastEl.classList.remove('bg-success', 'bg-danger');
                toastEl.classList.add(\`bg-\${type}\`, 'text-white');
                toastBody.textContent = message;
                notificationToast.show();
            }

            function formatFileSize(bytes) {
                if (bytes < 1024) return bytes + ' B';
                const i = Math.floor(Math.log(bytes) / Math.log(1024));
                return \`\${(bytes / Math.pow(1024, i)).toFixed(2)} \${['B', 'KB', 'MB', 'GB'][i]}\`;
            }

            imagePreview.addEventListener('click', (e) => {
                if (e.target === imagePreview) {
                    closePreview();
                }
            });

            previewCloseBtn.addEventListener('click', closePreview);
            previewPrevBtn.addEventListener('click', showPrevImage);
            previewNextBtn.addEventListener('click', showNextImage);

            document.addEventListener('keydown', (e) => {
                if (!imagePreview.classList.contains('show')) return;
                if (e.key === 'ArrowLeft') showPrevImage();
                if (e.key === 'ArrowRight') showNextImage();
                if (e.key === 'Escape') closePreview();
            });

            function openPreview(imageUrl) {
                currentImageIndex = currentImageList.indexOf(imageUrl);
                if (currentImageIndex === -1) return;

                clearTimeout(previewCloseTimer);
                showPreviewImage(imageUrl);
            }

            function showPreviewImage(imageUrl) {
                const requestId = ++previewRequestId;
                imagePreview.classList.add('show', 'is-loading');
                updateNavButtons();
                preloadAdjacentImages();
                preloadImage(imageUrl).then(() => {
                    if (requestId !== previewRequestId || currentImageIndex === -1) return;
                    previewImage.src = imageUrl;
                    requestAnimationFrame(() => imagePreview.classList.remove('is-loading'));
                });
            }

            function closePreview() {
                previewRequestId++;
                imagePreview.classList.remove('show', 'is-loading');
                clearTimeout(previewCloseTimer);
                previewCloseTimer = setTimeout(() => {
                    if (!imagePreview.classList.contains('show')) {
                        previewImage.src = '';
                        currentImageIndex = -1;
                    }
                }, 220);
            }

            function updateNavButtons() {
                const hasMultipleImages = currentImageList.length > 1;
                previewPrevBtn.style.display = hasMultipleImages ? 'block' : 'none';
                previewNextBtn.style.display = hasMultipleImages ? 'block' : 'none';
                
                if(hasMultipleImages) {
                    previewPrevBtn.disabled = currentImageIndex === 0;
                    previewNextBtn.disabled = currentImageIndex === currentImageList.length - 1;
                }
            }

            function showPrevImage() {
                if (currentImageIndex > 0) {
                    currentImageIndex--;
                    showPreviewImage(currentImageList[currentImageIndex]);
                }
            }

            function showNextImage() {
                if (currentImageIndex < currentImageList.length - 1) {
                    currentImageIndex++;
                    showPreviewImage(currentImageList[currentImageIndex]);
                }
            }

            loadGallery();
        });
    </script>
</body>
</html>
    `;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

/**
 * 提供公共分享页面的HTML
 * @param {string} shareId 分享ID
 * @returns {Response} 包含分享页面HTML的响应
 */
function serveSharePage(shareId) {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PixR2 - 分享</title>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.3.7/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.bootcdn.net/ajax/libs/bootstrap-icons/1.13.1/font/bootstrap-icons.min.css">
    <style>
        ${getMotionStyles()}
        .container > .card {
            animation: pixr2-fade-up var(--pixr2-normal) var(--pixr2-ease) both;
        }
        .breadcrumb a {
            display: inline-block;
            transition:
                color var(--pixr2-fast) var(--pixr2-ease),
                transform var(--pixr2-fast) var(--pixr2-ease);
        }
        .breadcrumb a:hover {
            transform: translateY(-1px);
        }
        .gallery .item {
            animation: pixr2-fade-up 220ms var(--pixr2-ease) both;
        }
	        .gallery .item .card {
	            cursor: pointer;
	            overflow: hidden;
	            display: flex;
	            flex-direction: column;
	            transition:
	                box-shadow var(--pixr2-normal) var(--pixr2-ease),
	                transform var(--pixr2-normal) var(--pixr2-ease);
        }
	        .gallery .item .card:hover {
	            transform: translateY(-4px);
	            box-shadow: 0 .75rem 1.5rem rgba(0,0,0,.16)!important;
	        }
	        .file-visual-shell {
	            position: relative;
	            width: 100%;
	            aspect-ratio: 4 / 3;
	            overflow: hidden;
	            flex: 0 0 auto;
	        }
	        .gallery .item .file-image-shell {
	            background: #f1f5f9;
	        }
	        .gallery .item .file-image-shell.loaded {
	            background: #f8f9fa;
	        }
	        .gallery .item .file-image {
            display: block;
            width: 100%;
	            height: 100%;
	            object-fit: cover;
	            opacity: 0;
	            transform: scale(1.01);
	            transition:
	                opacity var(--pixr2-normal) var(--pixr2-ease),
	                transform var(--pixr2-normal) var(--pixr2-ease);
	        }
	        .gallery .item .file-image.loaded {
            animation: none;
            opacity: 1;
            transform: scale(1);
        }
        .image-loading-indicator {
            position: absolute;
            inset: 0;
	            display: flex;
	            align-items: center;
	            justify-content: center;
	            background-color: rgba(248, 249, 250, 0.72);
	            opacity: 1;
	            transform: scale(1);
	            transition:
                opacity var(--pixr2-normal) var(--pixr2-ease),
                transform var(--pixr2-normal) var(--pixr2-ease),
                visibility var(--pixr2-normal) var(--pixr2-ease);
            pointer-events: none;
        }
        .image-loading-indicator .spinner-border {
            width: 1.75rem;
            height: 1.75rem;
        }
        .file-image-shell.loaded .image-loading-indicator {
            opacity: 0;
	            transform: scale(0.94);
	            visibility: hidden;
	        }
	        .gallery .item .card:hover .file-image {
	            transform: scale(1.025);
	        }
	        .file-icon-shell {
	            display: flex;
	            flex-direction: column;
	            align-items: center;
            justify-content: center;
            gap: .5rem;
	            background: linear-gradient(180deg, #f8f9fa 0%, #eef2f7 100%);
	            color: #6c757d;
	        }
	        .directory-shell {
	            background: linear-gradient(180deg, #fff8df 0%, #fff2b8 100%);
	            color: #ffc107;
	        }
	        .file-icon-shell .file-type-icon {
	            font-size: clamp(2.75rem, 8vw, 4.25rem);
	            line-height: 1;
	        }
        .file-icon-shell .file-type-label {
            max-width: 80%;
            font-size: .75rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        .gallery .item .card:hover .file-type-icon {
            transform: scale(1.04);
        }
	        .file-type-icon {
	            transition: transform var(--pixr2-normal) var(--pixr2-ease);
	        }
	        .file-card-footer {
	            flex: 1 0 auto;
	            min-height: 4.6rem;
	            display: flex;
	            align-items: center;
	            padding: .65rem .75rem;
	        }
	        .file-meta {
	            min-width: 0;
	        }
	        .file-name {
	            color: #212529;
	            font-size: .95rem;
	            font-weight: 500;
	            line-height: 1.25;
	        }
	        .file-subtitle {
	            color: #6c757d;
	            font-size: .82rem;
	            line-height: 1.3;
	        }
	        .file-actions .btn {
	            width: 2.15rem;
	            height: 2.15rem;
	            display: inline-flex;
	            align-items: center;
	            justify-content: center;
	            padding: 0;
	        }
	        .gallery-placeholder .card {
	            cursor: default;
	            pointer-events: none;
	        }
	        .gallery .gallery-placeholder .card:hover {
	            transform: none;
	            box-shadow: none!important;
	        }
	        .skeleton-block,
	        .skeleton-line {
	            background-color: #eef2f7;
	            animation: pixr2-skeleton-pulse 850ms ease-in-out infinite alternate;
	        }
	        .skeleton-line {
	            display: block;
	            height: .82rem;
	            border-radius: 999px;
	            margin-bottom: .55rem;
	        }
	        .skeleton-line-name {
	            width: 78%;
	        }
	        .skeleton-line-size {
	            width: 42%;
	            height: .72rem;
	            margin-bottom: 0;
	        }
	        @keyframes pixr2-skeleton-pulse {
	            from { opacity: .48; }
	            to { opacity: 1; }
	        }
	        .gallery {
	            --pixr2-card-media: 9.25rem;
	            --pixr2-card-footer: 4.85rem;
	            display: grid;
	            grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
	            gap: 1rem;
	            align-items: start;
	            transition: opacity var(--pixr2-fast) var(--pixr2-ease);
	        }
	        .gallery.is-refreshing {
	            opacity: .78;
	            pointer-events: none;
	        }
	        .gallery .item .card {
	            flex-direction: column;
	            height: calc(var(--pixr2-card-media) + var(--pixr2-card-footer));
	            min-height: 0;
	            overflow: hidden;
	        }
	        .gallery .item .card:hover {
	            transform: translateY(-3px);
	        }
	        .file-visual-shell {
	            width: 100%;
	            min-width: 0;
	            height: var(--pixr2-card-media);
	            aspect-ratio: auto;
	            border-right: 0;
	            border-bottom: 1px solid rgba(0, 0, 0, .08);
	        }
	        .gallery .item .file-image {
	            position: absolute;
	            inset: 0;
	        }
	        .file-icon-shell {
	            gap: .3rem;
	        }
	        .directory-shell {
	            background: linear-gradient(135deg, #fff8db 0%, #ffeaa7 100%);
	        }
	        .file-icon-shell .file-type-icon {
	            font-size: 4.35rem;
	        }
	        .file-icon-shell .file-type-label {
	            font-size: .72rem;
	        }
	        .file-card-footer {
	            flex: 0 0 var(--pixr2-card-footer);
	            min-width: 0;
	            height: var(--pixr2-card-footer);
	            min-height: var(--pixr2-card-footer);
	            border-top: 0;
	            padding: .75rem .85rem;
	            background-color: #fff;
	        }
	        .file-name {
	            font-size: .98rem;
	            font-weight: 600;
	        }
	        .file-subtitle {
	            font-size: .84rem;
	        }
	        .file-actions .btn {
	            width: 2.1rem;
	            height: 2.1rem;
	        }
	        @media (max-width: 575.98px) {
	            .gallery {
	                --pixr2-card-media: 7.5rem;
	                --pixr2-card-footer: 4.6rem;
	                grid-template-columns: repeat(auto-fill, minmax(9.75rem, 1fr));
	                gap: .75rem;
	            }
	            .file-actions .btn {
	                width: 1.9rem;
	                height: 1.9rem;
	            }
	            .file-icon-shell .file-type-icon {
	                font-size: 3.6rem;
	            }
	        }
	        .image-preview-overlay {
	            position: fixed;
	            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
	            background-color: rgba(248, 249, 250, 0.88);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1200;
            cursor: pointer;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition:
                opacity 220ms var(--pixr2-ease),
                visibility 220ms var(--pixr2-ease);
        }
        .image-preview-overlay.show {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
        }
        .preview-content {
            max-width: 90vw;
            max-height: 90vh;
            object-fit: contain;
            cursor: default;
            border-radius: .5rem;
            box-shadow: 0 1.25rem 3rem rgba(15, 23, 42, 0.28);
            opacity: 0;
            transform: scale(0.96);
            transition:
                opacity 220ms var(--pixr2-ease),
                transform 220ms var(--pixr2-ease);
        }
        .image-preview-overlay.show .preview-content {
            opacity: 1;
            transform: scale(1);
        }
        .image-preview-overlay.is-loading .preview-content {
            opacity: 0;
            transform: scale(0.98);
        }
        .preview-loader {
            position: absolute;
            inset: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transform: scale(0.96);
            transition:
                opacity var(--pixr2-normal) var(--pixr2-ease),
                transform var(--pixr2-normal) var(--pixr2-ease);
            pointer-events: none;
        }
        .image-preview-overlay.is-loading .preview-loader {
            opacity: 1;
            transform: scale(1);
        }
        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
	            background-color: rgba(248, 249, 250, 0.78);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1250;
            opacity: 0;
            visibility: hidden;
            transition:
                opacity var(--pixr2-normal) var(--pixr2-ease),
                visibility var(--pixr2-normal) var(--pixr2-ease);
        }
        .loading-overlay.show {
            opacity: 1;
            visibility: visible;
        }
        .loading-overlay .spinner-border {
            transform: scale(0.92);
            transition: transform var(--pixr2-normal) var(--pixr2-ease);
        }
        .loading-overlay.show .spinner-border {
            transform: scale(1);
        }
    </style>
    <script>
        // SVG 原始代码
        const svgIcon = \`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><g fill="none"><path fill="url(#fluentColorShareAndroid246)" d="m16.628 5.349l.744 1.302L8.012 12l9.36 5.349l-.744 1.302L4.988 12z"/><path fill="url(#fluentColorShareAndroid240)" d="m16.628 5.349l.744 1.302L8.012 12l9.36 5.349l-.744 1.302L4.988 12z"/><path fill="url(#fluentColorShareAndroid241)" d="m16.628 5.349l.744 1.302L8.012 12l9.36 5.349l-.744 1.302L4.988 12z"/><path fill="url(#fluentColorShareAndroid242)" d="m16.628 5.349l.744 1.302L8.012 12l9.36 5.349l-.744 1.302L4.988 12z"/><path fill="url(#fluentColorShareAndroid243)" d="M20.5 18a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0"/><path fill="url(#fluentColorShareAndroid244)" d="M10 12a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0"/><path fill="url(#fluentColorShareAndroid245)" d="M20.5 6a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0"/><defs><radialGradient id="fluentColorShareAndroid240" cx="0" cy="0" r="1" gradientTransform="matrix(-4.00002 -2.49997 2.44863 -3.91786 17 18)" gradientUnits="userSpaceOnUse"><stop offset=".549" stop-color="#70777d"/><stop offset="1" stop-color="#70777d" stop-opacity="0"/></radialGradient><radialGradient id="fluentColorShareAndroid241" cx="0" cy="0" r="1" gradientTransform="matrix(4.5 0 0 5.85787 6.5 12)" gradientUnits="userSpaceOnUse"><stop offset=".549" stop-color="#70777d"/><stop offset="1" stop-color="#70777d" stop-opacity="0"/></radialGradient><radialGradient id="fluentColorShareAndroid242" cx="0" cy="0" r="1" gradientTransform="matrix(-4.08698 2.10583 -2.44201 -4.73943 17 6)" gradientUnits="userSpaceOnUse"><stop offset=".549" stop-color="#70777d"/><stop offset="1" stop-color="#70777d" stop-opacity="0"/></radialGradient><radialGradient id="fluentColorShareAndroid243" cx="0" cy="0" r="1" gradientTransform="matrix(11.22915 15.23954 -13.05196 9.61725 9.27 6.698)" gradientUnits="userSpaceOnUse"><stop offset=".529" stop-color="#0fafff"/><stop offset="1" stop-color="#0078d4"/></radialGradient><radialGradient id="fluentColorShareAndroid244" cx="0" cy="0" r="1" gradientTransform="matrix(11.22915 15.23954 -13.05196 9.61725 -1.23 .698)" gradientUnits="userSpaceOnUse"><stop offset=".529" stop-color="#0fafff"/><stop offset="1" stop-color="#0078d4"/></radialGradient><radialGradient id="fluentColorShareAndroid245" cx="0" cy="0" r="1" gradientTransform="matrix(11.22915 15.23954 -13.05196 9.61725 9.27 -5.302)" gradientUnits="userSpaceOnUse"><stop offset=".529" stop-color="#0fafff"/><stop offset="1" stop-color="#0078d4"/></radialGradient><linearGradient id="fluentColorShareAndroid246" x1="4.988" x2="10.03" y1="5.349" y2="18.759" gradientUnits="userSpaceOnUse"><stop stop-color="#b9c0c7"/><stop offset="1" stop-color="#70777d"/></linearGradient></defs></g></svg>\`;                 
        // 创建 blob 和 URL
        const blob = new Blob([svgIcon], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);                  
        // 创建 favicon link
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = url;                    
        // 插入到 head 中
        document.head.appendChild(link);
    </script>
</head>
<body class="bg-light">
    <header>
        <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
            <div class="container">
                <a class="navbar-brand fw-bold" href="/upload">PixR2</a>
            </div>
        </nav>
    </header>

    <div class="container my-4">
        <div class="card shadow-sm">
            <div class="card-body">
                <nav id="breadcrumb" style="--bs-breadcrumb-divider: '>';" aria-label="breadcrumb" class="mb-3"></nav>
                <div class="gallery" id="gallery"></div>
                <nav id="paginationContainer" class="mt-4" aria-label="Page navigation">
                    <ul class="pagination justify-content-center" id="pagination"></ul>
                </nav>
            </div>
        </div>
    </div>

    <div id="loading-overlay" class="loading-overlay">
        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
            <span class="visually-hidden">Loading...</span>
        </div>
    </div>
    
    <div id="imagePreview" class="image-preview-overlay">
        <div class="preview-loader"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>
        <button id="previewCloseBtn" class="btn-close position-absolute top-0 end-0 m-3 fs-4" style="z-index: 1201;"></button>
        <button id="previewPrevBtn" class="btn btn-outline-dark position-absolute top-50 start-0 translate-middle-y m-3 fs-3"><</button>
        <button id="previewNextBtn" class="btn btn-outline-dark position-absolute top-50 end-0 translate-middle-y m-3 fs-3">></button>
        <img class="preview-content" id="previewImage">
    </div>

    <script src="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.3.7/js/bootstrap.bundle.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const shareId = '${shareId}';
            let currentRelativePath = '';
            let shareRootPath = '';
            let currentPage = 1;
            let loadingTimer = null;
            let loadingHideTimer = null;
            let loadingRequests = 0;
            let loadingStart = 0;
            let currentImageList = [];
            let currentImageIndex = -1;
	            let previewCloseTimer = null;
	            let previewRequestId = 0;
	            const imageCache = new Map();
	            const loadedImageUrls = new Set();
	            const galleryCache = new Map();
	            let hasRenderedGallery = false;
	            let galleryRequestId = 0;

	            function escapeHtml(value = '') {
                const htmlEscapes = {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                };
                return String(value).replace(/[&<>"']/g, char => htmlEscapes[char]);
            }
            
            const galleryEl = document.getElementById('gallery');
            const breadcrumbEl = document.getElementById('breadcrumb');
            const paginationEl = document.getElementById('pagination');
            const imagePreview = document.getElementById('imagePreview');
            const previewImage = document.getElementById('previewImage');
            const loadingOverlay = document.getElementById('loading-overlay');
            const previewCloseBtn = document.getElementById('previewCloseBtn');
            const previewPrevBtn = document.getElementById('previewPrevBtn');
            const previewNextBtn = document.getElementById('previewNextBtn');

	            async function loadGallery() {
	                const cacheKey = \`\${currentRelativePath}|\${currentPage}\`;
	                const cachedData = galleryCache.get(cacheKey);
	                const requestId = ++galleryRequestId;

	                if (cachedData) {
	                    applyGalleryData(cachedData);
	                } else if (!hasRenderedGallery) {
	                    renderGalleryLoading();
	                } else {
	                    galleryEl.classList.add('is-refreshing');
	                }

	                try {
	                    const response = await fetch(\`/api/s/\${shareId}/list?prefix=\${encodeURIComponent(currentRelativePath)}&page=\${currentPage}\`);
	                    if (!response.ok) {
	                        const errorText = response.status === 404 ? '分享链接不存在或已失效。' : '加载失败，请稍后再试。';
	                        throw new Error(errorText);
	                    }
	                    const data = await response.json();
	                    if (requestId !== galleryRequestId) return;
	                    galleryEl.classList.remove('is-refreshing');
	                    if (data && data.success) {
	                        galleryCache.set(cacheKey, data);
	                        if (!cachedData || JSON.stringify(cachedData) !== JSON.stringify(data)) {
	                            applyGalleryData(data);
	                        }
	                    } else {
	                        throw new Error(data.message || '加载内容失败');
	                    }
	                } catch (error) {
	                    if (requestId !== galleryRequestId) return;
	                    galleryEl.classList.remove('is-refreshing');
	                    if (!cachedData) {
	                        galleryEl.innerHTML = \`<div class="col"><p class="text-danger text-center">\${error.message}</p></div>\`;
	                    }
	                }
	            }

	            function applyGalleryData(data) {
	                if (shareRootPath === '') {
	                   // On first load, determine the root path of the share from the response
	                   shareRootPath = data.currentPath.substring(0, data.currentPath.length - currentRelativePath.length);
	                }
	                updateBreadcrumb(data.currentPath);
	                renderGallery(data.directories, data.files);
	                renderPagination(data.pagination);
	                hasRenderedGallery = true;
	            }

	            function renderGalleryLoading(count = 8) {
	                galleryEl.innerHTML = Array.from({ length: count }, (_, index) => \`
	                    <div class="col item gallery-placeholder" aria-hidden="true" style="animation-delay: \${index * 18}ms">
	                        <div class="card h-100">
	                            <div class="file-visual-shell skeleton-block"></div>
	                            <div class="card-footer file-card-footer text-body-secondary small">
	                                <div class="file-meta w-100">
	                                    <span class="skeleton-line skeleton-line-name"></span>
	                                    <span class="skeleton-line skeleton-line-size"></span>
	                                </div>
	                            </div>
	                        </div>
	                    </div>
	                \`).join('');
	            }

	            function updateBreadcrumb(fullPath) {
                breadcrumbEl.innerHTML = '<ol class="breadcrumb mb-0"></ol>';
                const ol = breadcrumbEl.querySelector('ol');
                
                const homeItem = document.createElement('li');
                homeItem.className = 'breadcrumb-item';
                homeItem.innerHTML = '<a href="#" data-path="">分享首页</a>';
                ol.appendChild(homeItem);

                const relativePath = fullPath.substring(shareRootPath.length);
                if (relativePath) {
                    let pathAccumulator = '';
                    const parts = relativePath.replace(/\\/$/, '').split('/');
                    parts.forEach(part => {
                        if (!part) return;
                        pathAccumulator += part + '/';
                        const item = document.createElement('li');
                        item.className = 'breadcrumb-item';
                        item.innerHTML = \`<a href="#" data-path="\${escapeHtml(pathAccumulator)}">\${escapeHtml(part)}</a>\`;
                        ol.appendChild(item);
                    });
                }
                ol.lastChild.classList.add('active');
                ol.lastChild.setAttribute('aria-current', 'page');
                ol.lastChild.textContent = ol.lastChild.textContent;
            }

            function renderGallery(directories, files) {
                galleryEl.innerHTML = '';
                currentImageList = files
                    .filter(file => file.name !== '.null' && file.isImage)
                    .map(file => file.url);
                const items = [...directories.map(d => ({...d, isDir: true})), ...files.map(f => ({...f, isFile: true}))];
                if (items.length === 0) {
                    galleryEl.innerHTML = '<div class="col"><p class="text-muted text-center">此文件夹为空</p></div>';
                    return;
                }
	                items.forEach(item => {
	                    const col = document.createElement('div');
	                    col.className = 'col item';
	                    const safeName = escapeHtml(item.name || '');
	                    const safeUrl = escapeHtml(item.url || '');
	                    const safeDirectUrl = escapeHtml(item.directUrl || item.url || '');
	                    const safeIconClass = escapeHtml(item.iconClass || 'bi-file-earmark');
	                    const safeLabel = escapeHtml(item.label || '文件');
	                    const imageAlreadyLoaded = item.isImage && loadedImageUrls.has(item.url);
		                    if (item.isDir) {
		                        col.innerHTML = \`
		                            <div class="card h-100" data-path="\${escapeHtml(item.path.substring(shareRootPath.length))}">
		                                <div class="file-visual-shell file-icon-shell directory-shell">
		                                    <i class="bi bi-folder-fill file-type-icon"></i>
		                                </div>
		                                <div class="card-footer file-card-footer text-body-secondary small">
		                                    <div class="file-meta w-100">
		                                        <p class="card-text file-name text-truncate mb-1" title="\${safeName}">\${safeName}</p>
		                                        <p class="card-text file-subtitle mb-0">文件夹</p>
		                                    </div>
		                                </div>
		                            </div>
		                        \`;
                    } else {
                        if (item.isImage) col.dataset.previewUrl = item.url;
                        col.innerHTML = \`
                           <div class="card h-100">
	                               \${item.name === '.null'
	                                   ? '<div class="card-body text-center d-flex flex-column justify-content-center align-items-center"><i class="bi bi-file-earmark-binary fs-1"></i></div>'
		                                   : item.isImage
		                                       ? \`
		                                           <div class="file-visual-shell file-image-shell\${imageAlreadyLoaded ? ' loaded' : ''}">
		                                               <img \${imageAlreadyLoaded ? \`src="\${safeUrl}"\` : \`data-src="\${safeUrl}"\`} class="card-img-top file-image\${imageAlreadyLoaded ? ' loaded' : ' lazyload'}" alt="\${safeName}" loading="\${imageAlreadyLoaded ? 'eager' : 'lazy'}">
		                                               <div class="image-loading-indicator">
		                                                   <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
		                                               </div>
		                                           </div>
		                                       \`
		                                       : \`
		                                           <div class="file-visual-shell file-icon-shell">
		                                               <i class="bi \${safeIconClass} file-type-icon"></i>
		                                               <span class="file-type-label text-truncate">\${safeLabel}</span>
		                                           </div>
		                                       \`
		                               }
	                               <div class="card-footer file-card-footer text-body-secondary small">
		                                   <div class="d-flex justify-content-between align-items-center w-100 gap-2">
		                                       <div class="file-meta flex-grow-1">
		                                           <p class="card-text file-name text-truncate mb-1" title="\${safeName}">\${safeName}</p>
		                                           <p class="card-text file-subtitle mb-0">\${formatFileSize(item.size)}</p>
		                                       </div>
		                                       \${item.name !== '.null' ? \`
		                                           <div class="btn-group flex-shrink-0 file-actions">
		                                               <button class="btn btn-sm btn-outline-secondary copy-direct-url-btn" data-url="\${safeDirectUrl}" title="复制直链"><i class="bi bi-link-45deg"></i></button>
		                                           </div>
		                                       \` : ''}
                                   </div>
                               </div>
                           </div>
                       \`;
                    }
                    galleryEl.appendChild(col);
                });
                observeLazyLoad();
            }

           function observeLazyLoad() {
               const lazyImages = document.querySelectorAll('.lazyload');
               const imageObserver = new IntersectionObserver((entries, observer) => {
                   entries.forEach(entry => {
                       if (entry.isIntersecting) {
                           const image = entry.target;
                           loadGalleryImage(image);
                           observer.unobserve(image);
                       }
                   });
               });

               lazyImages.forEach(image => {
                   imageObserver.observe(image);
               });
           }

            function preloadImage(url) {
                if (!url) return Promise.resolve();
                if (imageCache.has(url)) return imageCache.get(url);

                const promise = new Promise(resolve => {
                    const image = new Image();
                    image.decoding = 'async';
                    const done = () => {
                        loadedImageUrls.add(url);
                        resolve(url);
                    };
                    image.onload = done;
                    image.onerror = done;
                    image.src = url;
                });
                imageCache.set(url, promise);
                return promise;
            }

	            function loadGalleryImage(image) {
	                const src = image.dataset.src;
	                if (!src || image.dataset.loading === 'true') return;
	                image.dataset.loading = 'true';

	                const shell = image.closest('.file-image-shell');
	                const markLoaded = () => requestAnimationFrame(() => {
	                    loadedImageUrls.add(src);
	                    image.classList.add('loaded');
	                    if (shell) shell.classList.add('loaded');
	                });

	                let loadPromise = imageCache.get(src);
	                if (!loadPromise) {
	                    loadPromise = new Promise(resolve => {
	                        const done = () => {
	                            image.onload = null;
	                            image.onerror = null;
	                            loadedImageUrls.add(src);
	                            resolve(src);
	                        };
	                        image.onload = done;
	                        image.onerror = done;
	                        image.src = src;
	                        if (image.complete) done();
	                    });
	                    imageCache.set(src, loadPromise);
	                } else {
	                    image.src = src;
	                }

	                image.classList.remove('lazyload');
	                loadPromise.then(markLoaded);
	            }

            function preloadAdjacentImages() {
                [currentImageIndex - 1, currentImageIndex + 1].forEach(index => {
                    if (index >= 0 && index < currentImageList.length) {
                        preloadImage(currentImageList[index]);
                    }
                });
            }

            function writeToClipboard(text) {
                if (navigator.clipboard && window.isSecureContext) {
                    return navigator.clipboard.writeText(text);
                }

                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                const copied = document.execCommand('copy');
                textarea.remove();
                return copied ? Promise.resolve() : Promise.reject(new Error('Copy failed'));
            }

            function copyDirectUrl(button) {
                const url = button.dataset.url;
                if (!url) return;
                const originalHtml = button.innerHTML;
                const originalClassName = button.className;
                writeToClipboard(url).then(() => {
                    button.className = 'btn btn-sm btn-success copy-direct-url-btn';
                    button.innerHTML = '<i class="bi bi-check2"></i>';
                    setTimeout(() => {
                        button.className = originalClassName;
                        button.innerHTML = originalHtml;
                    }, 1200);
                }).catch(() => {
                    button.className = 'btn btn-sm btn-danger copy-direct-url-btn';
                    button.innerHTML = '<i class="bi bi-x"></i>';
                    setTimeout(() => {
                        button.className = originalClassName;
                        button.innerHTML = originalHtml;
                    }, 1200);
                });
            }

            function renderPagination({ totalPages }) {
                paginationEl.innerHTML = '';
                if (totalPages <= 1) return;
                const createPageItem = (page, text, isActive = false, isDisabled = false) => {
                    const li = document.createElement('li');
                    li.className = \`page-item \${isActive ? 'active' : ''} \${isDisabled ? 'disabled' : ''}\`;
                    li.innerHTML = \`<a class="page-link" href="#" data-page="\${page}">\${text}</a>\`;
                    return li;
                };
                paginationEl.appendChild(createPageItem(currentPage - 1, '«', false, currentPage === 1));
                for (let i = 1; i <= totalPages; i++) {
                    paginationEl.appendChild(createPageItem(i, i, i === currentPage));
                }
                paginationEl.appendChild(createPageItem(currentPage + 1, '»', false, currentPage === totalPages));
            }

            breadcrumbEl.addEventListener('click', e => {
                if (e.target.tagName === 'A' && e.target.dataset.path !== undefined) {
                    e.preventDefault();
                    currentRelativePath = e.target.dataset.path;
                    currentPage = 1;
                    loadGallery();
                }
            });

            galleryEl.addEventListener('click', e => {
                const card = e.target.closest('.card');
                if (!card) return;

                if (card.dataset.path !== undefined) { // Directory click
                    currentRelativePath = card.dataset.path;
                    currentPage = 1;
                    loadGallery();
                } else { // File click
                    const copyBtn = e.target.closest('.copy-direct-url-btn');
                    if (copyBtn) {
                        copyDirectUrl(copyBtn);
                        return;
                    }

                    const itemEl = card.closest('.item');
                    if (itemEl?.dataset.previewUrl) {
                        openPreview(itemEl.dataset.previewUrl);
                    }
                }
            });

            paginationEl.addEventListener('click', e => {
                if (e.target.tagName === 'A' && e.target.dataset.page) {
                    e.preventDefault();
                    const page = parseInt(e.target.dataset.page);
                    if (page !== currentPage && page > 0 && !isNaN(page)) {
                        currentPage = page;
                        loadGallery();
                    }
                }
            });

            imagePreview.addEventListener('click', (e) => {
                if (e.target === imagePreview) {
                    closePreview();
                }
            });

            previewCloseBtn.addEventListener('click', closePreview);
            previewPrevBtn.addEventListener('click', showPrevImage);
            previewNextBtn.addEventListener('click', showNextImage);

            document.addEventListener('keydown', (e) => {
                if (!imagePreview.classList.contains('show')) return;
                if (e.key === 'ArrowLeft') showPrevImage();
                if (e.key === 'ArrowRight') showNextImage();
                if (e.key === 'Escape') closePreview();
            });

            function openPreview(imageUrl) {
                currentImageIndex = currentImageList.indexOf(imageUrl);
                if (currentImageIndex === -1) return;

                clearTimeout(previewCloseTimer);
                showPreviewImage(imageUrl);
            }

            function showPreviewImage(imageUrl) {
                const requestId = ++previewRequestId;
                imagePreview.classList.add('show', 'is-loading');
                updateNavButtons();
                preloadAdjacentImages();
                preloadImage(imageUrl).then(() => {
                    if (requestId !== previewRequestId || currentImageIndex === -1) return;
                    previewImage.src = imageUrl;
                    requestAnimationFrame(() => imagePreview.classList.remove('is-loading'));
                });
            }

            function closePreview() {
                previewRequestId++;
                imagePreview.classList.remove('show', 'is-loading');
                clearTimeout(previewCloseTimer);
                previewCloseTimer = setTimeout(() => {
                    if (!imagePreview.classList.contains('show')) {
                        previewImage.src = '';
                        currentImageIndex = -1;
                    }
                }, 220);
            }

            function updateNavButtons() {
                const hasMultipleImages = currentImageList.length > 1;
                previewPrevBtn.style.display = hasMultipleImages ? 'block' : 'none';
                previewNextBtn.style.display = hasMultipleImages ? 'block' : 'none';

                if(hasMultipleImages) {
                    previewPrevBtn.disabled = currentImageIndex === 0;
                    previewNextBtn.disabled = currentImageIndex === currentImageList.length - 1;
                }
            }

            function showPrevImage() {
                if (currentImageIndex > 0) {
                    currentImageIndex--;
                    showPreviewImage(currentImageList[currentImageIndex]);
                }
            }

            function showNextImage() {
                if (currentImageIndex < currentImageList.length - 1) {
                    currentImageIndex++;
                    showPreviewImage(currentImageList[currentImageIndex]);
                }
            }

            function formatFileSize(bytes) {
                if (bytes < 1024) return bytes + ' B';
                const i = Math.floor(Math.log(bytes) / Math.log(1024));
                return \`\${(bytes / Math.pow(1024, i)).toFixed(2)} \${['B', 'KB', 'MB', 'GB'][i]}\`;
            }

            function showLoading(show) {
                const DELAY = 100; // ms to wait before showing loader
                const MIN_TIME = 350; // ms minimum display time for loader

                if (show) {
                    loadingRequests += 1;
                    clearTimeout(loadingHideTimer);
                    if (loadingOverlay.classList.contains('show') || loadingTimer) return;

                    loadingTimer = setTimeout(() => {
                        loadingOverlay.classList.add('show');
                        loadingStart = Date.now();
                        loadingTimer = null;
                    }, DELAY);
                } else {
                    loadingRequests = Math.max(0, loadingRequests - 1);
                    if (loadingRequests > 0) return;

                    clearTimeout(loadingTimer); // Cancel showing the loader if it hasn't appeared yet
                    loadingTimer = null;
                    clearTimeout(loadingHideTimer);

                    if (loadingStart > 0) { // If the loader was shown
                        const elapsed = Date.now() - loadingStart;
                        const remaining = MIN_TIME - elapsed;
                        if (remaining > 0) {
                            loadingHideTimer = setTimeout(() => {
                                loadingOverlay.classList.remove('show');
                                loadingStart = 0;
                                loadingHideTimer = null;
                            }, remaining);
                        } else {
                            loadingOverlay.classList.remove('show');
                            loadingStart = 0;
                        }
                    }
                }
            }

            loadGallery();
        });
    </script>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

/**
 * 处理从网页界面上传的文件
 * @param {Request} request - 包含文件数据的请求
 * @param {R2Bucket} bucket - R2存储桶实例
 * @returns {Promise<Response>} - 包含上传结果的JSON响应
 */
async function handleWebUpload(request, bucket) {
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

async function handleCreateR2MultipartUpload(request, bucket) {
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

async function handleUploadR2MultipartPart(request, bucket) {
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

async function handleCompleteR2MultipartUpload(request, bucket) {
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

async function handleAbortR2MultipartUpload(request, bucket) {
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
async function handleListFiles(request, bucket) {
    // 身份验证已由中间件处理
    return listR2Files(request, bucket);
}

/**
 * 从R2存储桶中删除文件
 * @param {Request} request - 包含要删除文件键(keys)数组的请求
 * @param {R2Bucket} bucket - R2存储桶实例
 * @returns {Promise<Response>} - 包含删除结果的JSON响应
 */
async function handleDeleteFiles(request, bucket) {
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
async function handleCreateFolder(request, bucket) {
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
async function handleCreateShare(request, env) {
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
async function handleListShares(request, env) {
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
async function handleDeleteShare(request, env) {
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
async function handleListSharedFiles(request, env, params) {
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
async function handleFileAction(request, bucket) {
    try {
        const body = await request.json();
        const { action, sourceKeys, destinationPrefix } = body;

        if (!['move', 'copy'].includes(action)) {
            return new Response(JSON.stringify({ success: false, message: "Invalid action" }), { status: 400 });
        }
        if (!Array.isArray(sourceKeys) || sourceKeys.length === 0) {
            return new Response(JSON.stringify({ success: false, message: "No source files specified" }), { status: 400 });
        }
        if (typeof destinationPrefix !== 'string') {
            return new Response(JSON.stringify({ success: false, message: "Invalid destination" }), { status: 400 });
        }

        const results = [];
        for (const sourceKey of sourceKeys) {
            const fileName = sourceKey.split('/').pop();
            let destKey = (destinationPrefix.endsWith('/') ? destinationPrefix : destinationPrefix + '/') + fileName;
            if (destinationPrefix === '/') {
                destKey = fileName;
            }


            try {
                const object = await bucket.get(sourceKey);
                if (object === null) {
                    results.push({ source: sourceKey, status: 'error', error: 'Source not found' });
                    continue;
                }

                await bucket.put(destKey, object.body, {
                    httpMetadata: object.httpMetadata,
                    customMetadata: object.customMetadata,
                });

                if (action === 'move') {
                    await bucket.delete(sourceKey);
                }
                results.push({ source: sourceKey, destination: destKey, status: 'success' });
            } catch (e) {
                results.push({ source: sourceKey, status: 'error', error: e.message });
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const actionText = action === 'move' ? '移动' : '复制';

        return new Response(JSON.stringify({
            success: true,
            message: `成功${actionText} ${successCount} 个文件`,
            results,
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
async function handleListDirectories(request, bucket) {
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
async function uploadFileToR2(fileUrl, bucket, isDocument = false, userPath = '', originalName = '', mimeType = '') {
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
 * 从Telegram获取文件的临时下载URL
 * @param {string} fileId - 文件的唯一ID
 * @param {string} botToken - Telegram机器人的Token
 * @returns {Promise<string>} - 文件的可下载URL
 */
async function getFileUrl(fileId, botToken) {
    const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    const data = await response.json();
    return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
}

/**
 * 向指定的Telegram聊天发送文本消息
 * @param {number|string} chatId - 聊天ID
 * @param {string} text - 要发送的文本
 * @param {string} apiUrl - Telegram Bot API的基础URL
 * @param {object} options - 其他API选项 (例如 parse_mode)
 */
async function sendMessage(chatId, text, apiUrl, options = {}) {
    await fetch(`${apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            ...options
        }),
    });
}

/**
 * 向指定的Telegram聊天发送图片
 * @param {number|string} chatId - 聊天ID
 * @param {string} photoUrl - 图片的URL
 * @param {string} apiUrl - Telegram Bot API的基础URL
 * @param {string} caption - 图片的标题
 * @param {object} options - 其他API选项 (例如 parse_mode)
 * @returns {Promise<object>} - Telegram API的响应
 */
async function sendPhoto(chatId, photoUrl, apiUrl, caption = "", options = {}) {
    const response = await fetch(`${apiUrl}/sendPhoto`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            photo: photoUrl,
            caption: caption,
            ...options
        }),
    });
    return await response.json();
}

/**
 * 生成指定长度的随机字符串
 * @param {number} length 字符串长度
 * @returns {string}
 */
function generateRandomString(length) {
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
async function listR2Files(request, bucket, forcePrefix = null) {
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
