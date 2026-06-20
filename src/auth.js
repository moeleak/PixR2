import { serveLoginPage } from './pages/login.js';

// --- 身份验证相关函数 ---

const AUTH_COOKIE_NAME = '__Host-pixr2_auth';
const AUTH_MAX_AGE_SECONDS = 86400;
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const textEncoder = new TextEncoder();

/**
 * 检查请求的cookie中是否包含有效的认证信息
 * @param {Request} request - 传入的请求
 * @param {string} secretKey - 用于验证的密钥
 * @returns {Promise<boolean>} - 如果已认证则返回true，否则返回false
 */
export async function isAuthenticated(request, secretKey) {
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    return verifyAuthCookie(cookies[AUTH_COOKIE_NAME], secretKey);
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
    if (typeof inputKey === 'string' && timingSafeEqual(inputKey, secretKey)) {
        const headers = new Headers();
        const authCookie = await createAuthCookie(secretKey);
        headers.append('Set-Cookie', `${AUTH_COOKIE_NAME}=${authCookie}; SameSite=Lax; Secure; HttpOnly; Path=/; Max-Age=${AUTH_MAX_AGE_SECONDS}`);
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
 * 解析cookie字符串为对象
 * @param {string} cookieString - 从请求头获取的cookie字符串
 * @returns {object} - 解析后的cookie键值对对象
 */
function parseCookies(cookieString) {
    const cookies = {};
    cookieString.split(';').forEach(cookie => {
        const separatorIndex = cookie.indexOf('=');
        if (separatorIndex === -1) return;
        const name = cookie.slice(0, separatorIndex).trim();
        const value = cookie.slice(separatorIndex + 1).trim();
        if (name) cookies[name] = value;
    });
    return cookies;
}

async function createAuthCookie(secretKey) {
    const issuedAt = Date.now().toString();
    const nonce = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
    const payload = `${issuedAt}.${nonce}`;
    const signature = await signValue(payload, secretKey);
    return `v1.${payload}.${signature}`;
}

async function verifyAuthCookie(cookieValue, secretKey) {
    if (!cookieValue || !secretKey) return false;

    const parts = cookieValue.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') return false;

    const issuedAt = Number(parts[1]);
    if (!Number.isSafeInteger(issuedAt)) return false;

    const ageMs = Date.now() - issuedAt;
    if (ageMs < 0 || ageMs > AUTH_MAX_AGE_SECONDS * 1000) return false;

    const payload = `${parts[1]}.${parts[2]}`;
    const expectedSignature = await signValue(payload, secretKey);
    return timingSafeEqual(parts[3], expectedSignature);
}

async function signValue(value, secretKey) {
    const key = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(secretKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(value));
    return base64UrlEncode(new Uint8Array(signature));
}

function base64UrlEncode(bytes) {
    let binary = '';
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function timingSafeEqual(left = '', right = '') {
    const leftBytes = textEncoder.encode(String(left));
    const rightBytes = textEncoder.encode(String(right));
    let diff = leftBytes.length ^ rightBytes.length;
    const length = Math.max(leftBytes.length, rightBytes.length);

    for (let index = 0; index < length; index++) {
        diff |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
    }

    return diff === 0;
}

function hasValidRequestOrigin(request) {
    if (!STATE_CHANGING_METHODS.has(request.method)) return true;

    const requestOrigin = new URL(request.url).origin;
    const origin = request.headers.get('Origin');
    if (origin && origin !== requestOrigin) return false;

    const secFetchSite = request.headers.get('Sec-Fetch-Site');
    if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
        return false;
    }

    return true;
}

// 用于身份验证的中间件
export const requireAuth = (handler) => async (request, env, ...args) => {
    if (!hasValidRequestOrigin(request)) {
        return new Response('Forbidden', { status: 403 });
    }

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
