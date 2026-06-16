import { getMotionStyles } from '../motion.js';

export function getLoginStyles() {
    return `
            ${getMotionStyles()}
            body {
                display: flex;
                align-items: flex-start;
                justify-content: center;
                min-height: 100vh;
                min-height: 100dvh;
                margin: 0;
                padding: 2rem 1rem;
                background-color: #f8f9fa;
            }
            .form-signin {
                width: 100%;
                max-width: 400px;
                padding: 0;
                margin: min(12vh, 5rem) auto 0;
            }
            .form-signin .card {
                animation: pixr2-fade-up var(--pixr2-normal) var(--pixr2-ease) both;
            }
            @media (max-width: 575.98px) {
                body {
                    min-height: 100svh;
                    padding-top: 1.25rem;
                }
                .form-signin {
                    margin-top: 0;
                }
                .form-signin .card-body {
                    padding: 2rem !important;
                }
            }

        `;
}
