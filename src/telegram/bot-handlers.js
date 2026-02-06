import { resolveDefaultAgentId } from '../agents/agent-scope.js';
import { hasControlCommand } from '../auto-reply/command-detection.js';
import {
  createInboundDebouncer,
  resolveInboundDebounceMs
} from '../auto-reply/inbound-debounce.js';
import { buildCommandsPaginationKeyboard } from '../auto-reply/reply/commands-info.js';
import { buildModelsProviderData } from '../auto-reply/reply/commands-models.js';
import { resolveStoredModelOverride } from '../auto-reply/reply/model-selection.js';
import { listSkillCommandsForAgents } from '../auto-reply/skill-commands.js';
import { buildCommandsMessagePaginated } from '../auto-reply/status.js';
import { resolveChannelConfigWrites } from '../channels/plugins/config-writes.js';
import { loadConfig } from '../config/config.js';
import { writeConfigFile } from '../config/io.js';
import { loadSessionStore, resolveStorePath } from '../config/sessions.js';
import { danger, logVerbose, warn } from '../globals.js';
import { readChannelAllowFromStore } from '../pairing/pairing-store.js';
import { resolveAgentRoute } from '../routing/resolve-route.js';
import { resolveThreadSessionKeys } from '../routing/session-key.js';
import { withTelegramApiErrorLogging } from './api-logging.js';
import { firstDefined, isSenderAllowed, normalizeAllowFromWithStore } from './bot-access.js';
import { MEDIA_GROUP_TIMEOUT_MS } from './bot-updates.js';
import { resolveMedia } from './bot/delivery.js';
import { buildTelegramGroupPeerId, buildTelegramParentPeer, resolveTelegramForumThreadId } from './bot/helpers.js';
import { migrateTelegramGroupConfig } from './group-migration.js';
import { resolveTelegramInlineButtonsScope } from './inline-buttons.js';
import {
  buildModelsKeyboard,
  buildProviderKeyboard,
  calculateTotalPages,
  getModelsPageSize,
  parseModelCallbackData
} from './model-buttons.js';
import { buildInlineKeyboard } from './send.js';
const registerTelegramHandlers = ({
  cfg,
  accountId,
  bot,
  opts,
  runtime,
  mediaMaxBytes,
  telegramCfg,
  groupAllowFrom,
  resolveGroupPolicy,
  resolveTelegramGroupConfig,
  shouldSkipUpdate,
  processMessage,
  logger
}) => {
  const TELEGRAM_TEXT_FRAGMENT_START_THRESHOLD_CHARS = 4e3;
  const TELEGRAM_TEXT_FRAGMENT_MAX_GAP_MS = 1500;
  const TELEGRAM_TEXT_FRAGMENT_MAX_ID_GAP = 1;
  const TELEGRAM_TEXT_FRAGMENT_MAX_PARTS = 12;
  const TELEGRAM_TEXT_FRAGMENT_MAX_TOTAL_CHARS = 5e4;
  const mediaGroupBuffer = /* @__PURE__ */ new Map();
  let mediaGroupProcessing = Promise.resolve();
  const textFragmentBuffer = /* @__PURE__ */ new Map();
  let textFragmentProcessing = Promise.resolve();
  const debounceMs = resolveInboundDebounceMs({ cfg, channel: 'telegram' });
  const inboundDebouncer = createInboundDebouncer({
    debounceMs,
    buildKey: (entry) => entry.debounceKey,
    shouldDebounce: (entry) => {
      if (entry.allMedia.length > 0) {
        return false;
      }
      const text = entry.msg.text ?? entry.msg.caption ?? '';
      if (!text.trim()) {
        return false;
      }
      return !hasControlCommand(text, cfg, { botUsername: entry.botUsername });
    },
    onFlush: async (entries) => {
      const last = entries.at(-1);
      if (!last) {
        return;
      }
      if (entries.length === 1) {
        await processMessage(last.ctx, last.allMedia, last.storeAllowFrom);
        return;
      }
      const combinedText = entries.map((entry) => entry.msg.text ?? entry.msg.caption ?? '').filter(Boolean).join('\n');
      if (!combinedText.trim()) {
        return;
      }
      const first = entries[0];
      const baseCtx = first.ctx;
      const getFile = typeof baseCtx.getFile === 'function' ? baseCtx.getFile.bind(baseCtx) : async () => ({});
      const syntheticMessage = {
        ...first.msg,
        text: combinedText,
        caption: void 0,
        caption_entities: void 0,
        entities: void 0,
        date: last.msg.date ?? first.msg.date
      };
      const messageIdOverride = last.msg.message_id ? String(last.msg.message_id) : void 0;
      await processMessage(
        { message: syntheticMessage, me: baseCtx.me, getFile },
        [],
        first.storeAllowFrom,
        messageIdOverride ? { messageIdOverride } : void 0
      );
    },
    onError: (err) => {
      runtime.error?.(danger(`telegram debounce flush failed: ${String(err)}`));
    }
  });
  const resolveTelegramSessionModel = (params) => {
    const resolvedThreadId = params.resolvedThreadId ?? resolveTelegramForumThreadId({
      isForum: params.isForum,
      messageThreadId: params.messageThreadId
    });
    const peerId = params.isGroup ? buildTelegramGroupPeerId(params.chatId, resolvedThreadId) : String(params.chatId);
    const parentPeer = buildTelegramParentPeer({
      isGroup: params.isGroup,
      resolvedThreadId,
      chatId: params.chatId
    });
    const route = resolveAgentRoute({
      cfg,
      channel: 'telegram',
      accountId,
      peer: {
        kind: params.isGroup ? 'group' : 'dm',
        id: peerId
      },
      parentPeer
    });
    const baseSessionKey = route.sessionKey;
    const dmThreadId = !params.isGroup ? params.messageThreadId : void 0;
    const threadKeys = dmThreadId !== null && dmThreadId !== undefined ? resolveThreadSessionKeys({ baseSessionKey, threadId: String(dmThreadId) }) : null;
    const sessionKey = threadKeys?.sessionKey ?? baseSessionKey;
    const storePath = resolveStorePath(cfg.session?.store, { agentId: route.agentId });
    const store = loadSessionStore(storePath);
    const entry = store[sessionKey];
    const storedOverride = resolveStoredModelOverride({
      sessionEntry: entry,
      sessionStore: store,
      sessionKey
    });
    if (storedOverride) {
      return storedOverride.provider ? `${storedOverride.provider}/${storedOverride.model}` : storedOverride.model;
    }
    const provider = entry?.modelProvider?.trim();
    const model = entry?.model?.trim();
    if (provider && model) {
      return `${provider}/${model}`;
    }
    const modelCfg = cfg.agents?.defaults?.model;
    return typeof modelCfg === 'string' ? modelCfg : modelCfg?.primary;
  };
  const processMediaGroup = async (entry) => {
    try {
      entry.messages.sort((a, b) => a.msg.message_id - b.msg.message_id);
      const captionMsg = entry.messages.find((m) => m.msg.caption || m.msg.text);
      const primaryEntry = captionMsg ?? entry.messages[0];
      const allMedia = [];
      for (const { ctx } of entry.messages) {
        const media = await resolveMedia(ctx, mediaMaxBytes, opts.token, opts.proxyFetch);
        if (media) {
          allMedia.push({
            path: media.path,
            contentType: media.contentType,
            stickerMetadata: media.stickerMetadata
          });
        }
      }
      const storeAllowFrom = await readChannelAllowFromStore('telegram').catch(() => []);
      await processMessage(primaryEntry.ctx, allMedia, storeAllowFrom);
    } catch (err) {
      runtime.error?.(danger(`media group handler failed: ${String(err)}`));
    }
  };
  const flushTextFragments = async (entry) => {
    try {
      entry.messages.sort((a, b) => a.msg.message_id - b.msg.message_id);
      const first = entry.messages[0];
      const last = entry.messages.at(-1);
      if (!first || !last) {
        return;
      }
      const combinedText = entry.messages.map((m) => m.msg.text ?? '').join('');
      if (!combinedText.trim()) {
        return;
      }
      const syntheticMessage = {
        ...first.msg,
        text: combinedText,
        caption: void 0,
        caption_entities: void 0,
        entities: void 0,
        date: last.msg.date ?? first.msg.date
      };
      const storeAllowFrom = await readChannelAllowFromStore('telegram').catch(() => []);
      const baseCtx = first.ctx;
      const getFile = typeof baseCtx.getFile === 'function' ? baseCtx.getFile.bind(baseCtx) : async () => ({});
      await processMessage(
        { message: syntheticMessage, me: baseCtx.me, getFile },
        [],
        storeAllowFrom,
        { messageIdOverride: String(last.msg.message_id) }
      );
    } catch (err) {
      runtime.error?.(danger(`text fragment handler failed: ${String(err)}`));
    }
  };
  const scheduleTextFragmentFlush = (entry) => {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(async () => {
      textFragmentBuffer.delete(entry.key);
      textFragmentProcessing = textFragmentProcessing.then(async () => {
        await flushTextFragments(entry);
      }).catch(() => void 0);
      await textFragmentProcessing;
    }, TELEGRAM_TEXT_FRAGMENT_MAX_GAP_MS);
  };
  bot.on('callback_query', async (ctx) => {
    const callback = ctx.callbackQuery;
    if (!callback) {
      return;
    }
    if (shouldSkipUpdate(ctx)) {
      return;
    }
    await withTelegramApiErrorLogging({
      operation: 'answerCallbackQuery',
      runtime,
      fn: () => bot.api.answerCallbackQuery(callback.id)
    }).catch(() => {
    });
    try {
      const data = (callback.data ?? '').trim();
      const callbackMessage = callback.message;
      if (!data || !callbackMessage) {
        return;
      }
      const inlineButtonsScope = resolveTelegramInlineButtonsScope({
        cfg,
        accountId
      });
      if (inlineButtonsScope === 'off') {
        return;
      }
      const chatId = callbackMessage.chat.id;
      const isGroup = callbackMessage.chat.type === 'group' || callbackMessage.chat.type === 'supergroup';
      if (inlineButtonsScope === 'dm' && isGroup) {
        return;
      }
      if (inlineButtonsScope === 'group' && !isGroup) {
        return;
      }
      const messageThreadId = callbackMessage.message_thread_id;
      const isForum = callbackMessage.chat.is_forum === true;
      const resolvedThreadId = resolveTelegramForumThreadId({
        isForum,
        messageThreadId
      });
      const { groupConfig, topicConfig } = resolveTelegramGroupConfig(chatId, resolvedThreadId);
      const storeAllowFrom = await readChannelAllowFromStore('telegram').catch(() => []);
      const groupAllowOverride = firstDefined(topicConfig?.allowFrom, groupConfig?.allowFrom);
      const effectiveGroupAllow = normalizeAllowFromWithStore({
        allowFrom: groupAllowOverride ?? groupAllowFrom,
        storeAllowFrom
      });
      const effectiveDmAllow = normalizeAllowFromWithStore({
        allowFrom: telegramCfg.allowFrom,
        storeAllowFrom
      });
      const dmPolicy = telegramCfg.dmPolicy ?? 'pairing';
      const senderId = callback.from?.id ? String(callback.from.id) : '';
      const senderUsername = callback.from?.username ?? '';
      if (isGroup) {
        if (groupConfig?.enabled === false) {
          logVerbose(`Blocked telegram group ${chatId} (group disabled)`);
          return;
        }
        if (topicConfig?.enabled === false) {
          logVerbose(
            `Blocked telegram topic ${chatId} (${resolvedThreadId ?? 'unknown'}) (topic disabled)`
          );
          return;
        }
        if (typeof groupAllowOverride !== 'undefined') {
          const allowed = senderId && isSenderAllowed({
            allow: effectiveGroupAllow,
            senderId,
            senderUsername
          });
          if (!allowed) {
            logVerbose(
              `Blocked telegram group sender ${senderId || 'unknown'} (group allowFrom override)`
            );
            return;
          }
        }
        const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
        const groupPolicy = telegramCfg.groupPolicy ?? defaultGroupPolicy ?? 'open';
        if (groupPolicy === 'disabled') {
          logVerbose('Blocked telegram group message (groupPolicy: disabled)');
          return;
        }
        if (groupPolicy === 'allowlist') {
          if (!senderId) {
            logVerbose('Blocked telegram group message (no sender ID, groupPolicy: allowlist)');
            return;
          }
          if (!effectiveGroupAllow.hasEntries) {
            logVerbose(
              'Blocked telegram group message (groupPolicy: allowlist, no group allowlist entries)'
            );
            return;
          }
          if (!isSenderAllowed({
            allow: effectiveGroupAllow,
            senderId,
            senderUsername
          })) {
            logVerbose(`Blocked telegram group message from ${senderId} (groupPolicy: allowlist)`);
            return;
          }
        }
        const groupAllowlist = resolveGroupPolicy(chatId);
        if (groupAllowlist.allowlistEnabled && !groupAllowlist.allowed) {
          logger.info(
            { chatId, title: callbackMessage.chat.title, reason: 'not-allowed' },
            'skipping group message'
          );
          return;
        }
      }
      if (inlineButtonsScope === 'allowlist') {
        if (!isGroup) {
          if (dmPolicy === 'disabled') {
            return;
          }
          if (dmPolicy !== 'open') {
            const allowed = effectiveDmAllow.hasWildcard || effectiveDmAllow.hasEntries && isSenderAllowed({
              allow: effectiveDmAllow,
              senderId,
              senderUsername
            });
            if (!allowed) {
              return;
            }
          }
        } else {
          const allowed = effectiveGroupAllow.hasWildcard || effectiveGroupAllow.hasEntries && isSenderAllowed({
            allow: effectiveGroupAllow,
            senderId,
            senderUsername
          });
          if (!allowed) {
            return;
          }
        }
      }
      const paginationMatch = data.match(/^commands_page_(\d+|noop)(?::(.+))?$/);
      if (paginationMatch) {
        const pageValue = paginationMatch[1];
        if (pageValue === 'noop') {
          return;
        }
        const page = Number.parseInt(pageValue, 10);
        if (Number.isNaN(page) || page < 1) {
          return;
        }
        const agentId = paginationMatch[2]?.trim() || resolveDefaultAgentId(cfg) || void 0;
        const skillCommands = listSkillCommandsForAgents({
          cfg,
          agentIds: agentId ? [agentId] : void 0
        });
        const result = buildCommandsMessagePaginated(cfg, skillCommands, {
          page,
          surface: 'telegram'
        });
        const keyboard = result.totalPages > 1 ? buildInlineKeyboard(
          buildCommandsPaginationKeyboard(result.currentPage, result.totalPages, agentId)
        ) : void 0;
        try {
          await bot.api.editMessageText(
            callbackMessage.chat.id,
            callbackMessage.message_id,
            result.text,
            keyboard ? { reply_markup: keyboard } : void 0
          );
        } catch (editErr) {
          const errStr = String(editErr);
          if (!errStr.includes('message is not modified')) {
            throw editErr;
          }
        }
        return;
      }
      const modelCallback = parseModelCallbackData(data);
      if (modelCallback) {
        const modelData = await buildModelsProviderData(cfg);
        const { byProvider, providers } = modelData;
        const editMessageWithButtons = async (text, buttons) => {
          const keyboard = buildInlineKeyboard(buttons);
          try {
            await bot.api.editMessageText(
              callbackMessage.chat.id,
              callbackMessage.message_id,
              text,
              keyboard ? { reply_markup: keyboard } : void 0
            );
          } catch (editErr) {
            const errStr = String(editErr);
            if (!errStr.includes('message is not modified')) {
              throw editErr;
            }
          }
        };
        if (modelCallback.type === 'providers' || modelCallback.type === 'back') {
          if (providers.length === 0) {
            await editMessageWithButtons('No providers available.', []);
            return;
          }
          const providerInfos = providers.map((p) => ({
            id: p,
            count: byProvider.get(p)?.size ?? 0
          }));
          const buttons = buildProviderKeyboard(providerInfos);
          await editMessageWithButtons('Select a provider:', buttons);
          return;
        }
        if (modelCallback.type === 'list') {
          const { provider, page } = modelCallback;
          const modelSet = byProvider.get(provider);
          if (!modelSet || modelSet.size === 0) {
            const providerInfos = providers.map((p) => ({
              id: p,
              count: byProvider.get(p)?.size ?? 0
            }));
            const buttons2 = buildProviderKeyboard(providerInfos);
            await editMessageWithButtons(
              `Unknown provider: ${provider}

Select a provider:`,
              buttons2
            );
            return;
          }
          const models = [...modelSet].toSorted();
          const pageSize = getModelsPageSize();
          const totalPages = calculateTotalPages(models.length, pageSize);
          const safePage = Math.max(1, Math.min(page, totalPages));
          const currentModel = resolveTelegramSessionModel({
            chatId,
            isGroup,
            isForum,
            messageThreadId,
            resolvedThreadId
          });
          const buttons = buildModelsKeyboard({
            provider,
            models,
            currentModel,
            currentPage: safePage,
            totalPages,
            pageSize
          });
          const text = `Models (${provider}) \u2014 ${models.length} available`;
          await editMessageWithButtons(text, buttons);
          return;
        }
        if (modelCallback.type === 'select') {
          const { provider, model } = modelCallback;
          const syntheticMessage2 = {
            ...callbackMessage,
            from: callback.from,
            text: `/model ${provider}/${model}`,
            caption: void 0,
            caption_entities: void 0,
            entities: void 0
          };
          const getFile2 = typeof ctx.getFile === 'function' ? ctx.getFile.bind(ctx) : async () => ({});
          await processMessage(
            { message: syntheticMessage2, me: ctx.me, getFile: getFile2 },
            [],
            storeAllowFrom,
            {
              forceWasMentioned: true,
              messageIdOverride: callback.id
            }
          );
          return;
        }
        return;
      }
      const syntheticMessage = {
        ...callbackMessage,
        from: callback.from,
        text: data,
        caption: void 0,
        caption_entities: void 0,
        entities: void 0
      };
      const getFile = typeof ctx.getFile === 'function' ? ctx.getFile.bind(ctx) : async () => ({});
      await processMessage({ message: syntheticMessage, me: ctx.me, getFile }, [], storeAllowFrom, {
        forceWasMentioned: true,
        messageIdOverride: callback.id
      });
    } catch (err) {
      runtime.error?.(danger(`callback handler failed: ${String(err)}`));
    }
  });
  bot.on('message:migrate_to_chat_id', async (ctx) => {
    try {
      const msg = ctx.message;
      if (!msg?.migrate_to_chat_id) {
        return;
      }
      if (shouldSkipUpdate(ctx)) {
        return;
      }
      const oldChatId = String(msg.chat.id);
      const newChatId = String(msg.migrate_to_chat_id);
      const chatTitle = msg.chat.title ?? 'Unknown';
      runtime.log?.(warn(`[telegram] Group migrated: "${chatTitle}" ${oldChatId} \u2192 ${newChatId}`));
      if (!resolveChannelConfigWrites({ cfg, channelId: 'telegram', accountId })) {
        runtime.log?.(warn('[telegram] Config writes disabled; skipping group config migration.'));
        return;
      }
      const currentConfig = loadConfig();
      const migration = migrateTelegramGroupConfig({
        cfg: currentConfig,
        accountId,
        oldChatId,
        newChatId
      });
      if (migration.migrated) {
        runtime.log?.(warn(`[telegram] Migrating group config from ${oldChatId} to ${newChatId}`));
        migrateTelegramGroupConfig({ cfg, accountId, oldChatId, newChatId });
        await writeConfigFile(currentConfig);
        runtime.log?.(warn('[telegram] Group config migrated and saved successfully'));
      } else if (migration.skippedExisting) {
        runtime.log?.(
          warn(
            `[telegram] Group config already exists for ${newChatId}; leaving ${oldChatId} unchanged`
          )
        );
      } else {
        runtime.log?.(
          warn(`[telegram] No config found for old group ID ${oldChatId}, migration logged only`)
        );
      }
    } catch (err) {
      runtime.error?.(danger(`[telegram] Group migration handler failed: ${String(err)}`));
    }
  });
  bot.on('message', async (ctx) => {
    try {
      const msg = ctx.message;
      if (!msg) {
        return;
      }
      if (shouldSkipUpdate(ctx)) {
        return;
      }
      const chatId = msg.chat.id;
      const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
      const messageThreadId = msg.message_thread_id;
      const isForum = msg.chat.is_forum === true;
      const resolvedThreadId = resolveTelegramForumThreadId({
        isForum,
        messageThreadId
      });
      const storeAllowFrom = await readChannelAllowFromStore('telegram').catch(() => []);
      const { groupConfig, topicConfig } = resolveTelegramGroupConfig(chatId, resolvedThreadId);
      const groupAllowOverride = firstDefined(topicConfig?.allowFrom, groupConfig?.allowFrom);
      const effectiveGroupAllow = normalizeAllowFromWithStore({
        allowFrom: groupAllowOverride ?? groupAllowFrom,
        storeAllowFrom
      });
      const hasGroupAllowOverride = typeof groupAllowOverride !== 'undefined';
      if (isGroup) {
        if (groupConfig?.enabled === false) {
          logVerbose(`Blocked telegram group ${chatId} (group disabled)`);
          return;
        }
        if (topicConfig?.enabled === false) {
          logVerbose(
            `Blocked telegram topic ${chatId} (${resolvedThreadId ?? 'unknown'}) (topic disabled)`
          );
          return;
        }
        if (hasGroupAllowOverride) {
          const senderId2 = msg.from?.id;
          const senderUsername = msg.from?.username ?? '';
          const allowed = senderId2 !== null && senderId2 !== undefined && isSenderAllowed({
            allow: effectiveGroupAllow,
            senderId: String(senderId2),
            senderUsername
          });
          if (!allowed) {
            logVerbose(
              `Blocked telegram group sender ${senderId2 ?? 'unknown'} (group allowFrom override)`
            );
            return;
          }
        }
        const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
        const groupPolicy = telegramCfg.groupPolicy ?? defaultGroupPolicy ?? 'open';
        if (groupPolicy === 'disabled') {
          logVerbose('Blocked telegram group message (groupPolicy: disabled)');
          return;
        }
        if (groupPolicy === 'allowlist') {
          const senderId2 = msg.from?.id;
          if (senderId2 === null || senderId2 === undefined) {
            logVerbose('Blocked telegram group message (no sender ID, groupPolicy: allowlist)');
            return;
          }
          if (!effectiveGroupAllow.hasEntries) {
            logVerbose(
              'Blocked telegram group message (groupPolicy: allowlist, no group allowlist entries)'
            );
            return;
          }
          const senderUsername = msg.from?.username ?? '';
          if (!isSenderAllowed({
            allow: effectiveGroupAllow,
            senderId: String(senderId2),
            senderUsername
          })) {
            logVerbose(`Blocked telegram group message from ${senderId2} (groupPolicy: allowlist)`);
            return;
          }
        }
        const groupAllowlist = resolveGroupPolicy(chatId);
        if (groupAllowlist.allowlistEnabled && !groupAllowlist.allowed) {
          logger.info(
            { chatId, title: msg.chat.title, reason: 'not-allowed' },
            'skipping group message'
          );
          return;
        }
      }
      const text = typeof msg.text === 'string' ? msg.text : void 0;
      const isCommandLike = (text ?? '').trim().startsWith('/');
      if (text && !isCommandLike) {
        const nowMs = Date.now();
        const senderId2 = msg.from?.id !== null && msg.from?.id !== undefined ? String(msg.from.id) : 'unknown';
        const key = `text:${chatId}:${resolvedThreadId ?? 'main'}:${senderId2}`;
        const existing = textFragmentBuffer.get(key);
        if (existing) {
          const last = existing.messages.at(-1);
          const lastMsgId = last?.msg.message_id;
          const lastReceivedAtMs = last?.receivedAtMs ?? nowMs;
          const idGap = typeof lastMsgId === 'number' ? msg.message_id - lastMsgId : Infinity;
          const timeGapMs = nowMs - lastReceivedAtMs;
          const canAppend = idGap > 0 && idGap <= TELEGRAM_TEXT_FRAGMENT_MAX_ID_GAP && timeGapMs >= 0 && timeGapMs <= TELEGRAM_TEXT_FRAGMENT_MAX_GAP_MS;
          if (canAppend) {
            const currentTotalChars = existing.messages.reduce(
              (sum, m) => sum + (m.msg.text?.length ?? 0),
              0
            );
            const nextTotalChars = currentTotalChars + text.length;
            if (existing.messages.length + 1 <= TELEGRAM_TEXT_FRAGMENT_MAX_PARTS && nextTotalChars <= TELEGRAM_TEXT_FRAGMENT_MAX_TOTAL_CHARS) {
              existing.messages.push({ msg, ctx, receivedAtMs: nowMs });
              scheduleTextFragmentFlush(existing);
              return;
            }
          }
          clearTimeout(existing.timer);
          textFragmentBuffer.delete(key);
          textFragmentProcessing = textFragmentProcessing.then(async () => {
            await flushTextFragments(existing);
          }).catch(() => void 0);
          await textFragmentProcessing;
        }
        const shouldStart = text.length >= TELEGRAM_TEXT_FRAGMENT_START_THRESHOLD_CHARS;
        if (shouldStart) {
          const entry = {
            key,
            messages: [{ msg, ctx, receivedAtMs: nowMs }],
            timer: setTimeout(() => {
            }, TELEGRAM_TEXT_FRAGMENT_MAX_GAP_MS)
          };
          textFragmentBuffer.set(key, entry);
          scheduleTextFragmentFlush(entry);
          return;
        }
      }
      const mediaGroupId = msg.media_group_id;
      if (mediaGroupId) {
        const existing = mediaGroupBuffer.get(mediaGroupId);
        if (existing) {
          clearTimeout(existing.timer);
          existing.messages.push({ msg, ctx });
          existing.timer = setTimeout(async () => {
            mediaGroupBuffer.delete(mediaGroupId);
            mediaGroupProcessing = mediaGroupProcessing.then(async () => {
              await processMediaGroup(existing);
            }).catch(() => void 0);
            await mediaGroupProcessing;
          }, MEDIA_GROUP_TIMEOUT_MS);
        } else {
          const entry = {
            messages: [{ msg, ctx }],
            timer: setTimeout(async () => {
              mediaGroupBuffer.delete(mediaGroupId);
              mediaGroupProcessing = mediaGroupProcessing.then(async () => {
                await processMediaGroup(entry);
              }).catch(() => void 0);
              await mediaGroupProcessing;
            }, MEDIA_GROUP_TIMEOUT_MS)
          };
          mediaGroupBuffer.set(mediaGroupId, entry);
        }
        return;
      }
      let media = null;
      try {
        media = await resolveMedia(ctx, mediaMaxBytes, opts.token, opts.proxyFetch);
      } catch (mediaErr) {
        const errMsg = String(mediaErr);
        if (errMsg.includes('exceeds') && errMsg.includes('MB limit')) {
          const limitMb = Math.round(mediaMaxBytes / (1024 * 1024));
          await withTelegramApiErrorLogging({
            operation: 'sendMessage',
            runtime,
            fn: () => bot.api.sendMessage(chatId, `\u26A0\uFE0F File too large. Maximum size is ${limitMb}MB.`, {
              reply_to_message_id: msg.message_id
            })
          }).catch(() => {
          });
          logger.warn({ chatId, error: errMsg }, 'media exceeds size limit');
          return;
        }
        throw mediaErr;
      }
      const hasText = Boolean((msg.text ?? msg.caption ?? '').trim());
      if (msg.sticker && !media && !hasText) {
        logVerbose('telegram: skipping sticker-only message (unsupported sticker type)');
        return;
      }
      const allMedia = media ? [
        {
          path: media.path,
          contentType: media.contentType,
          stickerMetadata: media.stickerMetadata
        }
      ] : [];
      const senderId = msg.from?.id ? String(msg.from.id) : '';
      const conversationKey = resolvedThreadId !== null && resolvedThreadId !== undefined ? `${chatId}:topic:${resolvedThreadId}` : String(chatId);
      const debounceKey = senderId ? `telegram:${accountId ?? 'default'}:${conversationKey}:${senderId}` : null;
      await inboundDebouncer.enqueue({
        ctx,
        msg,
        allMedia,
        storeAllowFrom,
        debounceKey,
        botUsername: ctx.me?.username
      });
    } catch (err) {
      runtime.error?.(danger(`handler failed: ${String(err)}`));
    }
  });
};
export {
  registerTelegramHandlers
};
