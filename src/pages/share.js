import { getMotionStyles } from './motion.js';

/**
 * 提供公共分享页面的HTML
 * @param {string} shareId 分享ID
 * @returns {Response} 包含分享页面HTML的响应
 */
export function serveSharePage(shareId) {
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
                <a class="navbar-brand fw-bold" href="/explorer">PixR2</a>
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
