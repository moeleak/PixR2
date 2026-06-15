import { handleLogin } from './auth.js';
import { requireAuth } from './auth.js';
import { Router } from './router.js';
import {
    handleAbortR2MultipartUpload,
    handleCompleteR2MultipartUpload,
    handleCreateFolder,
    handleCreateR2MultipartUpload,
    handleCreateShare,
    handleDeleteFiles,
    handleDeleteShare,
    handleFileAction,
    handleListDirectories,
    handleListFiles,
    handleListSharedFiles,
    handleListShares,
    handleUploadR2MultipartPart,
    handleWebUpload,
} from './api/files.js';
import { handleTelegramWebhook, setWebhook } from './api/telegram.js';
import { serveErrorPage } from './pages/error.js';
import { serveGalleryPage } from './pages/gallery.js';
import { serveLoginPage } from './pages/login.js';
import { serveSharePage } from './pages/share.js';
import { serveUploadPage } from './pages/upload.js';

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
