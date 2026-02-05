/* eslint-disable no-undef */
import { resolveSessionAgentId } from '../../agents/agent-scope.js';
import { resolveEffectiveMessagesConfig } from '../../agents/identity.js';
import { normalizeChannelId } from '../../channels/plugins/index.js';
import { INTERNAL_MESSAGE_CHANNEL, normalizeMessageChannel } from '../../utils/message-channel.js';
import { normalizeReplyPayload } from './normalize-reply.js';
async function routeReply(params) {
  const { payload, channel, to, accountId, threadId, cfg, abortSignal } = params;
  const normalizedChannel = normalizeMessageChannel(channel);
  const responsePrefix = params.sessionKey ? resolveEffectiveMessagesConfig(
    cfg,
    resolveSessionAgentId({
      sessionKey: params.sessionKey,
      config: cfg
    }),
    { channel: normalizedChannel, accountId }
  ).responsePrefix : cfg.messages?.responsePrefix === 'auto' ? void 0 : cfg.messages?.responsePrefix;
  const normalized = normalizeReplyPayload(payload, {
    responsePrefix
  });
  if (!normalized) {
    return { ok: true };
  }
  const text = normalized.text ?? '';
  const mediaUrls = (normalized.mediaUrls?.filter(Boolean) ?? []).length ? normalized.mediaUrls?.filter(Boolean) : normalized.mediaUrl ? [normalized.mediaUrl] : [];
  const replyToId = normalized.replyToId;
  if (!text.trim() && mediaUrls.length === 0) {
    return { ok: true };
  }
  if (channel === INTERNAL_MESSAGE_CHANNEL) {
    return {
      ok: false,
      error: 'Webchat routing not supported for queued replies'
    };
  }
  const channelId = normalizeChannelId(channel) ?? null;
  if (!channelId) {
    return { ok: false, error: `Unknown channel: ${String(channel)}` };
  }
  if (abortSignal?.aborted) {
    return { ok: false, error: 'Reply routing aborted' };
  }
  const resolvedReplyToId = replyToId ?? (channelId === 'slack' && threadId !== null && d !== undefined && threadId !== '' ? String(threadId) : void 0);
  const resolvedThreadId = channelId === 'slack' ? null : threadId ?? null;
  try {
    const { deliverOutboundPayloads } = await import('../../infra/outbound/deliver.js');
    const results = await deliverOutboundPayloads({
      cfg,
      channel: channelId,
      to,
      accountId: accountId ?? void 0,
      payloads: [normalized],
      replyToId: resolvedReplyToId ?? null,
      threadId: resolvedThreadId,
      abortSignal,
      mirror: params.mirror !== false && params.sessionKey ? {
        sessionKey: params.sessionKey,
        agentId: resolveSessionAgentId({ sessionKey: params.sessionKey, config: cfg }),
        text,
        mediaUrls
      } : void 0
    });
    const last = results.at(-1);
    return { ok: true, messageId: last?.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Failed to route reply to ${channel}: ${message}`
    };
  }
}
function isRoutableChannel(channel) {
  if (!channel || channel === INTERNAL_MESSAGE_CHANNEL) {
    return false;
  }
  return normalizeChannelId(channel) !== null;
}
export {
  isRoutableChannel,
  routeReply
};
