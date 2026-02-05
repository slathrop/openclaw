import { markdownToTelegramHtmlChunks } from '../../../telegram/format.js';
import { sendMessageTelegram } from '../../../telegram/send.js';
function parseReplyToMessageId(replyToId) {
  if (!replyToId) {
    return void 0;
  }
  const parsed = Number.parseInt(replyToId, 10);
  return Number.isFinite(parsed) ? parsed : void 0;
}
function parseThreadId(threadId) {
  if (threadId === null || threadId === undefined) {
    return void 0;
  }
  if (typeof threadId === 'number') {
    return Number.isFinite(threadId) ? Math.trunc(threadId) : void 0;
  }
  const trimmed = threadId.trim();
  if (!trimmed) {
    return void 0;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : void 0;
}
const telegramOutbound = {
  deliveryMode: 'direct',
  chunker: markdownToTelegramHtmlChunks,
  chunkerMode: 'markdown',
  textChunkLimit: 4e3,
  sendText: async ({ to, text, accountId, deps, replyToId, threadId }) => {
    const send = deps?.sendTelegram ?? sendMessageTelegram;
    const replyToMessageId = parseReplyToMessageId(replyToId);
    const messageThreadId = parseThreadId(threadId);
    const result = await send(to, text, {
      verbose: false,
      textMode: 'html',
      messageThreadId,
      replyToMessageId,
      accountId: accountId ?? void 0
    });
    return { channel: 'telegram', ...result };
  },
  sendMedia: async ({ to, text, mediaUrl, accountId, deps, replyToId, threadId }) => {
    const send = deps?.sendTelegram ?? sendMessageTelegram;
    const replyToMessageId = parseReplyToMessageId(replyToId);
    const messageThreadId = parseThreadId(threadId);
    const result = await send(to, text, {
      verbose: false,
      mediaUrl,
      textMode: 'html',
      messageThreadId,
      replyToMessageId,
      accountId: accountId ?? void 0
    });
    return { channel: 'telegram', ...result };
  },
  sendPayload: async ({ to, payload, accountId, deps, replyToId, threadId }) => {
    const send = deps?.sendTelegram ?? sendMessageTelegram;
    const replyToMessageId = parseReplyToMessageId(replyToId);
    const messageThreadId = parseThreadId(threadId);
    const telegramData = payload.channelData?.telegram;
    const quoteText = typeof telegramData?.quoteText === 'string' ? telegramData.quoteText : void 0;
    const text = payload.text ?? '';
    const mediaUrls = payload.mediaUrls?.length ? payload.mediaUrls : payload.mediaUrl ? [payload.mediaUrl] : [];
    const baseOpts = {
      verbose: false,
      textMode: 'html',
      messageThreadId,
      replyToMessageId,
      quoteText,
      accountId: accountId ?? void 0
    };
    if (mediaUrls.length === 0) {
      const result = await send(to, text, {
        ...baseOpts,
        buttons: telegramData?.buttons
      });
      return { channel: 'telegram', ...result };
    }
    let finalResult;
    for (let i = 0; i < mediaUrls.length; i += 1) {
      const mediaUrl = mediaUrls[i];
      const isFirst = i === 0;
      finalResult = await send(to, isFirst ? text : '', {
        ...baseOpts,
        mediaUrl,
        ...isFirst ? { buttons: telegramData?.buttons } : {}
      });
    }
    return { channel: 'telegram', ...finalResult ?? { messageId: 'unknown', chatId: to } };
  }
};
export {
  telegramOutbound
};
