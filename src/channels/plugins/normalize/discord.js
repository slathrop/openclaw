import { parseDiscordTarget } from '../../../discord/targets.js';
function normalizeDiscordMessagingTarget(raw) {
  const target = parseDiscordTarget(raw, { defaultKind: 'channel' });
  return target?.normalized;
}
function looksLikeDiscordTargetId(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  if (/^<@!?\d+>$/.test(trimmed)) {
    return true;
  }
  if (/^(user|channel|discord):/i.test(trimmed)) {
    return true;
  }
  if (/^\d{6,}$/.test(trimmed)) {
    return true;
  }
  return false;
}
export {
  looksLikeDiscordTargetId,
  normalizeDiscordMessagingTarget
};
