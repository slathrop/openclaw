import { HEARTBEAT_TOKEN } from './tokens.js';
const HEARTBEAT_PROMPT = 'Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.';
const DEFAULT_HEARTBEAT_EVERY = '30m';
const DEFAULT_HEARTBEAT_ACK_MAX_CHARS = 300;
function isHeartbeatContentEffectivelyEmpty(content) {
  if (content === void 0 || content === null) {
    return false;
  }
  if (typeof content !== 'string') {
    return false;
  }
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (/^#+(\s|$)/.test(trimmed)) {
      continue;
    }
    if (/^[-*+]\s*(\[[\sXx]?\]\s*)?$/.test(trimmed)) {
      continue;
    }
    return false;
  }
  return true;
}
function resolveHeartbeatPrompt(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed || HEARTBEAT_PROMPT;
}
function stripTokenAtEdges(raw) {
  let text = raw.trim();
  if (!text) {
    return { text: '', didStrip: false };
  }
  const token = HEARTBEAT_TOKEN;
  if (!text.includes(token)) {
    return { text, didStrip: false };
  }
  let didStrip = false;
  let changed = true;
  while (changed) {
    changed = false;
    const next = text.trim();
    if (next.startsWith(token)) {
      const after = next.slice(token.length).trimStart();
      text = after;
      didStrip = true;
      changed = true;
      continue;
    }
    if (next.endsWith(token)) {
      const before = next.slice(0, Math.max(0, next.length - token.length));
      text = before.trimEnd();
      didStrip = true;
      changed = true;
    }
  }
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return { text: collapsed, didStrip };
}
function stripHeartbeatToken(raw, opts = {}) {
  if (!raw) {
    return { shouldSkip: true, text: '', didStrip: false };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { shouldSkip: true, text: '', didStrip: false };
  }
  const mode = opts.mode ?? 'message';
  const maxAckCharsRaw = opts.maxAckChars;
  const parsedAckChars = typeof maxAckCharsRaw === 'string' ? Number(maxAckCharsRaw) : maxAckCharsRaw;
  const maxAckChars = Math.max(
    0,
    typeof parsedAckChars === 'number' && Number.isFinite(parsedAckChars) ? parsedAckChars : DEFAULT_HEARTBEAT_ACK_MAX_CHARS
  );
  const stripMarkup = (text) => text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/^[*`~_]+/, '').replace(/[*`~_]+$/, '');
  const trimmedNormalized = stripMarkup(trimmed);
  const hasToken = trimmed.includes(HEARTBEAT_TOKEN) || trimmedNormalized.includes(HEARTBEAT_TOKEN);
  if (!hasToken) {
    return { shouldSkip: false, text: trimmed, didStrip: false };
  }
  const strippedOriginal = stripTokenAtEdges(trimmed);
  const strippedNormalized = stripTokenAtEdges(trimmedNormalized);
  const picked = strippedOriginal.didStrip && strippedOriginal.text ? strippedOriginal : strippedNormalized;
  if (!picked.didStrip) {
    return { shouldSkip: false, text: trimmed, didStrip: false };
  }
  if (!picked.text) {
    return { shouldSkip: true, text: '', didStrip: true };
  }
  const rest = picked.text.trim();
  if (mode === 'heartbeat') {
    if (rest.length <= maxAckChars) {
      return { shouldSkip: true, text: '', didStrip: true };
    }
  }
  return { shouldSkip: false, text: rest, didStrip: true };
}
export {
  DEFAULT_HEARTBEAT_ACK_MAX_CHARS,
  DEFAULT_HEARTBEAT_EVERY,
  HEARTBEAT_PROMPT,
  isHeartbeatContentEffectivelyEmpty,
  resolveHeartbeatPrompt,
  stripHeartbeatToken
};
