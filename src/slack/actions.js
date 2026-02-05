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
function normalizeEmoji(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Emoji is required for Slack reactions');
  }
  return trimmed.replace(/^:+|:+$/g, '');
}
async function getClient(opts = {}) {
  const token = resolveToken(opts.token, opts.accountId);
  return opts.client ?? createSlackWebClient(token);
}
async function resolveBotUserId(client) {
  const auth = await client.auth.test();
  if (!auth?.user_id) {
    throw new Error('Failed to resolve Slack bot user id');
  }
  return auth.user_id;
}
async function reactSlackMessage(channelId, messageId, emoji, opts = {}) {
  const client = await getClient(opts);
  await client.reactions.add({
    channel: channelId,
    timestamp: messageId,
    name: normalizeEmoji(emoji)
  });
}
async function removeSlackReaction(channelId, messageId, emoji, opts = {}) {
  const client = await getClient(opts);
  await client.reactions.remove({
    channel: channelId,
    timestamp: messageId,
    name: normalizeEmoji(emoji)
  });
}
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
async function sendSlackMessage(to, content, opts = {}) {
  return await sendMessageSlack(to, content, {
    accountId: opts.accountId,
    token: opts.token,
    mediaUrl: opts.mediaUrl,
    client: opts.client,
    threadTs: opts.threadTs
  });
}
async function editSlackMessage(channelId, messageId, content, opts = {}) {
  const client = await getClient(opts);
  await client.chat.update({
    channel: channelId,
    ts: messageId,
    text: content
  });
}
async function deleteSlackMessage(channelId, messageId, opts = {}) {
  const client = await getClient(opts);
  await client.chat.delete({
    channel: channelId,
    ts: messageId
  });
}
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
async function getSlackMemberInfo(userId, opts = {}) {
  const client = await getClient(opts);
  return await client.users.info({ user: userId });
}
async function listSlackEmojis(opts = {}) {
  const client = await getClient(opts);
  return await client.emoji.list();
}
async function pinSlackMessage(channelId, messageId, opts = {}) {
  const client = await getClient(opts);
  await client.pins.add({ channel: channelId, timestamp: messageId });
}
async function unpinSlackMessage(channelId, messageId, opts = {}) {
  const client = await getClient(opts);
  await client.pins.remove({ channel: channelId, timestamp: messageId });
}
async function listSlackPins(channelId, opts = {}) {
  const client = await getClient(opts);
  const result = await client.pins.list({ channel: channelId });
  return result.items ?? [];
}
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
