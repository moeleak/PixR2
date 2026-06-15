import { getMotionStyles } from './motion.js';

/**
 * 提供图库页面的HTML
 * @returns {Response} - 包含图库页面HTML的响应
 */
export function serveGalleryPage() {
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
            const directoryTreeEl = document.getElementById('directoryTree');
            const confirmMoveCopyBtn = document.getElementById('confirmMoveCopyBtn');
            const createFolderInModalBtn = document.getElementById('createFolderInModalBtn');

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
            let directoryTreeCache = null;
            let directoryChildrenByParent = new Map();
            let isMoveCopyBusy = false;
            const MULTIPART_CHUNK_SIZE = 8 * 1024 * 1024;
            const MULTIPART_CONCURRENCY = 4;
            const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

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
                    directoryTreeCache = null;
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
                    directoryTreeCache = null;
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
                confirmMoveCopyBtn.textContent = action === 'move' ? '移动到此处' : '复制到此处';
                selectedDestination = null;
                confirmMoveCopyBtn.disabled = true;
                directoryTreeEl.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
                moveCopyModal.show();
                nextFrame().then(() => loadDirectoryTree());
            }

            async function loadDirectoryTree({ force = false } = {}) {
                if (!force && directoryTreeCache) {
                    renderDirectoryTree(directoryTreeCache, directoryTreeEl);
                    return;
                }

                directoryTreeEl.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
                await nextFrame();

                const data = await apiCall('/api/directories', {}, false);
                if (data.success) {
                    directoryTreeCache = Array.isArray(data.directories) ? data.directories : [];
                    renderDirectoryTree(directoryTreeCache, directoryTreeEl);
                } else {
                    directoryTreeEl.innerHTML = '<p class="text-danger mb-0 p-3">无法加载目录</p>';
                }
            }

            function renderDirectoryTree(nodes, container) {
                container.innerHTML = '';
                directoryChildrenByParent = new Map();

                nodes.forEach(node => {
                    const parent = node.parent || '/';
                    if (!directoryChildrenByParent.has(parent)) directoryChildrenByParent.set(parent, []);
                    directoryChildrenByParent.get(parent).push(node);
                });

                const createFolderItem = ({ name, path, hasChildren, level, isRoot = false }) => {
                    const item = document.createElement('a');
                    item.href = '#';
                    item.className = 'list-group-item list-group-item-action';
                    item.dataset.path = path;
                    item.style.paddingLeft = (1.25 + level * 1.5) + 'rem';

                    if (hasChildren) {
                        const targetId = 'tree-' + path.replace(/[^a-zA-Z0-9]/g, '-');
                        item.setAttribute('data-bs-toggle', 'collapse');
                        item.setAttribute('data-bs-target', '#' + targetId);
                        item.dataset.hasChildren = 'true';
                        item.dataset.targetId = targetId;
                        item.dataset.loaded = 'false';
                        item.dataset.level = String(level);

                        const toggler = document.createElement('i');
                        toggler.className = 'bi bi-chevron-right me-2 toggle-icon';
                        item.appendChild(toggler);
                    } else if (!isRoot) {
                        const spacer = document.createElement('span');
                        spacer.className = 'me-2';
                        spacer.style.width = '1em';
                        spacer.style.display = 'inline-block';
                        item.appendChild(spacer);
                    }

                    const icon = document.createElement('i');
                    icon.className = 'bi ' + (isRoot ? 'bi-folder-fill' : 'bi-folder') + ' me-2';
                    item.appendChild(icon);
                    item.append(document.createTextNode(name));
                    return item;
                };

                const appendDirectoryChildren = (parentPath, parentElement, level) => {
                    const children = directoryChildrenByParent.get(parentPath) || [];
                    children.forEach(node => {
                        const childNodes = directoryChildrenByParent.get(node.path) || [];
                        const hasChildren = childNodes.length > 0;
                        const item = createFolderItem({
                            name: node.name,
                            path: node.path,
                            hasChildren,
                            level,
                        });
                        parentElement.appendChild(item);

                        if (hasChildren) {
                            const subContainer = document.createElement('div');
                            subContainer.className = 'collapse';
                            subContainer.id = 'tree-' + node.path.replace(/[^a-zA-Z0-9]/g, '-');
                            parentElement.appendChild(subContainer);
                        }
                    });
                };
                container.renderTreeChildren = appendDirectoryChildren;

                const fragment = document.createDocumentFragment();
                fragment.appendChild(createFolderItem({
                    name: '根目录',
                    path: '/',
                    hasChildren: false,
                    level: 0,
                    isRoot: true,
                }));
                appendDirectoryChildren('/', fragment, 0);
                container.appendChild(fragment);
            }

            directoryTreeEl.addEventListener('click', (e) => {
                e.preventDefault();
                if (isMoveCopyBusy) return;
                const target = e.target.closest('.list-group-item');
                if (target) {
                    directoryTreeEl.querySelectorAll('.list-group-item').forEach(i => i.classList.remove('active'));
                    target.classList.add('active');
                    selectedDestination = target.dataset.path;
                    confirmMoveCopyBtn.disabled = false;

                    if (target.dataset.hasChildren === 'true' && target.dataset.loaded !== 'true') {
                        const subContainer = document.getElementById(target.dataset.targetId);
                        if (subContainer && typeof directoryTreeEl.renderTreeChildren === 'function') {
                            directoryTreeEl.renderTreeChildren(target.dataset.path, subContainer, Number(target.dataset.level || 0) + 1);
                            target.dataset.loaded = 'true';
                        }
                    }

                    const icon = target.querySelector('.toggle-icon');
                    if (icon) {
                        icon.classList.toggle('bi-chevron-right');
                        icon.classList.toggle('bi-chevron-down');
                    }
                }
            });

            createFolderInModalBtn.addEventListener('click', async () => {
                const newNameInput = document.getElementById('newFolderNameInModal');
                const folderName = newNameInput.value.trim();
                if (!folderName || !selectedDestination) {
                    showNotification('请先选择一个父目录并输入文件夹名称', 'danger');
                    return;
                }
                const path = (selectedDestination === '/' ? '' : selectedDestination) + folderName + '/';
                const originalHtml = createFolderInModalBtn.innerHTML;
                createFolderInModalBtn.disabled = true;
                createFolderInModalBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';

                try {
                    const result = await apiCall('/api/create-folder', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path })
                    }, false);
                    if (result.success) {
                        showNotification('文件夹创建成功', 'success');
                        newNameInput.value = '';
                        directoryTreeCache = null;
                        await loadDirectoryTree({ force: true });
                        const parentItem = Array.from(directoryTreeEl.querySelectorAll('.list-group-item')).find(item => item.dataset.path === selectedDestination);
                        if (parentItem) parentItem.classList.add('active');
                    }
                } finally {
                    createFolderInModalBtn.disabled = false;
                    createFolderInModalBtn.innerHTML = originalHtml;
                }
            });

            document.getElementById('moveBtn').addEventListener('click', () => setupMoveCopy('move'));
            document.getElementById('copyBtn').addEventListener('click', () => setupMoveCopy('copy'));

            confirmMoveCopyBtn.addEventListener('click', async () => {
                const sourceKeys = getSelectedFileKeys();
                if (sourceKeys.length === 0 || selectedDestination === null || isMoveCopyBusy) return;

                const originalHtml = confirmMoveCopyBtn.innerHTML;
                const actionText = currentAction === 'move' ? '移动' : '复制';
                isMoveCopyBusy = true;
                confirmMoveCopyBtn.disabled = true;
                confirmMoveCopyBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>' + actionText + '中...';
                createFolderInModalBtn.disabled = true;

                await nextFrame();
                const result = await apiCall('/api/files/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: currentAction,
                        sourceKeys,
                        destinationPrefix: selectedDestination
                    })
                }, false);

                isMoveCopyBusy = false;
                createFolderInModalBtn.disabled = false;

                if (result.success) {
                    showNotification(result.message, 'success');
                    moveCopyModal.hide();
                    refreshGallery();
                } else {
                    confirmMoveCopyBtn.innerHTML = originalHtml;
                    confirmMoveCopyBtn.disabled = selectedDestination === null;
                }
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
