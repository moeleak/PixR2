import { serveLoginPage } from './pages/login.js';

// --- 身份验证相关函数 ---

/**
 * 检查请求的cookie中是否包含有效的认证信息
 * @param {Request} request - 传入的请求
 * @param {string} secretKey - 用于验证的密钥
 * @returns {Promise<boolean>} - 如果已认证则返回true，否则返回false
 */
export async function isAuthenticated(request, secretKey) {
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    // 比较cookie中的auth值与密钥的哈希值
    return cookies.auth === hashKey(secretKey).replace(/=/g, '');
}

/**
 * 处理登录请求
 * @param {Request} request - 传入的请求
 * @param {string} secretKey - 用于验证的密钥
 * @returns {Promise<Response>} - 成功则重定向到文件管理页面，失败则返回登录页面并显示错误信息
 */
export async function handleLogin(request, secretKey) {
    const formData = await request.formData();
    const inputKey = formData.get('key');

    // 检查输入的密钥是否正确
    if (inputKey === secretKey) {
        const headers = new Headers();
        // 登录成功，设置一个有效期为一天的HttpOnly cookie
        headers.append('Set-Cookie', `auth=${hashKey(secretKey).replace(/=/g, '')}; SameSite=Lax; Secure; HttpOnly; Path=/; Max-Age=86400`);
        // 重定向到文件管理页面
        headers.append('Location', '/explorer');
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


// 用于身份验证的中间件
export const requireAuth = (handler) => async (request, env, ...args) => {
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
