/**
 * @module routing/session-key
 * Session key generation and normalization.
 *
 * Generates deterministic session keys used for conversation persistence
 * and concurrency control. Keys encode agent ID, channel, account, peer
 * kind/ID, and DM scope into a colon-delimited string.
 */
import {parseAgentSessionKey} from '../sessions/session-key-utils.js';

export {
  isAcpSessionKey,
  isSubagentSessionKey,
  parseAgentSessionKey
} from '../sessions/session-key-utils.js';

export const DEFAULT_AGENT_ID = 'main';
export const DEFAULT_MAIN_KEY = 'main';
export const DEFAULT_ACCOUNT_ID = 'default';

// Pre-compiled regex
const VALID_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const INVALID_CHARS_RE = /[^a-z0-9_-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;

/**
 * @param {string | undefined | null} value
 * @returns {string}
 */
function normalizeToken(value) {
  return (value ?? '').trim().toLowerCase();
}

/**
 * @param {string | undefined | null} value
 * @returns {string}
 */
export function normalizeMainKey(value) {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed.toLowerCase() : DEFAULT_MAIN_KEY;
}

/**
 * Extracts the request-facing portion of a store session key.
 * @param {string | undefined | null} storeKey
 * @returns {string | undefined}
 */
export function toAgentRequestSessionKey(storeKey) {
  const raw = (storeKey ?? '').trim();
  if (!raw) {
    return undefined;
  }
  return parseAgentSessionKey(raw)?.rest ?? raw;
}

/**
 * Converts a request session key to a store session key prefixed with agent ID.
 * @param {object} params
 * @param {string} params.agentId
 * @param {string | undefined | null} params.requestKey
 * @param {string} [params.mainKey]
 * @returns {string}
 */
export function toAgentStoreSessionKey(params) {
  const raw = (params.requestKey ?? '').trim();
  if (!raw || raw === DEFAULT_MAIN_KEY) {
    return buildAgentMainSessionKey({
      agentId: params.agentId,
      mainKey: params.mainKey
    });
  }
  const lowered = raw.toLowerCase();
  if (lowered.startsWith('agent:')) {
    return lowered;
  }
  if (lowered.startsWith('subagent:')) {
    return `agent:${normalizeAgentId(params.agentId)}:${lowered}`;
  }
  return `agent:${normalizeAgentId(params.agentId)}:${lowered}`;
}

/**
 * Extracts the agent ID from a session key string.
 * @param {string | undefined | null} sessionKey
 * @returns {string}
 */
export function resolveAgentIdFromSessionKey(sessionKey) {
  const parsed = parseAgentSessionKey(sessionKey);
  return normalizeAgentId(parsed?.agentId ?? DEFAULT_AGENT_ID);
}

/**
 * Normalizes an agent ID to a path-safe, shell-friendly lowercase string.
 * @param {string | undefined | null} value
 * @returns {string}
 */
export function normalizeAgentId(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return DEFAULT_AGENT_ID;
  }
  // Keep it path-safe + shell-friendly.
  if (VALID_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  // Best-effort fallback: collapse invalid characters to "-"
  return (
    trimmed
      .toLowerCase()
      .replace(INVALID_CHARS_RE, '-')
      .replace(LEADING_DASH_RE, '')
      .replace(TRAILING_DASH_RE, '')
      .slice(0, 64) || DEFAULT_AGENT_ID
  );
}

/**
 * Sanitizes an agent ID (same logic as normalizeAgentId).
 * @param {string | undefined | null} value
 * @returns {string}
 */
export function sanitizeAgentId(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return DEFAULT_AGENT_ID;
  }
  if (VALID_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return (
    trimmed
      .toLowerCase()
      .replace(INVALID_CHARS_RE, '-')
      .replace(LEADING_DASH_RE, '')
      .replace(TRAILING_DASH_RE, '')
      .slice(0, 64) || DEFAULT_AGENT_ID
  );
}

/**
 * Normalizes an account ID to a path-safe lowercase string.
 * @param {string | undefined | null} value
 * @returns {string}
 */
export function normalizeAccountId(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return DEFAULT_ACCOUNT_ID;
  }
  if (VALID_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return (
    trimmed
      .toLowerCase()
      .replace(INVALID_CHARS_RE, '-')
      .replace(LEADING_DASH_RE, '')
      .replace(TRAILING_DASH_RE, '')
      .slice(0, 64) || DEFAULT_ACCOUNT_ID
  );
}

/**
 * Builds the main session key for an agent.
 * @param {object} params
 * @param {string} params.agentId
 * @param {string} [params.mainKey]
 * @returns {string}
 */
export function buildAgentMainSessionKey(params) {
  const agentId = normalizeAgentId(params.agentId);
  const mainKey = normalizeMainKey(params.mainKey);
  return `agent:${agentId}:${mainKey}`;
}

/**
 * Builds a peer-aware session key for an agent, factoring in DM scope
 * and identity links for cross-channel session collapse.
 * @param {object} params
 * @param {string} params.agentId
 * @param {string} [params.mainKey]
 * @param {string} params.channel
 * @param {string | null} [params.accountId]
 * @param {string | null} [params.peerKind]
 * @param {string | null} [params.peerId]
 * @param {{[key: string]: string[]}} [params.identityLinks]
 * @param {string} [params.dmScope] - DM session scope
 * @returns {string}
 */
export function buildAgentPeerSessionKey(params) {
  const peerKind = params.peerKind ?? 'dm';
  if (peerKind === 'dm') {
    const dmScope = params.dmScope ?? 'main';
    let peerId = (params.peerId ?? '').trim();
    const linkedPeerId =
      dmScope === 'main' ?
        null :
        resolveLinkedPeerId({
          identityLinks: params.identityLinks,
          channel: params.channel,
          peerId
        });
    if (linkedPeerId) {
      peerId = linkedPeerId;
    }
    peerId = peerId.toLowerCase();
    if (dmScope === 'per-account-channel-peer' && peerId) {
      const channel =
        (params.channel ?? '').trim().toLowerCase() || 'unknown';
      const accountId = normalizeAccountId(params.accountId);
      return `agent:${normalizeAgentId(params.agentId)}:${channel}:${accountId}:dm:${peerId}`;
    }
    if (dmScope === 'per-channel-peer' && peerId) {
      const channel =
        (params.channel ?? '').trim().toLowerCase() || 'unknown';
      return `agent:${normalizeAgentId(params.agentId)}:${channel}:dm:${peerId}`;
    }
    if (dmScope === 'per-peer' && peerId) {
      return `agent:${normalizeAgentId(params.agentId)}:dm:${peerId}`;
    }
    return buildAgentMainSessionKey({
      agentId: params.agentId,
      mainKey: params.mainKey
    });
  }
  const channel =
    (params.channel ?? '').trim().toLowerCase() || 'unknown';
  const peerId =
    ((params.peerId ?? '').trim() || 'unknown').toLowerCase();
  return `agent:${normalizeAgentId(params.agentId)}:${channel}:${peerKind}:${peerId}`;
}

/**
 * Resolves a linked peer ID from identity links configuration.
 * @param {object} params
 * @param {{[key: string]: string[]}} [params.identityLinks]
 * @param {string} params.channel
 * @param {string} params.peerId
 * @returns {string | null}
 */
function resolveLinkedPeerId(params) {
  const identityLinks = params.identityLinks;
  if (!identityLinks) {
    return null;
  }
  const peerId = params.peerId.trim();
  if (!peerId) {
    return null;
  }
  const candidates = new Set();
  const rawCandidate = normalizeToken(peerId);
  if (rawCandidate) {
    candidates.add(rawCandidate);
  }
  const channel = normalizeToken(params.channel);
  if (channel) {
    const scopedCandidate = normalizeToken(`${channel}:${peerId}`);
    if (scopedCandidate) {
      candidates.add(scopedCandidate);
    }
  }
  if (candidates.size === 0) {
    return null;
  }
  for (const [canonical, ids] of Object.entries(identityLinks)) {
    const canonicalName = canonical.trim();
    if (!canonicalName) {
      continue;
    }
    if (!Array.isArray(ids)) {
      continue;
    }
    for (const id of ids) {
      const normalized = normalizeToken(id);
      if (normalized && candidates.has(normalized)) {
        return canonicalName;
      }
    }
  }
  return null;
}

/**
 * Builds a group history key for channel/account/peer combination.
 * @param {object} params
 * @param {string} params.channel
 * @param {string | null} [params.accountId]
 * @param {'group' | 'channel'} params.peerKind
 * @param {string} params.peerId
 * @returns {string}
 */
export function buildGroupHistoryKey(params) {
  const channel = normalizeToken(params.channel) || 'unknown';
  const accountId = normalizeAccountId(params.accountId);
  const peerId = params.peerId.trim().toLowerCase() || 'unknown';
  return `${channel}:${accountId}:${params.peerKind}:${peerId}`;
}

/**
 * Resolves session keys for threaded conversations.
 * @param {object} params
 * @param {string} params.baseSessionKey
 * @param {string | null} [params.threadId]
 * @param {string} [params.parentSessionKey]
 * @param {boolean} [params.useSuffix]
 * @returns {{ sessionKey: string, parentSessionKey?: string }}
 */
export function resolveThreadSessionKeys(params) {
  const threadId = (params.threadId ?? '').trim();
  if (!threadId) {
    return {sessionKey: params.baseSessionKey, parentSessionKey: undefined};
  }
  const normalizedThreadId = threadId.toLowerCase();
  const useSuffix = params.useSuffix ?? true;
  const sessionKey = useSuffix ?
    `${params.baseSessionKey}:thread:${normalizedThreadId}` :
    params.baseSessionKey;
  return {sessionKey, parentSessionKey: params.parentSessionKey};
}
