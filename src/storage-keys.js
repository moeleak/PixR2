export const SHARE_KV_PREFIX = 'share:';
export const TELEGRAM_PATH_KV_PREFIX = 'telegram:path:';

export const isValidShareId = (shareId = '') => /^[A-Za-z0-9]{16,64}$/.test(shareId);
export const shareKvKey = (shareId) => `${SHARE_KV_PREFIX}${shareId}`;
export const telegramPathKey = (chatId) => `${TELEGRAM_PATH_KV_PREFIX}${chatId}`;
