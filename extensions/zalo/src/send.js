import { resolveZaloAccount } from './accounts.js';
import { sendMessage, sendPhoto } from './api.js';
import { resolveZaloProxyFetch } from './proxy.js';
import { resolveZaloToken } from './token.js';
function resolveSendContext(options) {
  if (options.cfg) {
    const account = resolveZaloAccount({
      cfg: options.cfg,
      accountId: options.accountId
    });
    const token2 = options.token || account.token;
    const proxy2 = options.proxy ?? account.config.proxy;
    return { token: token2, fetcher: resolveZaloProxyFetch(proxy2) };
  }
  const token = options.token ?? resolveZaloToken(void 0, options.accountId).token;
  const proxy = options.proxy;
  return { token, fetcher: resolveZaloProxyFetch(proxy) };
}
async function sendMessageZalo(chatId, text, options = {}) {
  const { token, fetcher } = resolveSendContext(options);
  if (!token) {
    return { ok: false, error: 'No Zalo bot token configured' };
  }
  if (!chatId?.trim()) {
    return { ok: false, error: 'No chat_id provided' };
  }
  if (options.mediaUrl) {
    return sendPhotoZalo(chatId, options.mediaUrl, {
      ...options,
      token,
      caption: text || options.caption
    });
  }
  try {
    const response = await sendMessage(
      token,
      {
        chat_id: chatId.trim(),
        text: text.slice(0, 2e3)
      },
      fetcher
    );
    if (response.ok && response.result) {
      return { ok: true, messageId: response.result.message_id };
    }
    return { ok: false, error: 'Failed to send message' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
async function sendPhotoZalo(chatId, photoUrl, options = {}) {
  const { token, fetcher } = resolveSendContext(options);
  if (!token) {
    return { ok: false, error: 'No Zalo bot token configured' };
  }
  if (!chatId?.trim()) {
    return { ok: false, error: 'No chat_id provided' };
  }
  if (!photoUrl?.trim()) {
    return { ok: false, error: 'No photo URL provided' };
  }
  try {
    const response = await sendPhoto(
      token,
      {
        chat_id: chatId.trim(),
        photo: photoUrl.trim(),
        caption: options.caption?.slice(0, 2e3)
      },
      fetcher
    );
    if (response.ok && response.result) {
      return { ok: true, messageId: response.result.message_id };
    }
    return { ok: false, error: 'Failed to send photo' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
export {
  sendMessageZalo,
  sendPhotoZalo
};
