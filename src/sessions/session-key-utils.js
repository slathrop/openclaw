/**
 * Session key parsing and classification utilities.
 *
 * Parses structured session keys (agent:id:rest format), detects
 * subagent and ACP session keys, and resolves thread parent keys
 * from thread/topic markers.
 * @typedef {object} ParsedAgentSessionKey
 * @property {string} agentId
 * @property {string} rest
 */

/**
 * @param {string | undefined | null} sessionKey
 * @returns {ParsedAgentSessionKey | null}
 */
export const parseAgentSessionKey = (sessionKey) => {
  const raw = (sessionKey ?? '').trim();
  if (!raw) {
    return null;
  }
  const parts = raw.split(':').filter(Boolean);
  if (parts.length < 3) {
    return null;
  }
  if (parts[0] !== 'agent') {
    return null;
  }
  const agentId = parts[1]?.trim();
  const rest = parts.slice(2).join(':');
  if (!agentId || !rest) {
    return null;
  }
  return { agentId, rest };
};

/**
 * @param {string | undefined | null} sessionKey
 * @returns {boolean}
 */
export const isSubagentSessionKey = (sessionKey) => {
  const raw = (sessionKey ?? '').trim();
  if (!raw) {
    return false;
  }
  if (raw.toLowerCase().startsWith('subagent:')) {
    return true;
  }
  const parsed = parseAgentSessionKey(raw);
  return Boolean((parsed?.rest ?? '').toLowerCase().startsWith('subagent:'));
};

/**
 * @param {string | undefined | null} sessionKey
 * @returns {boolean}
 */
export const isAcpSessionKey = (sessionKey) => {
  const raw = (sessionKey ?? '').trim();
  if (!raw) {
    return false;
  }
  const normalized = raw.toLowerCase();
  if (normalized.startsWith('acp:')) {
    return true;
  }
  const parsed = parseAgentSessionKey(raw);
  return Boolean((parsed?.rest ?? '').toLowerCase().startsWith('acp:'));
};

const THREAD_SESSION_MARKERS = [':thread:', ':topic:'];

/**
 * @param {string | undefined | null} sessionKey
 * @returns {string | null}
 */
export const resolveThreadParentSessionKey = (sessionKey) => {
  const raw = (sessionKey ?? '').trim();
  if (!raw) {
    return null;
  }
  const normalized = raw.toLowerCase();
  let idx = -1;
  for (const marker of THREAD_SESSION_MARKERS) {
    const candidate = normalized.lastIndexOf(marker);
    if (candidate > idx) {
      idx = candidate;
    }
  }
  if (idx <= 0) {
    return null;
  }
  const parent = raw.slice(0, idx).trim();
  return parent ? parent : null;
};
