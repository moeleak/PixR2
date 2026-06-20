import { buildHtmlHeaders } from '../security.js';

/**
 * 提供登录页面的HTML
 * @param {string|null} errorMessage - 如果有错误，则显示此消息
 * @returns {Response} - 包含登录页面HTML的响应
 */
export function serveLoginPage(errorMessage = null) {
    const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PixR2 - 登录</title>
        <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.3.7/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-LN+7fdVzj6u52u30Kp6M/trliBMCMKTyK833zpbD+pXdCLuTusPj697FH4R/5mcr" crossorigin="anonymous">
        <link rel="stylesheet" href="/assets/styles/login.css">
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
        headers: buildHtmlHeaders({ 'Content-Type': 'text/html; charset=utf-8' })
    });
}
