import { R2_PUBLIC_BASE_URL } from '../config.js';
import { telegramPathKey } from '../storage-keys.js';
import { buildMarkdownLink, buildObjectUrl, escapeHtmlForTelegram, normalizeR2Prefix, uploadFileToR2 } from '../utils/files.js';

const TELEGRAM_SECRET_HEADER = 'X-Telegram-Bot-Api-Secret-Token';
const textEncoder = new TextEncoder();

/**
 * 调用Telegram API来设置webhook
 * @param {string} webhookUrl - 要设置的webhook URL
 * @param {string} apiUrl - Telegram Bot API的基础URL
 * @param {string} secretToken - Telegram webhook secret token
 * @returns {Promise<object>} - Telegram API的响应结果
 */
export async function setWebhook(webhookUrl, apiUrl, secretToken) {
    try {
        const response = await fetch(`${apiUrl}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: webhookUrl,
                secret_token: secretToken,
            }),
        });

        const result = await response.json();

        if (!result.ok) {
            console.error('Failed to set webhook:', result.description);
        }

        return result;
    } catch (error) {
        console.error('Error setting webhook:', error);
        return { ok: false, description: error.message };
    }
}

export async function handleTelegramWebhook(request, env) {
    try {
        if (!isValidTelegramSecret(request, env.TELEGRAM_WEBHOOK_SECRET)) {
            return new Response('Forbidden', { status: 403 });
        }

        const update = await request.json();

        // 如果更新中没有消息，直接返回OK
        if (!update.message) {
            return new Response('OK');
        }

        const chatId = update.message.chat.id;

        // 检查用户是否已授权 (USER_ID/CHAT_ID环境变量中是否包含该用户的ID)
        const allowedChatIds = (env.USER_ID || env.CHAT_ID)
            .split(',')
            .map(id => id.trim())
            .filter(Boolean);
        if (!allowedChatIds.includes(chatId.toString())) {
            await sendMessage(chatId, '用户未授权！', `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`);
            return new Response('OK');
        }

        // 获取用户当前上传路径的函数
        async function getUserPath(chatId) {
            const legacyKey = chatId.toString();
            const currentKey = telegramPathKey(chatId);
            const path = await env.INDEXES_KV.get(currentKey);
            if (path !== null) {
                return normalizeTelegramPath(path);
            }

            const legacyPath = await env.INDEXES_KV.get(legacyKey);
            if (legacyPath === null) {
                return ''; // 默认为空字符串 (根路径)
            }

            const normalizedPath = normalizeTelegramPath(legacyPath);
            await env.INDEXES_KV.put(currentKey, normalizedPath);
            await env.INDEXES_KV.delete(legacyKey);
            return normalizedPath;
        }

        // 设置用户上传路径的函数
        async function setUserPath(chatId, path) {
            await env.INDEXES_KV.put(telegramPathKey(chatId), path);
        }

        // 处理媒体文件上传的函数
        async function handleMediaUpload(chatId, fileId, messageId, isDocument = false, originalName = '', mimeType = '') {
            try {
                const fileUrl = await getFileUrl(fileId, env.TELEGRAM_BOT_TOKEN);
                const userPath = await getUserPath(chatId);
                const uploadResult = await uploadFileToR2(fileUrl, env.BUCKET_R2, isDocument, userPath, originalName, mimeType);

                if (uploadResult.ok) {
                    const fileUrl = buildObjectUrl(R2_PUBLIC_BASE_URL, uploadResult.key);
                    const markdownLink = buildMarkdownLink(uploadResult.fileName, fileUrl, uploadResult.isImage);
                    const messageText = `直链:\n<code>${escapeHtmlForTelegram(fileUrl)}</code>\nMarkdown:\n<code>${escapeHtmlForTelegram(markdownLink)}</code>`;
                    await sendMessage(chatId, messageText, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`, {
                        parse_mode: "HTML",
                        reply_to_message_id: messageId
                    });
                } else {
                    await sendMessage(chatId, uploadResult.message, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`, {
                        reply_to_message_id: messageId
                    });
                }
            } catch (error) {
                console.error('处理文件失败:', error);
                await sendMessage(chatId, '文件处理失败，请稍后再试。', `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`, {
                    reply_to_message_id: messageId
                });
            }
        }

        // 处理文本消息
        if (update.message.text) {
            const text = update.message.text.trim();

            // 处理 /modify 命令，用于修改上传路径
            if (text.startsWith('/modify')) {
                const requestedPath = text.slice('/modify'.length).trim();
                if (requestedPath) {
                    try {
                        const newPath = normalizeR2Prefix(requestedPath);
                        await setUserPath(chatId, newPath);
                        await sendMessage(chatId, `修改路径为${newPath || '/'}`, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`);
                    } catch {
                        await sendMessage(chatId, '路径无效，请不要使用控制字符、绝对路径或 .. 路径段。', `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`);
                    }
                } else {
                    await sendMessage(chatId, '请指定路径，例如: /modify blog', `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`);
                }
                return new Response('OK');
            }

            // 处理 /status 命令，用于查看当前上传路径
            if (text === '/status') {
                const currentPath = await getUserPath(chatId);
                const statusMessage = currentPath ? `当前路径: ${currentPath}` : '当前路径: / (默认)';
                await sendMessage(chatId, statusMessage, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`);
                return new Response('OK');
            }

            // 对于其他文本消息，发送帮助信息
            let mes = `请发送文件或图片！\n或者使用以下命令：\n/modify 修改上传文件的存储路径\n/status 查看当前上传路径`;
            await sendMessage(chatId, mes, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`);
            return new Response('OK');
        }

        // 处理以文件形式发送的内容
        if (update.message.document) {
            const doc = update.message.document;
            await handleMediaUpload(chatId, doc.file_id, update.message.message_id, true, doc.file_name || '', doc.mime_type || '');
            return new Response('OK');
        }

        // 处理以图片形式发送的内容
        if (update.message.photo) {
            // Telegram会发送多个尺寸的图片，选择最大尺寸的
            const fileId = update.message.photo.slice(-1)[0].file_id;
            await handleMediaUpload(chatId, fileId, update.message.message_id);
            return new Response('OK');
        }

        return new Response('OK');
    } catch (err) {
        console.error(err);
        return new Response('Error processing request', { status: 500 });
    }
}

function normalizeTelegramPath(path = '') {
    return path === '/' ? '' : normalizeR2Prefix(path);
}

/**
 * 从Telegram获取文件的临时下载URL
 * @param {string} fileId - 文件的唯一ID
 * @param {string} botToken - Telegram机器人的Token
 * @returns {Promise<string>} - 文件的可下载URL
 */
async function getFileUrl(fileId, botToken) {
    const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    if (!response.ok) throw new Error('Telegram getFile request failed');

    const data = await response.json();
    if (!data.ok || !data.result?.file_path) {
        throw new Error(data.description || 'Telegram getFile response is invalid');
    }

    return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
}

function isValidTelegramSecret(request, expectedSecret) {
    const actualSecret = request.headers.get(TELEGRAM_SECRET_HEADER) || '';
    return Boolean(expectedSecret) && timingSafeEqual(actualSecret, expectedSecret);
}

function timingSafeEqual(left = '', right = '') {
    const leftBytes = textEncoder.encode(String(left));
    const rightBytes = textEncoder.encode(String(right));
    let diff = leftBytes.length ^ rightBytes.length;
    const length = Math.max(leftBytes.length, rightBytes.length);

    for (let index = 0; index < length; index++) {
        diff |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
    }

    return diff === 0;
}

/**
 * 向指定的Telegram聊天发送文本消息
 * @param {number|string} chatId - 聊天ID
 * @param {string} text - 要发送的文本
 * @param {string} apiUrl - Telegram Bot API的基础URL
 * @param {object} options - 其他API选项 (例如 parse_mode)
 */
async function sendMessage(chatId, text, apiUrl, options = {}) {
    await fetch(`${apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            ...options
        }),
    });
}

/**
 * 向指定的Telegram聊天发送图片
 * @param {number|string} chatId - 聊天ID
 * @param {string} photoUrl - 图片的URL
 * @param {string} apiUrl - Telegram Bot API的基础URL
 * @param {string} caption - 图片的标题
 * @param {object} options - 其他API选项 (例如 parse_mode)
 * @returns {Promise<object>} - Telegram API的响应
 */
async function sendPhoto(chatId, photoUrl, apiUrl, caption = "", options = {}) {
    const response = await fetch(`${apiUrl}/sendPhoto`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            photo: photoUrl,
            caption: caption,
            ...options
        }),
    });
    return await response.json();
}
