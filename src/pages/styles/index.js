import { getExplorerStyles } from './explorer.js';
import { getLoginStyles } from './login.js';
import { getShareStyles } from './share.js';

const STYLESHEETS = {
    'explorer.css': getExplorerStyles,
    'login.css': getLoginStyles,
    'share.css': getShareStyles,
};

export function serveStylesheet(name = '') {
    const getStyles = STYLESHEETS[name];
    if (!getStyles) {
        return new Response('Not found', { status: 404 });
    }

    return new Response(getStyles(), {
        headers: {
            'Content-Type': 'text/css; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
