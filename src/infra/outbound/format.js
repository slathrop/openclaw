/**
 * Outbound delivery summary formatting.
 * Formats human-readable delivery confirmations with channel-specific metadata.
 * @module
 */

import { getChannelPlugin } from '../../channels/plugins/index.js';
import { getChatChannelMeta, normalizeChatChannelId } from '../../channels/registry.js';
const resolveChannelLabel = (channel) => {
  const pluginLabel = getChannelPlugin(channel)?.meta.label;
  if (pluginLabel) {
    return pluginLabel;
  }
  const normalized = normalizeChatChannelId(channel);
  if (normalized) {
    return getChatChannelMeta(normalized).label;
  }
  return channel;
};
function formatOutboundDeliverySummary(channel, result) {
  if (!result) {
    return `\u2705 Sent via ${resolveChannelLabel(channel)}. Message ID: unknown`;
  }
  const label = resolveChannelLabel(result.channel);
  const base = `\u2705 Sent via ${label}. Message ID: ${result.messageId}`;
  if ('chatId' in result) {
    return `${base} (chat ${result.chatId})`;
  }
  if ('channelId' in result) {
    return `${base} (channel ${result.channelId})`;
  }
  if ('roomId' in result) {
    return `${base} (room ${result.roomId})`;
  }
  if ('conversationId' in result) {
    return `${base} (conversation ${result.conversationId})`;
  }
  return base;
}
function buildOutboundDeliveryJson(params) {
  const { channel, to, result } = params;
  const messageId = result?.messageId ?? 'unknown';
  const payload = {
    channel,
    via: params.via ?? 'direct',
    to,
    messageId,
    mediaUrl: params.mediaUrl ?? null
  };
  if (result && 'chatId' in result && result.chatId !== void 0) {
    payload.chatId = result.chatId;
  }
  if (result && 'channelId' in result && result.channelId !== void 0) {
    payload.channelId = result.channelId;
  }
  if (result && 'roomId' in result && result.roomId !== void 0) {
    payload.roomId = result.roomId;
  }
  if (result && 'conversationId' in result && result.conversationId !== void 0) {
    payload.conversationId = result.conversationId;
  }
  if (result && 'timestamp' in result && result.timestamp !== void 0) {
    payload.timestamp = result.timestamp;
  }
  if (result && 'toJid' in result && result.toJid !== void 0) {
    payload.toJid = result.toJid;
  }
  if (result && 'meta' in result && result.meta !== void 0) {
    payload.meta = result.meta;
  }
  return payload;
}
function formatGatewaySummary(params) {
  const action = params.action ?? 'Sent';
  const channelSuffix = params.channel ? ` (${params.channel})` : '';
  const messageId = params.messageId ?? 'unknown';
  return `\u2705 ${action} via gateway${channelSuffix}. Message ID: ${messageId}`;
}
export {
  buildOutboundDeliveryJson,
  formatGatewaySummary,
  formatOutboundDeliverySummary
};
