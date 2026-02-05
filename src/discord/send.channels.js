import { Routes } from 'discord-api-types/v10';
import { resolveDiscordRest } from './send.shared.js';
async function createChannelDiscord(payload, opts = {}) {
  const rest = resolveDiscordRest(opts);
  const body = {
    name: payload.name
  };
  if (payload.type !== void 0) {
    body.type = payload.type;
  }
  if (payload.parentId) {
    body.parent_id = payload.parentId;
  }
  if (payload.topic) {
    body.topic = payload.topic;
  }
  if (payload.position !== void 0) {
    body.position = payload.position;
  }
  if (payload.nsfw !== void 0) {
    body.nsfw = payload.nsfw;
  }
  return await rest.post(Routes.guildChannels(payload.guildId), {
    body
  });
}
async function editChannelDiscord(payload, opts = {}) {
  const rest = resolveDiscordRest(opts);
  const body = {};
  if (payload.name !== void 0) {
    body.name = payload.name;
  }
  if (payload.topic !== void 0) {
    body.topic = payload.topic;
  }
  if (payload.position !== void 0) {
    body.position = payload.position;
  }
  if (payload.parentId !== void 0) {
    body.parent_id = payload.parentId;
  }
  if (payload.nsfw !== void 0) {
    body.nsfw = payload.nsfw;
  }
  if (payload.rateLimitPerUser !== void 0) {
    body.rate_limit_per_user = payload.rateLimitPerUser;
  }
  return await rest.patch(Routes.channel(payload.channelId), {
    body
  });
}
async function deleteChannelDiscord(channelId, opts = {}) {
  const rest = resolveDiscordRest(opts);
  await rest.delete(Routes.channel(channelId));
  return { ok: true, channelId };
}
async function moveChannelDiscord(payload, opts = {}) {
  const rest = resolveDiscordRest(opts);
  const body = [
    {
      id: payload.channelId,
      ...payload.parentId !== void 0 && { parent_id: payload.parentId },
      ...payload.position !== void 0 && { position: payload.position }
    }
  ];
  await rest.patch(Routes.guildChannels(payload.guildId), { body });
  return { ok: true };
}
async function setChannelPermissionDiscord(payload, opts = {}) {
  const rest = resolveDiscordRest(opts);
  const body = {
    type: payload.targetType
  };
  if (payload.allow !== void 0) {
    body.allow = payload.allow;
  }
  if (payload.deny !== void 0) {
    body.deny = payload.deny;
  }
  await rest.put(`/channels/${payload.channelId}/permissions/${payload.targetId}`, { body });
  return { ok: true };
}
async function removeChannelPermissionDiscord(channelId, targetId, opts = {}) {
  const rest = resolveDiscordRest(opts);
  await rest.delete(`/channels/${channelId}/permissions/${targetId}`);
  return { ok: true };
}
export {
  createChannelDiscord,
  deleteChannelDiscord,
  editChannelDiscord,
  moveChannelDiscord,
  removeChannelPermissionDiscord,
  setChannelPermissionDiscord
};
