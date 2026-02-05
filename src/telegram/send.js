import { Bot, HttpError, InputFile } from 'grammy';
import { loadConfig } from '../config/config.js';
import { resolveMarkdownTableMode } from '../config/markdown-tables.js';
import { logVerbose } from '../globals.js';
import { recordChannelActivity } from '../infra/channel-activity.js';
import { isDiagnosticFlagEnabled } from '../infra/diagnostic-flags.js';
import { formatErrorMessage, formatUncaughtError } from '../infra/errors.js';
import { createTelegramRetryRunner } from '../infra/retry-policy.js';
import { redactSensitiveText } from '../logging/redact.js';
import { createSubsystemLogger } from '../logging/subsystem.js';
import { mediaKindFromMime } from '../media/constants.js';
import { isGifMedia } from '../media/mime.js';
import { loadWebMedia } from '../web/media.js';
import { resolveTelegramAccount } from './accounts.js';
import { withTelegramApiErrorLogging } from './api-logging.js';
import { buildTelegramThreadParams } from './bot/helpers.js';
import { splitTelegramCaption } from './caption.js';
import { resolveTelegramFetch } from './fetch.js';
import { renderTelegramHtmlText } from './format.js';
import { isRecoverableTelegramNetworkError } from './network-errors.js';
import { makeProxyFetch } from './proxy.js';
import { recordSentMessage } from './sent-message-cache.js';
import { parseTelegramTarget, stripTelegramInternalPrefixes } from './targets.js';
import { resolveTelegramVoiceSend } from './voice.js';
const PARSE_ERR_RE = /can't parse entities|parse entities|find end of the entity/i;
const diagLogger = createSubsystemLogger('telegram/diagnostic');
function createTelegramHttpLogger(cfg) {
  const enabled = isDiagnosticFlagEnabled('telegram.http', cfg);
  if (!enabled) {
    return () => {
    };
  }
  return (label, err) => {
    if (!(err instanceof HttpError)) {
      return;
    }
    const detail = redactSensitiveText(formatUncaughtError(err.error ?? err));
    diagLogger.warn(`telegram http error (${label}): ${detail}`);
  };
}
function resolveTelegramClientOptions(account) {
  const proxyUrl = account.config.proxy?.trim();
  const proxyFetch = proxyUrl ? makeProxyFetch(proxyUrl) : void 0;
  const fetchImpl = resolveTelegramFetch(proxyFetch, {
    network: account.config.network
  });
  const timeoutSeconds = typeof account.config.timeoutSeconds === 'number' && Number.isFinite(account.config.timeoutSeconds) ? Math.max(1, Math.floor(account.config.timeoutSeconds)) : void 0;
  return fetchImpl || timeoutSeconds ? {
    ...fetchImpl ? { fetch: fetchImpl } : {},
    ...timeoutSeconds ? { timeoutSeconds } : {}
  } : void 0;
}
function resolveToken(explicit, params) {
  if (explicit?.trim()) {
    return explicit.trim();
  }
  if (!params.token) {
    throw new Error(
      `Telegram bot token missing for account "${params.accountId}" (set channels.telegram.accounts.${params.accountId}.botToken/tokenFile or TELEGRAM_BOT_TOKEN for default).`
    );
  }
  return params.token.trim();
}
function normalizeChatId(to) {
  const trimmed = to.trim();
  if (!trimmed) {
    throw new Error('Recipient is required for Telegram sends');
  }
  let normalized = stripTelegramInternalPrefixes(trimmed);
  const m = /^https?:\/\/t\.me\/([A-Za-z0-9_]+)$/i.exec(normalized) ?? /^t\.me\/([A-Za-z0-9_]+)$/i.exec(normalized);
  if (m?.[1]) {
    normalized = `@${m[1]}`;
  }
  if (!normalized) {
    throw new Error('Recipient is required for Telegram sends');
  }
  if (normalized.startsWith('@')) {
    return normalized;
  }
  if (/^-?\d+$/.test(normalized)) {
    return normalized;
  }
  if (/^[A-Za-z0-9_]{5,}$/i.test(normalized)) {
    return `@${normalized}`;
  }
  return normalized;
}
function normalizeMessageId(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!value) {
      throw new Error('Message id is required for Telegram actions');
    }
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  throw new Error('Message id is required for Telegram actions');
}
function buildInlineKeyboard(buttons) {
  if (!buttons?.length) {
    return void 0;
  }
  const rows = buttons.map(
    (row) => row.filter((button) => button?.text && button?.callback_data).map(
      (button) => ({
        text: button.text,
        callback_data: button.callback_data
      })
    )
  ).filter((row) => row.length > 0);
  if (rows.length === 0) {
    return void 0;
  }
  return { inline_keyboard: rows };
}
async function sendMessageTelegram(to, text, opts = {}) {
  const cfg = loadConfig();
  const account = resolveTelegramAccount({
    cfg,
    accountId: opts.accountId
  });
  const token = resolveToken(opts.token, account);
  const target = parseTelegramTarget(to);
  const chatId = normalizeChatId(target.chatId);
  const client = resolveTelegramClientOptions(account);
  const api = opts.api ?? new Bot(token, client ? { client } : void 0).api;
  const mediaUrl = opts.mediaUrl?.trim();
  const replyMarkup = buildInlineKeyboard(opts.buttons);
  const messageThreadId = opts.messageThreadId !== null && opts.messageThreadId !== undefined ? opts.messageThreadId : target.messageThreadId;
  const threadSpec = messageThreadId !== null && messageThreadId !== undefined ? { id: messageThreadId, scope: 'forum' } : void 0;
  const threadIdParams = buildTelegramThreadParams(threadSpec);
  const threadParams = threadIdParams ? { ...threadIdParams } : {};
  const quoteText = opts.quoteText?.trim();
  if (opts.replyToMessageId !== null && opts.replyToMessageId !== undefined) {
    if (quoteText) {
      threadParams.reply_parameters = {
        message_id: Math.trunc(opts.replyToMessageId),
        quote: quoteText
      };
    } else {
      threadParams.reply_to_message_id = Math.trunc(opts.replyToMessageId);
    }
  }
  const hasThreadParams = Object.keys(threadParams).length > 0;
  const request = createTelegramRetryRunner({
    retry: opts.retry,
    configRetry: account.config.retry,
    verbose: opts.verbose,
    shouldRetry: (err) => isRecoverableTelegramNetworkError(err, { context: 'send' })
  });
  const logHttpError = createTelegramHttpLogger(cfg);
  const requestWithDiag = (fn, label) => withTelegramApiErrorLogging({
    operation: label ?? 'request',
    fn: () => request(fn, label)
  }).catch((err) => {
    logHttpError(label ?? 'request', err);
    throw err;
  });
  const wrapChatNotFound = (err) => {
    if (!/400: Bad Request: chat not found/i.test(formatErrorMessage(err))) {
      return err;
    }
    return new Error(
      [
        `Telegram send failed: chat not found (chat_id=${chatId}).`,
        'Likely: bot not started in DM, bot removed from group/channel, group migrated (new -100\u2026 id), or wrong bot token.',
        `Input was: ${JSON.stringify(to)}.`
      ].join(' ')
    );
  };
  const textMode = opts.textMode ?? 'markdown';
  const tableMode = resolveMarkdownTableMode({
    cfg,
    channel: 'telegram',
    accountId: account.accountId
  });
  const renderHtmlText = (value) => renderTelegramHtmlText(value, { textMode, tableMode });
  const linkPreviewEnabled = account.config.linkPreview ?? true;
  const linkPreviewOptions = linkPreviewEnabled ? void 0 : { is_disabled: true };
  const sendTelegramText = async (rawText, params, fallbackText) => {
    const htmlText = renderHtmlText(rawText);
    const baseParams = params ? { ...params } : {};
    if (linkPreviewOptions) {
      baseParams.link_preview_options = linkPreviewOptions;
    }
    const hasBaseParams = Object.keys(baseParams).length > 0;
    const sendParams = {
      parse_mode: 'HTML',
      ...baseParams,
      ...opts.silent === true ? { disable_notification: true } : {}
    };
    const res2 = await requestWithDiag(
      () => api.sendMessage(chatId, htmlText, sendParams),
      'message'
    ).catch(async (err) => {
      const errText = formatErrorMessage(err);
      if (PARSE_ERR_RE.test(errText)) {
        if (opts.verbose) {
          console.warn(`telegram HTML parse failed, retrying as plain text: ${errText}`);
        }
        const fallback = fallbackText ?? rawText;
        const plainParams = hasBaseParams ? baseParams : void 0;
        return await requestWithDiag(
          () => plainParams ? api.sendMessage(chatId, fallback, plainParams) : api.sendMessage(chatId, fallback),
          'message-plain'
        ).catch((err2) => {
          throw wrapChatNotFound(err2);
        });
      }
      throw wrapChatNotFound(err);
    });
    return res2;
  };
  if (mediaUrl) {
    const media = await loadWebMedia(mediaUrl, opts.maxBytes);
    const kind = mediaKindFromMime(media.contentType ?? void 0);
    const isGif = isGifMedia({
      contentType: media.contentType,
      fileName: media.fileName
    });
    const fileName = media.fileName ?? (isGif ? 'animation.gif' : inferFilename(kind)) ?? 'file';
    const file = new InputFile(media.buffer, fileName);
    const { caption, followUpText } = splitTelegramCaption(text);
    const htmlCaption = caption ? renderHtmlText(caption) : void 0;
    const needsSeparateText = Boolean(followUpText);
    const baseMediaParams = {
      ...hasThreadParams ? threadParams : {},
      ...!needsSeparateText && replyMarkup ? { reply_markup: replyMarkup } : {}
    };
    const mediaParams = {
      caption: htmlCaption,
      ...htmlCaption ? { parse_mode: 'HTML' } : {},
      ...baseMediaParams,
      ...opts.silent === true ? { disable_notification: true } : {}
    };
    let result;
    if (isGif) {
      result = await requestWithDiag(
        () => api.sendAnimation(chatId, file, mediaParams),
        'animation'
      ).catch((err) => {
        throw wrapChatNotFound(err);
      });
    } else if (kind === 'image') {
      result = await requestWithDiag(() => api.sendPhoto(chatId, file, mediaParams), 'photo').catch(
        (err) => {
          throw wrapChatNotFound(err);
        }
      );
    } else if (kind === 'video') {
      result = await requestWithDiag(() => api.sendVideo(chatId, file, mediaParams), 'video').catch(
        (err) => {
          throw wrapChatNotFound(err);
        }
      );
    } else if (kind === 'audio') {
      const { useVoice } = resolveTelegramVoiceSend({
        wantsVoice: opts.asVoice === true,
        // default false (backward compatible)
        contentType: media.contentType,
        fileName,
        logFallback: logVerbose
      });
      if (useVoice) {
        result = await requestWithDiag(
          () => api.sendVoice(chatId, file, mediaParams),
          'voice'
        ).catch((err) => {
          throw wrapChatNotFound(err);
        });
      } else {
        result = await requestWithDiag(
          () => api.sendAudio(chatId, file, mediaParams),
          'audio'
        ).catch((err) => {
          throw wrapChatNotFound(err);
        });
      }
    } else {
      result = await requestWithDiag(
        () => api.sendDocument(chatId, file, mediaParams),
        'document'
      ).catch((err) => {
        throw wrapChatNotFound(err);
      });
    }
    const mediaMessageId = String(result?.message_id ?? 'unknown');
    const resolvedChatId = String(result?.chat?.id ?? chatId);
    if (result?.message_id) {
      recordSentMessage(chatId, result.message_id);
    }
    recordChannelActivity({
      channel: 'telegram',
      accountId: account.accountId,
      direction: 'outbound'
    });
    if (needsSeparateText && followUpText) {
      const textParams2 = hasThreadParams || replyMarkup ? {
        ...threadParams,
        ...replyMarkup ? { reply_markup: replyMarkup } : {}
      } : void 0;
      const textRes = await sendTelegramText(followUpText, textParams2);
      return {
        messageId: String(textRes?.message_id ?? mediaMessageId),
        chatId: resolvedChatId
      };
    }
    return { messageId: mediaMessageId, chatId: resolvedChatId };
  }
  if (!text || !text.trim()) {
    throw new Error('Message must be non-empty for Telegram sends');
  }
  const textParams = hasThreadParams || replyMarkup ? {
    ...threadParams,
    ...replyMarkup ? { reply_markup: replyMarkup } : {}
  } : void 0;
  const res = await sendTelegramText(text, textParams, opts.plainText);
  const messageId = String(res?.message_id ?? 'unknown');
  if (res?.message_id) {
    recordSentMessage(chatId, res.message_id);
  }
  recordChannelActivity({
    channel: 'telegram',
    accountId: account.accountId,
    direction: 'outbound'
  });
  return { messageId, chatId: String(res?.chat?.id ?? chatId) };
}
async function reactMessageTelegram(chatIdInput, messageIdInput, emoji, opts = {}) {
  const cfg = loadConfig();
  const account = resolveTelegramAccount({
    cfg,
    accountId: opts.accountId
  });
  const token = resolveToken(opts.token, account);
  const chatId = normalizeChatId(String(chatIdInput));
  const messageId = normalizeMessageId(messageIdInput);
  const client = resolveTelegramClientOptions(account);
  const api = opts.api ?? new Bot(token, client ? { client } : void 0).api;
  const request = createTelegramRetryRunner({
    retry: opts.retry,
    configRetry: account.config.retry,
    verbose: opts.verbose,
    shouldRetry: (err) => isRecoverableTelegramNetworkError(err, { context: 'send' })
  });
  const logHttpError = createTelegramHttpLogger(cfg);
  const requestWithDiag = (fn, label) => withTelegramApiErrorLogging({
    operation: label ?? 'request',
    fn: () => request(fn, label)
  }).catch((err) => {
    logHttpError(label ?? 'request', err);
    throw err;
  });
  const remove = opts.remove === true;
  const trimmedEmoji = emoji.trim();
  const reactions = remove || !trimmedEmoji ? [] : [{ type: 'emoji', emoji: trimmedEmoji }];
  if (typeof api.setMessageReaction !== 'function') {
    throw new Error('Telegram reactions are unavailable in this bot API.');
  }
  await requestWithDiag(() => api.setMessageReaction(chatId, messageId, reactions), 'reaction');
  return { ok: true };
}
async function deleteMessageTelegram(chatIdInput, messageIdInput, opts = {}) {
  const cfg = loadConfig();
  const account = resolveTelegramAccount({
    cfg,
    accountId: opts.accountId
  });
  const token = resolveToken(opts.token, account);
  const chatId = normalizeChatId(String(chatIdInput));
  const messageId = normalizeMessageId(messageIdInput);
  const client = resolveTelegramClientOptions(account);
  const api = opts.api ?? new Bot(token, client ? { client } : void 0).api;
  const request = createTelegramRetryRunner({
    retry: opts.retry,
    configRetry: account.config.retry,
    verbose: opts.verbose,
    shouldRetry: (err) => isRecoverableTelegramNetworkError(err, { context: 'send' })
  });
  const logHttpError = createTelegramHttpLogger(cfg);
  const requestWithDiag = (fn, label) => withTelegramApiErrorLogging({
    operation: label ?? 'request',
    fn: () => request(fn, label)
  }).catch((err) => {
    logHttpError(label ?? 'request', err);
    throw err;
  });
  await requestWithDiag(() => api.deleteMessage(chatId, messageId), 'deleteMessage');
  logVerbose(`[telegram] Deleted message ${messageId} from chat ${chatId}`);
  return { ok: true };
}
async function editMessageTelegram(chatIdInput, messageIdInput, text, opts = {}) {
  const cfg = opts.cfg ?? loadConfig();
  const account = resolveTelegramAccount({
    cfg,
    accountId: opts.accountId
  });
  const token = resolveToken(opts.token, account);
  const chatId = normalizeChatId(String(chatIdInput));
  const messageId = normalizeMessageId(messageIdInput);
  const client = resolveTelegramClientOptions(account);
  const api = opts.api ?? new Bot(token, client ? { client } : void 0).api;
  const request = createTelegramRetryRunner({
    retry: opts.retry,
    configRetry: account.config.retry,
    verbose: opts.verbose
  });
  const logHttpError = createTelegramHttpLogger(cfg);
  const requestWithDiag = (fn, label) => withTelegramApiErrorLogging({
    operation: label ?? 'request',
    fn: () => request(fn, label)
  }).catch((err) => {
    logHttpError(label ?? 'request', err);
    throw err;
  });
  const textMode = opts.textMode ?? 'markdown';
  const tableMode = resolveMarkdownTableMode({
    cfg,
    channel: 'telegram',
    accountId: account.accountId
  });
  const htmlText = renderTelegramHtmlText(text, { textMode, tableMode });
  const shouldTouchButtons = opts.buttons !== void 0;
  const builtKeyboard = shouldTouchButtons ? buildInlineKeyboard(opts.buttons) : void 0;
  const replyMarkup = shouldTouchButtons ? builtKeyboard ?? { inline_keyboard: [] } : void 0;
  const editParams = {
    parse_mode: 'HTML'
  };
  if (replyMarkup !== void 0) {
    editParams.reply_markup = replyMarkup;
  }
  await requestWithDiag(
    () => api.editMessageText(chatId, messageId, htmlText, editParams),
    'editMessage'
  ).catch(async (err) => {
    const errText = formatErrorMessage(err);
    if (PARSE_ERR_RE.test(errText)) {
      if (opts.verbose) {
        console.warn(`telegram HTML parse failed, retrying as plain text: ${errText}`);
      }
      const plainParams = {};
      if (replyMarkup !== void 0) {
        plainParams.reply_markup = replyMarkup;
      }
      return await requestWithDiag(
        () => Object.keys(plainParams).length > 0 ? api.editMessageText(chatId, messageId, text, plainParams) : api.editMessageText(chatId, messageId, text),
        'editMessage-plain'
      );
    }
    throw err;
  });
  logVerbose(`[telegram] Edited message ${messageId} in chat ${chatId}`);
  return { ok: true, messageId: String(messageId), chatId };
}
function inferFilename(kind) {
  switch (kind) {
    case 'image':
      return 'image.jpg';
    case 'video':
      return 'video.mp4';
    case 'audio':
      return 'audio.ogg';
    default:
      return 'file.bin';
  }
}
async function sendStickerTelegram(to, fileId, opts = {}) {
  if (!fileId?.trim()) {
    throw new Error('Telegram sticker file_id is required');
  }
  const cfg = loadConfig();
  const account = resolveTelegramAccount({
    cfg,
    accountId: opts.accountId
  });
  const token = resolveToken(opts.token, account);
  const target = parseTelegramTarget(to);
  const chatId = normalizeChatId(target.chatId);
  const client = resolveTelegramClientOptions(account);
  const api = opts.api ?? new Bot(token, client ? { client } : void 0).api;
  const messageThreadId = opts.messageThreadId !== null && opts.messageThreadId !== undefined ? opts.messageThreadId : target.messageThreadId;
  const threadSpec = messageThreadId !== null && messageThreadId !== undefined ? { id: messageThreadId, scope: 'forum' } : void 0;
  const threadIdParams = buildTelegramThreadParams(threadSpec);
  const threadParams = threadIdParams ? { ...threadIdParams } : {};
  if (opts.replyToMessageId !== null && opts.replyToMessageId !== undefined) {
    threadParams.reply_to_message_id = Math.trunc(opts.replyToMessageId);
  }
  const hasThreadParams = Object.keys(threadParams).length > 0;
  const request = createTelegramRetryRunner({
    retry: opts.retry,
    configRetry: account.config.retry,
    verbose: opts.verbose
  });
  const logHttpError = createTelegramHttpLogger(cfg);
  const requestWithDiag = (fn, label) => request(fn, label).catch((err) => {
    logHttpError(label ?? 'request', err);
    throw err;
  });
  const wrapChatNotFound = (err) => {
    if (!/400: Bad Request: chat not found/i.test(formatErrorMessage(err))) {
      return err;
    }
    return new Error(
      [
        `Telegram send failed: chat not found (chat_id=${chatId}).`,
        'Likely: bot not started in DM, bot removed from group/channel, group migrated (new -100\u2026 id), or wrong bot token.',
        `Input was: ${JSON.stringify(to)}.`
      ].join(' ')
    );
  };
  const stickerParams = hasThreadParams ? threadParams : void 0;
  const result = await requestWithDiag(
    () => api.sendSticker(chatId, fileId.trim(), stickerParams),
    'sticker'
  ).catch((err) => {
    throw wrapChatNotFound(err);
  });
  const messageId = String(result?.message_id ?? 'unknown');
  const resolvedChatId = String(result?.chat?.id ?? chatId);
  if (result?.message_id) {
    recordSentMessage(chatId, result.message_id);
  }
  recordChannelActivity({
    channel: 'telegram',
    accountId: account.accountId,
    direction: 'outbound'
  });
  return { messageId, chatId: resolvedChatId };
}
export {
  buildInlineKeyboard,
  deleteMessageTelegram,
  editMessageTelegram,
  reactMessageTelegram,
  sendMessageTelegram,
  sendStickerTelegram
};
