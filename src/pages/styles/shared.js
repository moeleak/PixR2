import { getMotionStyles } from '../motion.js';

export function getBasePageStyles() {
    return `
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

    `;
}

export function getGalleryStyles() {
    return `        .gallery .item {
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

    `;
}

export function getPreviewStyles() {
    return `        .image-preview-overlay {
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
	        .preview-control {
	            z-index: 1202;
	            width: 3rem;
	            height: 3rem;
	            display: inline-flex;
	            align-items: center;
	            justify-content: center;
	            padding: 0;
	            border-color: rgba(15, 23, 42, .22);
	            background-color: rgba(255, 255, 255, .94);
	            color: #212529;
	            box-shadow: 0 .7rem 1.5rem rgba(15, 23, 42, .18);
	            touch-action: manipulation;
	        }
	        .preview-control:hover,
	        .preview-control:focus {
	            background-color: #fff;
	            color: #212529;
	        }
	        .preview-control:disabled {
	            opacity: .35;
	        }
	        .preview-close-btn {
	            z-index: 1203;
	            padding: .75rem;
	            border-radius: 50%;
	            background-color: rgba(255, 255, 255, .94);
	            box-shadow: 0 .55rem 1.2rem rgba(15, 23, 42, .14);
	            opacity: 1;
	            touch-action: manipulation;
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
	        @media (max-width: 575.98px) {
	            .image-preview-overlay {
	                padding: .75rem .75rem calc(4.75rem + env(safe-area-inset-bottom));
	            }
	            .preview-content {
	                max-width: calc(100vw - 1.5rem);
	                max-height: calc(100dvh - 6.5rem);
	            }
	            .preview-nav-btn {
	                top: auto !important;
	                bottom: max(.75rem, env(safe-area-inset-bottom)) !important;
	                width: 2.75rem;
	                height: 2.75rem;
	                margin: 0 !important;
	                transform: none !important;
	            }
	            #previewPrevBtn {
	                right: auto !important;
	                left: calc(50% - 3.25rem) !important;
	            }
	            #previewNextBtn {
	                right: auto !important;
	                left: calc(50% + .5rem) !important;
	            }
	            .preview-close-btn {
	                margin: .75rem !important;
	            }
	        }

    `;
}

export function getLoadingOverlayStyles() {
    return `        .loading-overlay {
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

    `;
}
