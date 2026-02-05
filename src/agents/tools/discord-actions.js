/**
 * Discord action tool for bot interactions and channel management.
 * @module agents/tools/discord-actions
 */
import { createActionGate, readStringParam } from './common.js';
import { handleDiscordGuildAction } from './discord-actions-guild.js';
import { handleDiscordMessagingAction } from './discord-actions-messaging.js';
import { handleDiscordModerationAction } from './discord-actions-moderation.js';
import { handleDiscordPresenceAction } from './discord-actions-presence.js';
const messagingActions = /* @__PURE__ */ new Set([
  'react',
  'reactions',
  'sticker',
  'poll',
  'permissions',
  'fetchMessage',
  'readMessages',
  'sendMessage',
  'editMessage',
  'deleteMessage',
  'threadCreate',
  'threadList',
  'threadReply',
  'pinMessage',
  'unpinMessage',
  'listPins',
  'searchMessages'
]);
const guildActions = /* @__PURE__ */ new Set([
  'memberInfo',
  'roleInfo',
  'emojiList',
  'emojiUpload',
  'stickerUpload',
  'roleAdd',
  'roleRemove',
  'channelInfo',
  'channelList',
  'voiceStatus',
  'eventList',
  'eventCreate',
  'channelCreate',
  'channelEdit',
  'channelDelete',
  'channelMove',
  'categoryCreate',
  'categoryEdit',
  'categoryDelete',
  'channelPermissionSet',
  'channelPermissionRemove'
]);
const moderationActions = /* @__PURE__ */ new Set(['timeout', 'kick', 'ban']);
const presenceActions = /* @__PURE__ */ new Set(['setPresence']);
async function handleDiscordAction(params, cfg) {
  const action = readStringParam(params, 'action', { required: true });
  const isActionEnabled = createActionGate(cfg.channels?.discord?.actions);
  if (messagingActions.has(action)) {
    return await handleDiscordMessagingAction(action, params, isActionEnabled);
  }
  if (guildActions.has(action)) {
    return await handleDiscordGuildAction(action, params, isActionEnabled);
  }
  if (moderationActions.has(action)) {
    return await handleDiscordModerationAction(action, params, isActionEnabled);
  }
  if (presenceActions.has(action)) {
    return await handleDiscordPresenceAction(action, params, isActionEnabled);
  }
  throw new Error(`Unknown action: ${action}`);
}
export {
  handleDiscordAction
};
