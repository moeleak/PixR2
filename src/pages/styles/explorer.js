import { getBasePageStyles, getGalleryStyles, getLoadingOverlayStyles, getPreviewStyles } from './shared.js';

export function getExplorerStyles() {
    return `
${getBasePageStyles()}${getGalleryStyles()}	        .gallery .item .checkbox {
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
	        .gallery .item[draggable="true"] .card {
	            cursor: grab;
	            -webkit-touch-callout: none;
	        }
	        .gallery .item[draggable="true"] .card:active {
	            cursor: grabbing;
	        }
	        .gallery .item.dragging .card,
	        .gallery .item.touch-drag-source .card {
	            opacity: .58;
	            transform: scale(.985);
	            box-shadow: 0 .5rem 1.2rem rgba(15, 23, 42, .12)!important;
	        }
	        .gallery.is-dragging-item .item[data-item-type="directory"] .card,
	        .gallery.is-touch-dragging .item[data-item-type="directory"] .card {
	            border-style: dashed;
	        }
	        .gallery .item.drop-target .card {
	            border-color: var(--bs-primary);
	            box-shadow: 0 0 0 .18rem rgba(13, 110, 253, .18), 0 1rem 2rem rgba(13, 110, 253, .12)!important;
	            transform: translateY(-2px);
	        }
	        .gallery .item.drop-target .directory-shell {
	            background: linear-gradient(135deg, #e7f1ff 0%, #d7e7ff 100%);
	            color: var(--bs-primary);
	        }
	        .gallery .item.drop-target .file-type-icon {
	            transform: scale(1.08);
	        }
	        .gallery .item.drop-target-invalid .card {
	            border-color: var(--bs-danger);
	            box-shadow: 0 0 0 .18rem rgba(220, 53, 69, .14)!important;
	        }
	        .gallery .item.drop-target-invalid .directory-shell {
	            background: linear-gradient(135deg, #fff0f0 0%, #ffe1e1 100%);
	            color: var(--bs-danger);
	        }
	        .gallery .item.is-moving .card {
	            pointer-events: none;
	            border-color: var(--bs-primary);
	            box-shadow: 0 0 0 .18rem rgba(13, 110, 253, .14)!important;
	        }
	        .gallery .item.is-moving .card::after {
	            content: "";
	            position: absolute;
	            inset: 0;
	            background: rgba(255, 255, 255, .58);
	        }
	        .gallery .item.is-moving .card::before {
	            content: "";
	            position: absolute;
	            top: 50%;
	            left: 50%;
	            z-index: 12;
	            width: 2rem;
	            height: 2rem;
	            margin: -1rem 0 0 -1rem;
	            border: .22rem solid rgba(13, 110, 253, .22);
	            border-top-color: var(--bs-primary);
	            border-radius: 50%;
	            animation: pixr2-spin 680ms linear infinite;
	        }
	        @keyframes pixr2-spin {
	            to { transform: rotate(360deg); }
	        }
	        body.pixr2-touch-dragging {
	            cursor: grabbing;
	            user-select: none;
	            -webkit-user-select: none;
	        }
	        body.pixr2-touch-dragging * {
	            -webkit-touch-callout: none;
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
	        .page-drop-overlay {
	            position: fixed;
	            inset: 0;
	            z-index: 1040;
	            display: flex;
	            align-items: center;
	            justify-content: center;
	            padding: 1.25rem;
	            background: rgba(248, 249, 250, .72);
	            opacity: 0;
	            visibility: hidden;
	            pointer-events: none;
	            transition:
	                opacity var(--pixr2-normal) var(--pixr2-ease),
	                visibility var(--pixr2-normal) var(--pixr2-ease);
	        }
	        .page-drop-overlay.show {
	            opacity: 1;
	            visibility: visible;
	        }
	        .page-drop-overlay__panel {
	            width: min(28rem, 100%);
	            border: 2px dashed var(--bs-primary);
	            border-radius: .75rem;
	            background: rgba(255, 255, 255, .94);
	            box-shadow: 0 1.25rem 3rem rgba(15, 23, 42, .16);
	            color: #212529;
	            padding: 2.5rem 1.5rem;
	            text-align: center;
	            transform: translateY(8px) scale(.98);
	            transition: transform var(--pixr2-normal) var(--pixr2-ease);
	        }
	        .page-drop-overlay.show .page-drop-overlay__panel {
	            transform: translateY(0) scale(1);
	        }
	        .page-drop-overlay__panel .bi {
	            font-size: 2.75rem;
	        }
	        .item-context-menu {
	            position: fixed;
	            z-index: 1300;
	            display: none;
	            min-width: 9.5rem;
	            padding: .35rem;
	            border: 1px solid rgba(15, 23, 42, .12);
	            border-radius: .5rem;
	            background: rgba(255, 255, 255, .98);
	            box-shadow: 0 .85rem 2rem rgba(15, 23, 42, .16);
	        }
	        .item-context-menu.show {
	            display: block;
	            animation: pixr2-fade-up var(--pixr2-fast) var(--pixr2-ease) both;
	        }
	        .item-context-menu .dropdown-item {
	            display: flex;
	            align-items: center;
	            border-radius: .35rem;
	            gap: .55rem;
	        }
${getPreviewStyles()}
${getLoadingOverlayStyles()}
    `;
}
