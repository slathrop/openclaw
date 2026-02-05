import { GrammyError, InputFile } from 'grammy';
import { chunkMarkdownTextWithMode } from '../../auto-reply/chunk.js';
import { danger, logVerbose } from '../../globals.js';
import { formatErrorMessage } from '../../infra/errors.js';
import { mediaKindFromMime } from '../../media/constants.js';
import { fetchRemoteMedia } from '../../media/fetch.js';
import { isGifMedia } from '../../media/mime.js';
import { saveMediaBuffer } from '../../media/store.js';
import { loadWebMedia } from '../../web/media.js';
import { withTelegramApiErrorLogging } from '../api-logging.js';
import { splitTelegramCaption } from '../caption.js';
import {
  markdownToTelegramChunks,
  markdownToTelegramHtml,
  renderTelegramHtmlText
} from '../format.js';
import { buildInlineKeyboard } from '../send.js';
import { cacheSticker, getCachedSticker } from '../sticker-cache.js';
import { resolveTelegramVoiceSend } from '../voice.js';
import {
  buildTelegramThreadParams,
  resolveTelegramReplyId
} from './helpers.js';
const PARSE_ERR_RE = /can't parse entities|parse entities|find end of the entity/i;
const VOICE_FORBIDDEN_RE = /VOICE_MESSAGES_FORBIDDEN/;
async function deliverReplies(params) {
  const {
    replies,
    chatId,
    runtime,
    bot,
    replyToMode,
    textLimit,
    thread,
    linkPreview,
    replyQuoteText
  } = params;
  const chunkMode = params.chunkMode ?? 'length';
  let hasReplied = false;
  let hasDelivered = false;
  const markDelivered = () => {
    hasDelivered = true;
  };
  const chunkText = (markdown) => {
    const markdownChunks = chunkMode === 'newline' ? chunkMarkdownTextWithMode(markdown, textLimit, chunkMode) : [markdown];
    const chunks = [];
    for (const chunk of markdownChunks) {
      const nested = markdownToTelegramChunks(chunk, textLimit, { tableMode: params.tableMode });
      if (!nested.length && chunk) {
        chunks.push({
          html: markdownToTelegramHtml(chunk, { tableMode: params.tableMode }),
          text: chunk
        });
        continue;
      }
      chunks.push(...nested);
    }
    return chunks;
  };
  for (const reply of replies) {
    const hasMedia = Boolean(reply?.mediaUrl) || (reply?.mediaUrls?.length ?? 0) > 0;
    if (!reply?.text && !hasMedia) {
      if (reply?.audioAsVoice) {
        logVerbose('telegram reply has audioAsVoice without media/text; skipping');
        continue;
      }
      runtime.error?.(danger('reply missing text/media'));
      continue;
    }
    const replyToId = replyToMode === 'off' ? void 0 : resolveTelegramReplyId(reply.replyToId);
    const mediaList = reply.mediaUrls?.length ? reply.mediaUrls : reply.mediaUrl ? [reply.mediaUrl] : [];
    const telegramData = reply.channelData?.telegram;
    const replyMarkup = buildInlineKeyboard(telegramData?.buttons);
    if (mediaList.length === 0) {
      const chunks = chunkText(reply.text || '');
      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i];
        if (!chunk) {
          continue;
        }
        const shouldAttachButtons = i === 0 && replyMarkup;
        await sendTelegramText(bot, chatId, chunk.html, runtime, {
          replyToMessageId: replyToId && (replyToMode === 'all' || !hasReplied) ? replyToId : void 0,
          replyQuoteText,
          thread,
          textMode: 'html',
          plainText: chunk.text,
          linkPreview,
          replyMarkup: shouldAttachButtons ? replyMarkup : void 0
        });
        markDelivered();
        if (replyToId && !hasReplied) {
          hasReplied = true;
        }
      }
      continue;
    }
    let first = true;
    let pendingFollowUpText;
    for (const mediaUrl of mediaList) {
      const isFirstMedia = first;
      const media = await loadWebMedia(mediaUrl);
      const kind = mediaKindFromMime(media.contentType ?? void 0);
      const isGif = isGifMedia({
        contentType: media.contentType,
        fileName: media.fileName
      });
      const fileName = media.fileName ?? (isGif ? 'animation.gif' : 'file');
      const file = new InputFile(media.buffer, fileName);
      const { caption, followUpText } = splitTelegramCaption(
        isFirstMedia ? reply.text ?? void 0 : void 0
      );
      const htmlCaption = caption ? renderTelegramHtmlText(caption, { tableMode: params.tableMode }) : void 0;
      if (followUpText) {
        pendingFollowUpText = followUpText;
      }
      first = false;
      const replyToMessageId = replyToId && (replyToMode === 'all' || !hasReplied) ? replyToId : void 0;
      const shouldAttachButtonsToMedia = isFirstMedia && replyMarkup && !followUpText;
      const mediaParams = {
        caption: htmlCaption,
        ...htmlCaption ? { parse_mode: 'HTML' } : {},
        ...shouldAttachButtonsToMedia ? { reply_markup: replyMarkup } : {},
        ...buildTelegramSendParams({
          replyToMessageId,
          replyQuoteText,
          thread
        })
      };
      if (isGif) {
        await withTelegramApiErrorLogging({
          operation: 'sendAnimation',
          runtime,
          fn: () => bot.api.sendAnimation(chatId, file, { ...mediaParams })
        });
        markDelivered();
      } else if (kind === 'image') {
        await withTelegramApiErrorLogging({
          operation: 'sendPhoto',
          runtime,
          fn: () => bot.api.sendPhoto(chatId, file, { ...mediaParams })
        });
        markDelivered();
      } else if (kind === 'video') {
        await withTelegramApiErrorLogging({
          operation: 'sendVideo',
          runtime,
          fn: () => bot.api.sendVideo(chatId, file, { ...mediaParams })
        });
        markDelivered();
      } else if (kind === 'audio') {
        const { useVoice } = resolveTelegramVoiceSend({
          wantsVoice: reply.audioAsVoice === true,
          // default false (backward compatible)
          contentType: media.contentType,
          fileName,
          logFallback: logVerbose
        });
        if (useVoice) {
          await params.onVoiceRecording?.();
          try {
            await withTelegramApiErrorLogging({
              operation: 'sendVoice',
              runtime,
              shouldLog: (err) => !isVoiceMessagesForbidden(err),
              fn: () => bot.api.sendVoice(chatId, file, { ...mediaParams })
            });
            markDelivered();
          } catch (voiceErr) {
            if (isVoiceMessagesForbidden(voiceErr)) {
              const fallbackText = reply.text;
              if (!fallbackText || !fallbackText.trim()) {
                throw voiceErr;
              }
              logVerbose(
                'telegram sendVoice forbidden (recipient has voice messages blocked in privacy settings); falling back to text'
              );
              hasReplied = await sendTelegramVoiceFallbackText({
                bot,
                chatId,
                runtime,
                text: fallbackText,
                chunkText,
                replyToId,
                replyToMode,
                hasReplied,
                thread,
                linkPreview,
                replyMarkup,
                replyQuoteText
              });
              markDelivered();
              continue;
            }
            throw voiceErr;
          }
        } else {
          await withTelegramApiErrorLogging({
            operation: 'sendAudio',
            runtime,
            fn: () => bot.api.sendAudio(chatId, file, { ...mediaParams })
          });
          markDelivered();
        }
      } else {
        await withTelegramApiErrorLogging({
          operation: 'sendDocument',
          runtime,
          fn: () => bot.api.sendDocument(chatId, file, { ...mediaParams })
        });
        markDelivered();
      }
      if (replyToId && !hasReplied) {
        hasReplied = true;
      }
      if (pendingFollowUpText && isFirstMedia) {
        const chunks = chunkText(pendingFollowUpText);
        for (let i = 0; i < chunks.length; i += 1) {
          const chunk = chunks[i];
          const replyToMessageIdFollowup = replyToId && (replyToMode === 'all' || !hasReplied) ? replyToId : void 0;
          await sendTelegramText(bot, chatId, chunk.html, runtime, {
            replyToMessageId: replyToMessageIdFollowup,
            thread,
            textMode: 'html',
            plainText: chunk.text,
            linkPreview,
            replyMarkup: i === 0 ? replyMarkup : void 0
          });
          markDelivered();
          if (replyToId && !hasReplied) {
            hasReplied = true;
          }
        }
        pendingFollowUpText = void 0;
      }
    }
  }
  return { delivered: hasDelivered };
}
async function resolveMedia(ctx, maxBytes, token, proxyFetch) {
  const msg = ctx.message;
  if (msg.sticker) {
    const sticker = msg.sticker;
    if (sticker.is_animated || sticker.is_video) {
      logVerbose('telegram: skipping animated/video sticker (only static stickers supported)');
      return null;
    }
    if (!sticker.file_id) {
      return null;
    }
    try {
      const file2 = await ctx.getFile();
      if (!file2.file_path) {
        logVerbose('telegram: getFile returned no file_path for sticker');
        return null;
      }
      const fetchImpl2 = proxyFetch ?? globalThis.fetch;
      if (!fetchImpl2) {
        logVerbose('telegram: fetch not available for sticker download');
        return null;
      }
      const url2 = `https://api.telegram.org/file/bot${token}/${file2.file_path}`;
      const fetched2 = await fetchRemoteMedia({
        url: url2,
        fetchImpl: fetchImpl2,
        filePathHint: file2.file_path
      });
      const originalName2 = fetched2.fileName ?? file2.file_path;
      const saved2 = await saveMediaBuffer(
        fetched2.buffer,
        fetched2.contentType,
        'inbound',
        maxBytes,
        originalName2
      );
      const cached = sticker.file_unique_id ? getCachedSticker(sticker.file_unique_id) : null;
      if (cached) {
        logVerbose(`telegram: sticker cache hit for ${sticker.file_unique_id}`);
        const fileId = sticker.file_id ?? cached.fileId;
        const emoji = sticker.emoji ?? cached.emoji;
        const setName = sticker.set_name ?? cached.setName;
        if (fileId !== cached.fileId || emoji !== cached.emoji || setName !== cached.setName) {
          cacheSticker({
            ...cached,
            fileId,
            emoji,
            setName
          });
        }
        return {
          path: saved2.path,
          contentType: saved2.contentType,
          placeholder: '<media:sticker>',
          stickerMetadata: {
            emoji,
            setName,
            fileId,
            fileUniqueId: sticker.file_unique_id,
            cachedDescription: cached.description
          }
        };
      }
      return {
        path: saved2.path,
        contentType: saved2.contentType,
        placeholder: '<media:sticker>',
        stickerMetadata: {
          emoji: sticker.emoji ?? void 0,
          setName: sticker.set_name ?? void 0,
          fileId: sticker.file_id,
          fileUniqueId: sticker.file_unique_id
        }
      };
    } catch (err) {
      logVerbose(`telegram: failed to process sticker: ${String(err)}`);
      return null;
    }
  }
  const m = msg.photo?.[msg.photo.length - 1] ?? msg.video ?? msg.video_note ?? msg.document ?? msg.audio ?? msg.voice;
  if (!m?.file_id) {
    return null;
  }
  const file = await ctx.getFile();
  if (!file.file_path) {
    throw new Error('Telegram getFile returned no file_path');
  }
  const fetchImpl = proxyFetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error('fetch is not available; set channels.telegram.proxy in config');
  }
  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const fetched = await fetchRemoteMedia({
    url,
    fetchImpl,
    filePathHint: file.file_path
  });
  const originalName = fetched.fileName ?? file.file_path;
  const saved = await saveMediaBuffer(
    fetched.buffer,
    fetched.contentType,
    'inbound',
    maxBytes,
    originalName
  );
  let placeholder = '<media:document>';
  if (msg.photo) {
    placeholder = '<media:image>';
  } else if (msg.video) {
    placeholder = '<media:video>';
  } else if (msg.video_note) {
    placeholder = '<media:video>';
  } else if (msg.audio || msg.voice) {
    placeholder = '<media:audio>';
  }
  return { path: saved.path, contentType: saved.contentType, placeholder };
}
function isVoiceMessagesForbidden(err) {
  if (err instanceof GrammyError) {
    return VOICE_FORBIDDEN_RE.test(err.description);
  }
  return VOICE_FORBIDDEN_RE.test(formatErrorMessage(err));
}
async function sendTelegramVoiceFallbackText(opts) {
  const chunks = opts.chunkText(opts.text);
  let hasReplied = opts.hasReplied;
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    await sendTelegramText(opts.bot, opts.chatId, chunk.html, opts.runtime, {
      replyToMessageId: opts.replyToId && (opts.replyToMode === 'all' || !hasReplied) ? opts.replyToId : void 0,
      replyQuoteText: opts.replyQuoteText,
      thread: opts.thread,
      textMode: 'html',
      plainText: chunk.text,
      linkPreview: opts.linkPreview,
      replyMarkup: i === 0 ? opts.replyMarkup : void 0
    });
    if (opts.replyToId && !hasReplied) {
      hasReplied = true;
    }
  }
  return hasReplied;
}
function buildTelegramSendParams(opts) {
  const threadParams = buildTelegramThreadParams(opts?.thread);
  const params = {};
  const quoteText = opts?.replyQuoteText?.trim();
  if (opts?.replyToMessageId) {
    if (quoteText) {
      params.reply_parameters = {
        message_id: Math.trunc(opts.replyToMessageId),
        quote: quoteText
      };
    } else {
      params.reply_to_message_id = opts.replyToMessageId;
    }
  }
  if (threadParams) {
    params.message_thread_id = threadParams.message_thread_id;
  }
  return params;
}
async function sendTelegramText(bot, chatId, text, runtime, opts) {
  const baseParams = buildTelegramSendParams({
    replyToMessageId: opts?.replyToMessageId,
    replyQuoteText: opts?.replyQuoteText,
    thread: opts?.thread
  });
  const linkPreviewEnabled = opts?.linkPreview ?? true;
  const linkPreviewOptions = linkPreviewEnabled ? void 0 : { is_disabled: true };
  const textMode = opts?.textMode ?? 'markdown';
  const htmlText = textMode === 'html' ? text : markdownToTelegramHtml(text);
  try {
    const res = await withTelegramApiErrorLogging({
      operation: 'sendMessage',
      runtime,
      shouldLog: (err) => !PARSE_ERR_RE.test(formatErrorMessage(err)),
      fn: () => bot.api.sendMessage(chatId, htmlText, {
        parse_mode: 'HTML',
        ...linkPreviewOptions ? { link_preview_options: linkPreviewOptions } : {},
        ...opts?.replyMarkup ? { reply_markup: opts.replyMarkup } : {},
        ...baseParams
      })
    });
    return res.message_id;
  } catch (err) {
    const errText = formatErrorMessage(err);
    if (PARSE_ERR_RE.test(errText)) {
      runtime.log?.(`telegram HTML parse failed; retrying without formatting: ${errText}`);
      const fallbackText = opts?.plainText ?? text;
      const res = await withTelegramApiErrorLogging({
        operation: 'sendMessage',
        runtime,
        fn: () => bot.api.sendMessage(chatId, fallbackText, {
          ...linkPreviewOptions ? { link_preview_options: linkPreviewOptions } : {},
          ...opts?.replyMarkup ? { reply_markup: opts.replyMarkup } : {},
          ...baseParams
        })
      });
      return res.message_id;
    }
    throw err;
  }
}
export {
  deliverReplies,
  resolveMedia
};
