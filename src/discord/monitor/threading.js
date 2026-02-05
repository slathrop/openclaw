import { ChannelType } from '@buape/carbon';
import { Routes } from 'discord-api-types/v10';
import { createReplyReferencePlanner } from '../../auto-reply/reply/reply-reference.js';
import { logVerbose } from '../../globals.js';
import { buildAgentSessionKey } from '../../routing/resolve-route.js';
import { truncateUtf16Safe } from '../../utils.js';
import { resolveDiscordChannelInfo } from './message-utils.js';
const DISCORD_THREAD_STARTER_CACHE = /* @__PURE__ */ new Map();
function __resetDiscordThreadStarterCacheForTest() {
  DISCORD_THREAD_STARTER_CACHE.clear();
}
function isDiscordThreadType(type) {
  return type === ChannelType.PublicThread || type === ChannelType.PrivateThread || type === ChannelType.AnnouncementThread;
}
function resolveDiscordThreadChannel(params) {
  if (!params.isGuildMessage) {
    return null;
  }
  const { message, channelInfo } = params;
  const channel = 'channel' in message ? message.channel : void 0;
  const isThreadChannel = channel && typeof channel === 'object' && 'isThread' in channel && typeof channel.isThread === 'function' && channel.isThread();
  if (isThreadChannel) {
    return channel;
  }
  if (!isDiscordThreadType(channelInfo?.type)) {
    return null;
  }
  return {
    id: message.channelId,
    name: channelInfo?.name ?? void 0,
    parentId: channelInfo?.parentId ?? void 0,
    parent: void 0,
    ownerId: channelInfo?.ownerId ?? void 0
  };
}
async function resolveDiscordThreadParentInfo(params) {
  const { threadChannel, channelInfo, client } = params;
  const parentId = threadChannel.parentId ?? threadChannel.parent?.id ?? channelInfo?.parentId ?? void 0;
  if (!parentId) {
    return {};
  }
  let parentName = threadChannel.parent?.name;
  const parentInfo = await resolveDiscordChannelInfo(client, parentId);
  parentName = parentName ?? parentInfo?.name;
  const parentType = parentInfo?.type;
  return { id: parentId, name: parentName, type: parentType };
}
async function resolveDiscordThreadStarter(params) {
  const cacheKey = params.channel.id;
  const cached = DISCORD_THREAD_STARTER_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }
  try {
    const parentType = params.parentType;
    const isForumParent = parentType === ChannelType.GuildForum || parentType === ChannelType.GuildMedia;
    const messageChannelId = isForumParent ? params.channel.id : params.parentId;
    if (!messageChannelId) {
      return null;
    }
    const starter = await params.client.rest.get(
      Routes.channelMessage(messageChannelId, params.channel.id)
    );
    if (!starter) {
      return null;
    }
    const text = starter.content?.trim() ?? starter.embeds?.[0]?.description?.trim() ?? '';
    if (!text) {
      return null;
    }
    const author = starter.member?.nick ?? starter.member?.displayName ?? (starter.author ? starter.author.discriminator && starter.author.discriminator !== '0' ? `${starter.author.username ?? 'Unknown'}#${starter.author.discriminator}` : starter.author.username ?? starter.author.id ?? 'Unknown' : 'Unknown');
    const timestamp = params.resolveTimestampMs(starter.timestamp);
    const payload = {
      text,
      author,
      timestamp: timestamp ?? void 0
    };
    DISCORD_THREAD_STARTER_CACHE.set(cacheKey, payload);
    return payload;
  } catch {
    return null;
  }
}
function resolveDiscordReplyTarget(opts) {
  if (opts.replyToMode === 'off') {
    return void 0;
  }
  const replyToId = opts.replyToId?.trim();
  if (!replyToId) {
    return void 0;
  }
  if (opts.replyToMode === 'all') {
    return replyToId;
  }
  return opts.hasReplied ? void 0 : replyToId;
}
function sanitizeDiscordThreadName(rawName, fallbackId) {
  const cleanedName = rawName.replace(/<@!?\d+>/g, '').replace(/<@&\d+>/g, '').replace(/<#\d+>/g, '').replace(/\s+/g, ' ').trim();
  const baseSource = cleanedName || `Thread ${fallbackId}`;
  const base = truncateUtf16Safe(baseSource, 80);
  return truncateUtf16Safe(base, 100) || `Thread ${fallbackId}`;
}
function resolveDiscordAutoThreadContext(params) {
  const createdThreadId = String(params.createdThreadId ?? '').trim();
  if (!createdThreadId) {
    return null;
  }
  const messageChannelId = params.messageChannelId.trim();
  if (!messageChannelId) {
    return null;
  }
  const threadSessionKey = buildAgentSessionKey({
    agentId: params.agentId,
    channel: params.channel,
    peer: { kind: 'channel', id: createdThreadId }
  });
  const parentSessionKey = buildAgentSessionKey({
    agentId: params.agentId,
    channel: params.channel,
    peer: { kind: 'channel', id: messageChannelId }
  });
  return {
    createdThreadId,
    From: `${params.channel}:channel:${createdThreadId}`,
    To: `channel:${createdThreadId}`,
    OriginatingTo: `channel:${createdThreadId}`,
    SessionKey: threadSessionKey,
    ParentSessionKey: parentSessionKey
  };
}
async function resolveDiscordAutoThreadReplyPlan(params) {
  const originalReplyTarget = `channel:${params.message.channelId}`;
  const createdThreadId = await maybeCreateDiscordAutoThread({
    client: params.client,
    message: params.message,
    isGuildMessage: params.isGuildMessage,
    channelConfig: params.channelConfig,
    threadChannel: params.threadChannel,
    baseText: params.baseText,
    combinedBody: params.combinedBody
  });
  const deliveryPlan = resolveDiscordReplyDeliveryPlan({
    replyTarget: originalReplyTarget,
    replyToMode: params.replyToMode,
    messageId: params.message.id,
    threadChannel: params.threadChannel,
    createdThreadId
  });
  const autoThreadContext = params.isGuildMessage ? resolveDiscordAutoThreadContext({
    agentId: params.agentId,
    channel: params.channel,
    messageChannelId: params.message.channelId,
    createdThreadId
  }) : null;
  return { ...deliveryPlan, createdThreadId, autoThreadContext };
}
async function maybeCreateDiscordAutoThread(params) {
  if (!params.isGuildMessage) {
    return void 0;
  }
  if (!params.channelConfig?.autoThread) {
    return void 0;
  }
  if (params.threadChannel) {
    return void 0;
  }
  try {
    const threadName = sanitizeDiscordThreadName(
      params.baseText || params.combinedBody || 'Thread',
      params.message.id
    );
    const created = await params.client.rest.post(
      `${Routes.channelMessage(params.message.channelId, params.message.id)}/threads`,
      {
        body: {
          name: threadName,
          auto_archive_duration: 60
        }
      }
    );
    const createdId = created?.id ? String(created.id) : '';
    return createdId || void 0;
  } catch (err) {
    logVerbose(
      `discord: autoThread failed for ${params.message.channelId}/${params.message.id}: ${String(err)}`
    );
    return void 0;
  }
}
function resolveDiscordReplyDeliveryPlan(params) {
  const originalReplyTarget = params.replyTarget;
  let deliverTarget = originalReplyTarget;
  let replyTarget = originalReplyTarget;
  if (params.createdThreadId) {
    deliverTarget = `channel:${params.createdThreadId}`;
    replyTarget = deliverTarget;
  }
  const allowReference = deliverTarget === originalReplyTarget;
  const replyReference = createReplyReferencePlanner({
    replyToMode: allowReference ? params.replyToMode : 'off',
    existingId: params.threadChannel ? params.messageId : void 0,
    startId: params.messageId,
    allowReference
  });
  return { deliverTarget, replyTarget, replyReference };
}
export {
  __resetDiscordThreadStarterCacheForTest,
  maybeCreateDiscordAutoThread,
  resolveDiscordAutoThreadContext,
  resolveDiscordAutoThreadReplyPlan,
  resolveDiscordReplyDeliveryPlan,
  resolveDiscordReplyTarget,
  resolveDiscordThreadChannel,
  resolveDiscordThreadParentInfo,
  resolveDiscordThreadStarter,
  sanitizeDiscordThreadName
};
