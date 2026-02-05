import { resolveMatrixRoomConfig } from './matrix/monitor/rooms.js';
function resolveMatrixGroupRequireMention(params) {
  const rawGroupId = params.groupId?.trim() ?? '';
  let roomId = rawGroupId;
  const lower = roomId.toLowerCase();
  if (lower.startsWith('matrix:')) {
    roomId = roomId.slice('matrix:'.length).trim();
  }
  if (roomId.toLowerCase().startsWith('channel:')) {
    roomId = roomId.slice('channel:'.length).trim();
  }
  if (roomId.toLowerCase().startsWith('room:')) {
    roomId = roomId.slice('room:'.length).trim();
  }
  const groupChannel = params.groupChannel?.trim() ?? '';
  const aliases = groupChannel ? [groupChannel] : [];
  const cfg = params.cfg;
  const resolved = resolveMatrixRoomConfig({
    rooms: cfg.channels?.matrix?.groups ?? cfg.channels?.matrix?.rooms,
    roomId,
    aliases,
    name: groupChannel || void 0
  }).config;
  if (resolved) {
    if (resolved.autoReply === true) {
      return false;
    }
    if (resolved.autoReply === false) {
      return true;
    }
    if (typeof resolved.requireMention === 'boolean') {
      return resolved.requireMention;
    }
  }
  return true;
}
function resolveMatrixGroupToolPolicy(params) {
  const rawGroupId = params.groupId?.trim() ?? '';
  let roomId = rawGroupId;
  const lower = roomId.toLowerCase();
  if (lower.startsWith('matrix:')) {
    roomId = roomId.slice('matrix:'.length).trim();
  }
  if (roomId.toLowerCase().startsWith('channel:')) {
    roomId = roomId.slice('channel:'.length).trim();
  }
  if (roomId.toLowerCase().startsWith('room:')) {
    roomId = roomId.slice('room:'.length).trim();
  }
  const groupChannel = params.groupChannel?.trim() ?? '';
  const aliases = groupChannel ? [groupChannel] : [];
  const cfg = params.cfg;
  const resolved = resolveMatrixRoomConfig({
    rooms: cfg.channels?.matrix?.groups ?? cfg.channels?.matrix?.rooms,
    roomId,
    aliases,
    name: groupChannel || void 0
  }).config;
  return resolved?.tools;
}
export {
  resolveMatrixGroupRequireMention,
  resolveMatrixGroupToolPolicy
};
