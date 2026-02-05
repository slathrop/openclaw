import { resolveSessionAgentId } from '../agents/agent-scope.js';
import { dispatchReplyWithBufferedBlockDispatcher } from '../auto-reply/reply/provider-dispatcher.js';
import { createReplyPrefixOptions } from '../channels/reply-prefix.js';
import { loadConfig } from '../config/config.js';
import { logVerbose } from '../globals.js';
import { formatErrorMessage } from '../infra/errors.js';
import { getChildLogger } from '../logging.js';
import { isSenderAllowed, normalizeAllowFromWithStore, resolveSenderAllowMatch } from './access.js';
import {
  resolveFeishuConfig,
  resolveFeishuGroupConfig,
  resolveFeishuGroupEnabled
} from './config.js';
import { resolveFeishuMedia } from './download.js';
import { readFeishuAllowFromStore, upsertFeishuPairingRequest } from './pairing-store.js';
import { sendMessageFeishu } from './send.js';
import { FeishuStreamingSession } from './streaming-card.js';
const logger = getChildLogger({ module: 'feishu-message' });
const SUPPORTED_MSG_TYPES = /* @__PURE__ */ new Set(['text', 'image', 'file', 'audio', 'media', 'sticker']);
async function processFeishuMessage(client, data, appId, options = {}) {
  const cfg = options.cfg ?? loadConfig();
  const accountId = options.accountId ?? appId;
  const feishuCfg = options.resolvedConfig ?? resolveFeishuConfig({ cfg, accountId });
  const payload = data;
  const message = payload.message ?? payload.event?.message;
  const sender = payload.sender ?? payload.event?.sender;
  if (!message) {
    logger.warn('Received event without message field');
    return;
  }
  const chatId = message.chat_id;
  if (!chatId) {
    logger.warn('Received message without chat_id');
    return;
  }
  const isGroup = message.chat_type === 'group';
  const msgType = message.message_type;
  const senderId = sender?.sender_id?.open_id || sender?.sender_id?.user_id || 'unknown';
  const senderUnionId = sender?.sender_id?.union_id;
  const maxMediaBytes = feishuCfg.mediaMaxMb * 1024 * 1024;
  if (!msgType || !SUPPORTED_MSG_TYPES.has(msgType)) {
    logger.debug(`Skipping unsupported message type: ${msgType ?? 'unknown'}`);
    return;
  }
  const storeAllowFrom = await readFeishuAllowFromStore().catch(() => []);
  if (isGroup) {
    if (!resolveFeishuGroupEnabled({ cfg, accountId, chatId })) {
      logVerbose(`Blocked feishu group ${chatId} (group disabled)`);
      return;
    }
    const { groupConfig } = resolveFeishuGroupConfig({ cfg, accountId, chatId });
    if (groupConfig?.allowFrom) {
      const groupAllow = normalizeAllowFromWithStore({
        allowFrom: groupConfig.allowFrom,
        storeAllowFrom
      });
      if (!isSenderAllowed({ allow: groupAllow, senderId })) {
        logVerbose(`Blocked feishu group sender ${senderId} (group allowFrom override)`);
        return;
      }
    }
    const groupPolicy = feishuCfg.groupPolicy;
    if (groupPolicy === 'disabled') {
      logVerbose('Blocked feishu group message (groupPolicy: disabled)');
      return;
    }
    if (groupPolicy === 'allowlist') {
      const groupAllow = normalizeAllowFromWithStore({
        allowFrom: feishuCfg.groupAllowFrom.length > 0 ? feishuCfg.groupAllowFrom : feishuCfg.allowFrom,
        storeAllowFrom
      });
      if (!groupAllow.hasEntries) {
        logVerbose('Blocked feishu group message (groupPolicy: allowlist, no entries)');
        return;
      }
      if (!isSenderAllowed({ allow: groupAllow, senderId })) {
        logVerbose(`Blocked feishu group sender ${senderId} (groupPolicy: allowlist)`);
        return;
      }
    }
  }
  if (!isGroup) {
    const dmPolicy = feishuCfg.dmPolicy;
    if (dmPolicy === 'disabled') {
      logVerbose('Blocked feishu DM (dmPolicy: disabled)');
      return;
    }
    if (dmPolicy !== 'open') {
      const dmAllow = normalizeAllowFromWithStore({
        allowFrom: feishuCfg.allowFrom,
        storeAllowFrom
      });
      const allowMatch = resolveSenderAllowMatch({ allow: dmAllow, senderId });
      const allowed = dmAllow.hasWildcard || dmAllow.hasEntries && allowMatch.allowed;
      if (!allowed) {
        if (dmPolicy === 'pairing') {
          try {
            const { code, created } = await upsertFeishuPairingRequest({
              openId: senderId,
              unionId: senderUnionId,
              name: sender?.sender_id?.user_id
            });
            if (created) {
              logger.info({ openId: senderId, unionId: senderUnionId }, 'feishu pairing request');
              await sendMessageFeishu(
                client,
                senderId,
                {
                  text: [
                    'OpenClaw access not configured.',
                    '',
                    `Your Feishu Open ID: ${senderId}`,
                    '',
                    `Pairing code: ${code}`,
                    '',
                    'Ask the OpenClaw admin to approve with:',
                    `openclaw pairing approve feishu ${code}`
                  ].join('\n')
                },
                { receiveIdType: 'open_id' }
              );
            }
          } catch (err) {
            logger.error(`Failed to create pairing request: ${formatErrorMessage(err)}`);
          }
          return;
        }
        logVerbose(`Blocked feishu DM from ${senderId} (dmPolicy: allowlist)`);
        return;
      }
    }
  }
  const mentions = message.mentions ?? payload.mentions ?? [];
  const wasMentioned = mentions.length > 0;
  if (isGroup) {
    const { groupConfig } = resolveFeishuGroupConfig({ cfg, accountId, chatId });
    const requireMention = groupConfig?.requireMention ?? true;
    if (requireMention && !wasMentioned) {
      logger.debug('Ignoring group message without @mention (requireMention: true)');
      return;
    }
  }
  let text = '';
  if (msgType === 'text') {
    try {
      if (message.content) {
        const content = JSON.parse(message.content);
        text = content.text || '';
      }
    } catch (err) {
      logger.error(`Failed to parse text message content: ${formatErrorMessage(err)}`);
    }
  }
  for (const mention of mentions) {
    if (mention.key) {
      text = text.replace(mention.key, '').trim();
    }
  }
  let media = null;
  if (msgType !== 'text') {
    try {
      media = await resolveFeishuMedia(client, message, maxMediaBytes);
    } catch (err) {
      logger.error(`Failed to download media: ${formatErrorMessage(err)}`);
    }
  }
  let bodyText = text;
  if (!bodyText && media) {
    bodyText = media.placeholder;
  }
  if (!bodyText && !media) {
    logger.debug('Empty message after processing, skipping');
    return;
  }
  const senderName = sender?.sender_id?.user_id || 'unknown';
  const streamingEnabled = (feishuCfg.streaming ?? true) && Boolean(options.credentials);
  const streamingSession = streamingEnabled && options.credentials ? new FeishuStreamingSession(client, options.credentials) : null;
  let streamingStarted = false;
  let lastPartialText = '';
  const ctx = {
    Body: bodyText,
    RawBody: text || media?.placeholder || '',
    From: senderId,
    To: chatId,
    SenderId: senderId,
    SenderName: senderName,
    ChatType: isGroup ? 'group' : 'dm',
    Provider: 'feishu',
    Surface: 'feishu',
    Timestamp: Number(message.create_time),
    MessageSid: message.message_id,
    AccountId: accountId,
    OriginatingChannel: 'feishu',
    OriginatingTo: chatId,
    // Media fields (similar to Telegram)
    MediaPath: media?.path,
    MediaType: media?.contentType,
    MediaUrl: media?.path,
    WasMentioned: isGroup ? wasMentioned : void 0
  };
  const agentId = resolveSessionAgentId({ config: cfg });
  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg,
    agentId,
    channel: 'feishu',
    accountId
  });
  await dispatchReplyWithBufferedBlockDispatcher({
    ctx,
    cfg,
    dispatcherOptions: {
      ...prefixOptions,
      deliver: async (payload2, info) => {
        const hasMedia = payload2.mediaUrl || payload2.mediaUrls && payload2.mediaUrls.length > 0;
        if (!payload2.text && !hasMedia) {
          return;
        }
        if (streamingSession?.isActive() && info?.kind === 'block' && payload2.text) {
          logger.debug(`Updating streaming card with block text: ${payload2.text.length} chars`);
          await streamingSession.update(payload2.text);
          return;
        }
        if (streamingSession?.isActive() && info?.kind === 'final') {
          await streamingSession.close(payload2.text);
          streamingStarted = false;
          return;
        }
        const mediaUrls = payload2.mediaUrls?.length ? payload2.mediaUrls : payload2.mediaUrl ? [payload2.mediaUrl] : [];
        if (mediaUrls.length > 0) {
          if (streamingSession?.isActive()) {
            await streamingSession.close();
            streamingStarted = false;
          }
          for (let i = 0; i < mediaUrls.length; i++) {
            const mediaUrl = mediaUrls[i];
            const caption = i === 0 ? payload2.text || '' : '';
            await sendMessageFeishu(
              client,
              chatId,
              { text: caption },
              {
                mediaUrl,
                receiveIdType: 'chat_id'
              }
            );
          }
        } else if (payload2.text) {
          if (!streamingSession?.isActive()) {
            await sendMessageFeishu(
              client,
              chatId,
              { text: payload2.text },
              {
                msgType: 'text',
                receiveIdType: 'chat_id'
              }
            );
          }
        }
      },
      onError: (err) => {
        logger.error(`Reply error: ${formatErrorMessage(err)}`);
        if (streamingSession?.isActive()) {
          streamingSession.close().catch(() => {
          });
        }
      },
      onReplyStart: async () => {
        if (streamingSession && !streamingStarted) {
          try {
            await streamingSession.start(chatId, 'chat_id', options.botName);
            streamingStarted = true;
            logger.debug(`Started streaming card for chat ${chatId}`);
          } catch (err) {
            logger.warn(`Failed to start streaming card: ${formatErrorMessage(err)}`);
          }
        }
      }
    },
    replyOptions: {
      disableBlockStreaming: !feishuCfg.blockStreaming,
      onModelSelected,
      onPartialReply: streamingSession ? async (payload2) => {
        if (!streamingSession.isActive() || !payload2.text) {
          return;
        }
        if (payload2.text === lastPartialText) {
          return;
        }
        lastPartialText = payload2.text;
        await streamingSession.update(payload2.text);
      } : void 0,
      onReasoningStream: streamingSession ? async (payload2) => {
        if (!streamingSession.isActive() || !payload2.text) {
          return;
        }
        if (payload2.text === lastPartialText) {
          return;
        }
        lastPartialText = payload2.text;
        await streamingSession.update(payload2.text);
      } : void 0
    }
  });
  if (streamingSession?.isActive()) {
    await streamingSession.close();
  }
}
export {
  processFeishuMessage
};
