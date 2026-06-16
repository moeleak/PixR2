import { getBasePageStyles, getGalleryStyles, getLoadingOverlayStyles, getPreviewStyles } from './shared.js';

export function getShareStyles() {
    return `
${getBasePageStyles()}${getGalleryStyles()}${getPreviewStyles()}
${getLoadingOverlayStyles()}
    `;
}
