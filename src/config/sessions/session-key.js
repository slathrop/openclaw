/**
 * @module sessions/session-key
 * Session key derivation and resolution (per-sender vs global scope).
 */
import {
  buildAgentMainSessionKey,
  DEFAULT_AGENT_ID,
  normalizeMainKey
} from '../../routing/session-key.js';
import {normalizeE164} from '../../utils.js';
import {resolveGroupSessionKey} from './group.js';

/**
 * Derives the session key for a given scope and message context.
 * @param {import('./types.js').SessionScope} scope
 * @param {import('../../auto-reply/templating.js').MsgContext} ctx
 * @returns {string}
 */
export function deriveSessionKey(scope, ctx) {
  if (scope === 'global') {
    return 'global';
  }
  const resolvedGroup = resolveGroupSessionKey(ctx);
  if (resolvedGroup) {
    return resolvedGroup.key;
  }
  const from = ctx.From ? normalizeE164(ctx.From) : '';
  return from || 'unknown';
}

/**
 * Resolves the session key with a canonical direct-chat bucket (default: "main").
 * All non-group direct chats collapse to this bucket; groups stay isolated.
 * @param {import('./types.js').SessionScope} scope
 * @param {import('../../auto-reply/templating.js').MsgContext} ctx
 * @param {string} [mainKey]
 * @returns {string}
 */
export function resolveSessionKey(scope, ctx, mainKey) {
  const explicit = ctx.SessionKey?.trim();
  if (explicit) {
    return explicit.toLowerCase();
  }
  const raw = deriveSessionKey(scope, ctx);
  if (scope === 'global') {
    return raw;
  }
  const canonicalMainKey = normalizeMainKey(mainKey);
  const canonical = buildAgentMainSessionKey({
    agentId: DEFAULT_AGENT_ID,
    mainKey: canonicalMainKey
  });
  const isGroup = raw.includes(':group:') || raw.includes(':channel:');
  if (!isGroup) {
    return canonical;
  }
  return `agent:${DEFAULT_AGENT_ID}:${raw}`;
}
