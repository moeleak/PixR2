// 简易路由器类
export class Router {
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
