const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { loadConfig } from '../config/config.js';
import { logVerbose } from '../globals.js';
import { resolveSlackAccount } from './accounts.js';
import { createSlackWebClient } from './client.js';
import { sendMessageSlack } from './send.js';
import { resolveSlackBotToken } from './token.js';
function resolveToken(explicit, accountId) {
  const cfg = loadConfig();
  const account = resolveSlackAccount({ cfg, accountId });
  const token = resolveSlackBotToken(explicit ?? account.botToken ?? void 0);
  if (!token) {
    logVerbose(
      `slack actions: missing bot token for account=${account.accountId} explicit=${Boolean(
        explicit
      )} source=${account.botTokenSource ?? 'unknown'}`
    );
    throw new Error('SLACK_BOT_TOKEN or channels.slack.botToken is required for Slack actions');
  }
  return token;
}
__name(resolveToken, 'resolveToken');
function normalizeEmoji(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Emoji is required for Slack reactions');
  }
  return trimmed.replace(/^:+|:+$/g, '');
}
__name(normalizeEmoji, 'normalizeEmoji');
async function getClient(opts = {}) {
  const token = resolveToken(opts.token, opts.accountId);
  return opts.client ?? createSlackWebClient(token);
}
__name(getClient, 'getClient');
async function resolveBotUserId(client) {
  const auth = await client.auth.test();
  if (!auth?.user_id) {
    throw new Error('Failed to resolve Slack bot user id');
  }
  return auth.user_id;
}
__name(resolveBotUserId, 'resolveBotUserId');
async function reactSlackMessage(channelId, messageId, emoji, opts = {}) {
  const client = await getClient(opts);
  await client.reactions.add({
    channel: channelId,
    timestamp: messageId,
    name: normalizeEmoji(emoji)
  });
}
__name(reactSlackMessage, 'reactSlackMessage');
async function removeSlackReaction(channelId, messageId, emoji, opts = {}) {
  const client = await getClient(opts);
  await client.reactions.remove({
    channel: channelId,
    timestamp: messageId,
    name: normalizeEmoji(emoji)
  });
}
__name(removeSlackReaction, 'removeSlackReaction');
async function removeOwnSlackReactions(channelId, messageId, opts = {}) {
  const client = await getClient(opts);
  const userId = await resolveBotUserId(client);
  const reactions = await listSlackReactions(channelId, messageId, { client });
  const toRemove = /* @__PURE__ */ new Set();
  for (const reaction of reactions ?? []) {
    const name = reaction?.name;
    if (!name) {
      continue;
    }
    const users = reaction?.users ?? [];
    if (users.includes(userId)) {
      toRemove.add(name);
    }
  }
  if (toRemove.size === 0) {
    return [];
  }
  await Promise.all(
    Array.from(
      toRemove,
      (name) => client.reactions.remove({
        channel: channelId,
        timestamp: messageId,
        name
      })
    )
  );
  return Array.from(toRemove);
}
__name(removeOwnSlackReactions, 'removeOwnSlackReactions');
async function listSlackReactions(channelId, messageId, opts = {}) {
  const client = await getClient(opts);
  const result = await client.reactions.get({
    channel: channelId,
    timestamp: messageId,
    full: true
  });
  const message = result.message;
  return message?.reactions ?? [];
}
__name(listSlackReactions, 'listSlackReactions');
async function sendSlackMessage(to, content, opts = {}) {
  return await sendMessageSlack(to, content, {
    accountId: opts.accountId,
    token: opts.token,
    mediaUrl: opts.mediaUrl,
    client: opts.client,
    threadTs: opts.threadTs
  });
}
__name(sendSlackMessage, 'sendSlackMessage');
async function editSlackMessage(channelId, messageId, content, opts = {}) {
  const client = await getClient(opts);
  await client.chat.update({
    channel: channelId,
    ts: messageId,
    text: content
  });
}
__name(editSlackMessage, 'editSlackMessage');
async function deleteSlackMessage(channelId, messageId, opts = {}) {
  const client = await getClient(opts);
  await client.chat.delete({
    channel: channelId,
    ts: messageId
  });
}
__name(deleteSlackMessage, 'deleteSlackMessage');
async function readSlackMessages(channelId, opts = {}) {
  const client = await getClient(opts);
  if (opts.threadId) {
    const result2 = await client.conversations.replies({
      channel: channelId,
      ts: opts.threadId,
      limit: opts.limit,
      latest: opts.before,
      oldest: opts.after
    });
    return {
      // conversations.replies includes the parent message; drop it for replies-only reads.
      messages: (result2.messages ?? []).filter(
        (message) => message?.ts !== opts.threadId
      ),
      hasMore: Boolean(result2.has_more)
    };
  }
  const result = await client.conversations.history({
    channel: channelId,
    limit: opts.limit,
    latest: opts.before,
    oldest: opts.after
  });
  return {
    messages: result.messages ?? [],
    hasMore: Boolean(result.has_more)
  };
}
__name(readSlackMessages, 'readSlackMessages');
async function getSlackMemberInfo(userId, opts = {}) {
  const client = await getClient(opts);
  return await client.users.info({ user: userId });
}
__name(getSlackMemberInfo, 'getSlackMemberInfo');
async function listSlackEmojis(opts = {}) {
  const client = await getClient(opts);
  return await client.emoji.list();
}
__name(listSlackEmojis, 'listSlackEmojis');
async function pinSlackMessage(channelId, messageId, opts = {}) {
  const client = await getClient(opts);
  await client.pins.add({ channel: channelId, timestamp: messageId });
}
__name(pinSlackMessage, 'pinSlackMessage');
async function unpinSlackMessage(channelId, messageId, opts = {}) {
  const client = await getClient(opts);
  await client.pins.remove({ channel: channelId, timestamp: messageId });
}
__name(unpinSlackMessage, 'unpinSlackMessage');
async function listSlackPins(channelId, opts = {}) {
  const client = await getClient(opts);
  const result = await client.pins.list({ channel: channelId });
  return result.items ?? [];
}
__name(listSlackPins, 'listSlackPins');
export {
  deleteSlackMessage,
  editSlackMessage,
  getSlackMemberInfo,
  listSlackEmojis,
  listSlackPins,
  listSlackReactions,
  pinSlackMessage,
  reactSlackMessage,
  readSlackMessages,
  removeOwnSlackReactions,
  removeSlackReaction,
  sendSlackMessage,
  unpinSlackMessage
};
