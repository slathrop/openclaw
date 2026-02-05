/**
 * Session send policy resolution.
 *
 * Evaluates whether a message should be allowed or denied based on
 * session-level overrides, config-level rules matching channel/chatType/keyPrefix,
 * and fallback defaults.
 * @typedef {"allow" | "deny"} SessionSendPolicyDecision
 */
import { normalizeChatType } from '../channels/chat-type.js';

/**
 * @param {string | null} [raw]
 * @returns {SessionSendPolicyDecision | undefined}
 */
export const normalizeSendPolicy = (raw) => {
  const value = raw?.trim().toLowerCase();
  if (value === 'allow') {
    return 'allow';
  }
  if (value === 'deny') {
    return 'deny';
  }
  return undefined;
};

const normalizeMatchValue = (raw) => {
  const value = raw?.trim().toLowerCase();
  return value ? value : undefined;
};

const deriveChannelFromKey = (key) => {
  if (!key) {
    return undefined;
  }
  const parts = key.split(':').filter(Boolean);
  if (parts.length >= 3 && (parts[1] === 'group' || parts[1] === 'channel')) {
    return normalizeMatchValue(parts[0]);
  }
  return undefined;
};

const deriveChatTypeFromKey = (key) => {
  if (!key) {
    return undefined;
  }
  if (key.includes(':group:')) {
    return 'group';
  }
  if (key.includes(':channel:')) {
    return 'channel';
  }
  return undefined;
};

/**
 * @param {object} params
 * @param {object} params.cfg
 * @param {object} [params.entry]
 * @param {string} [params.sessionKey]
 * @param {string} [params.channel]
 * @param {string} [params.chatType]
 * @returns {SessionSendPolicyDecision}
 */
export const resolveSendPolicy = (params) => {
  const override = normalizeSendPolicy(params.entry?.sendPolicy);
  if (override) {
    return override;
  }

  const policy = params.cfg.session?.sendPolicy;
  if (!policy) {
    return 'allow';
  }

  const channel =
    normalizeMatchValue(params.channel) ??
    normalizeMatchValue(params.entry?.channel) ??
    normalizeMatchValue(params.entry?.lastChannel) ??
    deriveChannelFromKey(params.sessionKey);
  const chatType =
    normalizeChatType(params.chatType ?? params.entry?.chatType) ??
    normalizeChatType(deriveChatTypeFromKey(params.sessionKey));
  const sessionKey = params.sessionKey ?? '';

  let allowedMatch = false;
  for (const rule of policy.rules ?? []) {
    if (!rule) {
      continue;
    }
    const action = normalizeSendPolicy(rule.action) ?? 'allow';
    const match = rule.match ?? {};
    const matchChannel = normalizeMatchValue(match.channel);
    const matchChatType = normalizeChatType(match.chatType);
    const matchPrefix = normalizeMatchValue(match.keyPrefix);

    if (matchChannel && matchChannel !== channel) {
      continue;
    }
    if (matchChatType && matchChatType !== chatType) {
      continue;
    }
    if (matchPrefix && !sessionKey.startsWith(matchPrefix)) {
      continue;
    }
    if (action === 'deny') {
      return 'deny';
    }
    allowedMatch = true;
  }

  if (allowedMatch) {
    return 'allow';
  }

  const fallback = normalizeSendPolicy(policy.default);
  return fallback ?? 'allow';
};
