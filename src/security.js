const HTML_SECURITY_HEADERS = {
    'Content-Security-Policy': [
        "default-src 'self'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "connect-src 'self'",
        "img-src 'self' https: data: blob:",
        "script-src 'self' 'unsafe-inline' https://cdn.bootcdn.net",
        "style-src 'self' 'unsafe-inline' https://cdn.bootcdn.net",
        "font-src 'self' https://cdn.bootcdn.net data:"
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

export function buildHtmlHeaders(headers = {}) {
    return {
        ...HTML_SECURITY_HEADERS,
        ...headers,
    };
}
