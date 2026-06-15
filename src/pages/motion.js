export function getMotionStyles() {
    return `
            :root {
                --pixr2-ease: cubic-bezier(0.22, 1, 0.36, 1);
                --pixr2-fast: 160ms;
                --pixr2-normal: 240ms;
            }
            .navbar-brand,
            .nav-link,
            .btn,
            .btn-close,
            .form-control,
            .list-group-item,
            .page-link {
                transition:
                    color var(--pixr2-fast) var(--pixr2-ease),
                    background-color var(--pixr2-fast) var(--pixr2-ease),
                    border-color var(--pixr2-fast) var(--pixr2-ease),
                    box-shadow var(--pixr2-fast) var(--pixr2-ease),
                    opacity var(--pixr2-fast) var(--pixr2-ease),
                    transform var(--pixr2-fast) var(--pixr2-ease);
            }
            .navbar-brand:hover,
            .nav-link:hover,
            .btn:hover:not(:disabled),
            .page-link:hover,
            .form-control:focus {
                transform: translateY(-1px);
            }
            .btn:active:not(:disabled),
            .page-link:active {
                transform: translateY(0) scale(0.98);
            }
            .modal.fade .modal-dialog {
                transform: translateY(12px) scale(0.98);
                transition: transform var(--pixr2-normal) var(--pixr2-ease);
            }
            .modal.show .modal-dialog {
                transform: none;
            }
            .toast {
                transition:
                    opacity var(--pixr2-normal) var(--pixr2-ease),
                    transform var(--pixr2-normal) var(--pixr2-ease);
            }
            @keyframes pixr2-fade-up {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @media (prefers-reduced-motion: reduce) {
                *,
                *::before,
                *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    scroll-behavior: auto !important;
                    transition-duration: 0.01ms !important;
                }
                .navbar-brand:hover,
                .nav-link:hover,
                .btn:hover:not(:disabled),
                .page-link:hover,
                .btn:active:not(:disabled),
                .page-link:active,
                .form-control:focus {
                    transform: none;
                }
            }
    `;
}
