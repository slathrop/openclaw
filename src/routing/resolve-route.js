/**
 * @module routing/resolve-route
 * Message routing logic.
 *
 * Resolves which agent handles an incoming message by evaluating channel
 * bindings in priority order: peer > parent peer > guild > team > account >
 * channel wildcard > default. Builds session keys for persistence.
 */
import {resolveDefaultAgentId} from '../agents/agent-scope.js';
import {listBindings} from './bindings.js';
import {
  buildAgentMainSessionKey,
  buildAgentPeerSessionKey,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_MAIN_KEY,
  normalizeAgentId,
  sanitizeAgentId
} from './session-key.js';

/**
 * @typedef {object} RoutePeer
 * @property {'dm' | 'group' | 'channel'} kind
 * @property {string} id
 */

/**
 * @typedef {object} ResolveAgentRouteInput
 * @property {object} cfg - OpenClaw configuration
 * @property {string} channel
 * @property {string | null} [accountId]
 * @property {RoutePeer | null} [peer]
 * @property {RoutePeer | null} [parentPeer] - Parent peer for threads
 * @property {string | null} [guildId]
 * @property {string | null} [teamId]
 */

/**
 * @typedef {object} ResolvedAgentRoute
 * @property {string} agentId
 * @property {string} channel
 * @property {string} accountId
 * @property {string} sessionKey - Internal session key for persistence + concurrency
 * @property {string} mainSessionKey - Convenience alias for direct-chat collapse
 * @property {string} matchedBy - Match description for debugging/logging
 */

export {DEFAULT_ACCOUNT_ID, DEFAULT_AGENT_ID} from './session-key.js';

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
function normalizeId(value) {
  return (value ?? '').trim();
}

/**
 * @param {string | undefined | null} value
 * @returns {string}
 */
function normalizeAccountId(value) {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : DEFAULT_ACCOUNT_ID;
}

/**
 * @param {string | undefined} match
 * @param {string} actual
 * @returns {boolean}
 */
function matchesAccountId(match, actual) {
  const trimmed = (match ?? '').trim();
  if (!trimmed) {
    return actual === DEFAULT_ACCOUNT_ID;
  }
  if (trimmed === '*') {
    return true;
  }
  return trimmed === actual;
}

/**
 * Builds a session key for an agent given routing parameters.
 * @param {object} params
 * @param {string} params.agentId
 * @param {string} params.channel
 * @param {string | null} [params.accountId]
 * @param {RoutePeer | null} [params.peer]
 * @param {string} [params.dmScope] - DM session scope
 * @param {{[key: string]: string[]}} [params.identityLinks]
 * @returns {string}
 */
export function buildAgentSessionKey(params) {
  const channel = normalizeToken(params.channel) || 'unknown';
  const peer = params.peer;
  return buildAgentPeerSessionKey({
    agentId: params.agentId,
    mainKey: DEFAULT_MAIN_KEY,
    channel,
    accountId: params.accountId,
    peerKind: peer?.kind ?? 'dm',
    peerId: peer ? normalizeId(peer.id) || 'unknown' : null,
    dmScope: params.dmScope,
    identityLinks: params.identityLinks
  });
}

/**
 * @param {object} cfg
 * @returns {Array<object>}
 */
function listAgents(cfg) {
  const agents = cfg.agents?.list;
  return Array.isArray(agents) ? agents : [];
}

/**
 * @param {object} cfg
 * @param {string} agentId
 * @returns {string}
 */
function pickFirstExistingAgentId(cfg, agentId) {
  const trimmed = (agentId ?? '').trim();
  if (!trimmed) {
    return sanitizeAgentId(resolveDefaultAgentId(cfg));
  }
  const normalized = normalizeAgentId(trimmed);
  const agents = listAgents(cfg);
  if (agents.length === 0) {
    return sanitizeAgentId(trimmed);
  }
  const match = agents.find(
    (agent) => normalizeAgentId(agent.id) === normalized
  );
  if (match?.id?.trim()) {
    return sanitizeAgentId(match.id.trim());
  }
  return sanitizeAgentId(resolveDefaultAgentId(cfg));
}

/**
 * @param {object | undefined} match
 * @param {string} channel
 * @returns {boolean}
 */
function matchesChannel(match, channel) {
  const key = normalizeToken(match?.channel);
  if (!key) {
    return false;
  }
  return key === channel;
}

/**
 * @param {object | undefined} match
 * @param {RoutePeer} peer
 * @returns {boolean}
 */
function matchesPeer(match, peer) {
  const m = match?.peer;
  if (!m) {
    return false;
  }
  const kind = normalizeToken(m.kind);
  const id = normalizeId(m.id);
  if (!kind || !id) {
    return false;
  }
  return kind === peer.kind && id === peer.id;
}

/**
 * @param {object | undefined} match
 * @param {string} guildId
 * @returns {boolean}
 */
function matchesGuild(match, guildId) {
  const id = normalizeId(match?.guildId);
  if (!id) {
    return false;
  }
  return id === guildId;
}

/**
 * @param {object | undefined} match
 * @param {string} teamId
 * @returns {boolean}
 */
function matchesTeam(match, teamId) {
  const id = normalizeId(match?.teamId);
  if (!id) {
    return false;
  }
  return id === teamId;
}

/**
 * Resolves which agent handles a message based on config bindings.
 * Priority: peer > parentPeer > guild > team > account > channel wildcard > default.
 * @param {ResolveAgentRouteInput} input
 * @returns {ResolvedAgentRoute}
 */
export function resolveAgentRoute(input) {
  const channel = normalizeToken(input.channel);
  const accountId = normalizeAccountId(input.accountId);
  const peer = input.peer ?
    {kind: input.peer.kind, id: normalizeId(input.peer.id)} :
    null;
  const guildId = normalizeId(input.guildId);
  const teamId = normalizeId(input.teamId);

  const bindings = listBindings(input.cfg).filter((binding) => {
    if (!binding || typeof binding !== 'object') {
      return false;
    }
    if (!matchesChannel(binding.match, channel)) {
      return false;
    }
    return matchesAccountId(binding.match?.accountId, accountId);
  });

  const dmScope = input.cfg.session?.dmScope ?? 'main';
  const identityLinks = input.cfg.session?.identityLinks;

  const choose = (agentId, matchedBy) => {
    const resolvedAgentId = pickFirstExistingAgentId(input.cfg, agentId);
    const sessionKey = buildAgentSessionKey({
      agentId: resolvedAgentId,
      channel,
      accountId,
      peer,
      dmScope,
      identityLinks
    }).toLowerCase();
    const mainSessionKey = buildAgentMainSessionKey({
      agentId: resolvedAgentId,
      mainKey: DEFAULT_MAIN_KEY
    }).toLowerCase();
    return {
      agentId: resolvedAgentId,
      channel,
      accountId,
      sessionKey,
      mainSessionKey,
      matchedBy
    };
  };

  if (peer) {
    const peerMatch = bindings.find((b) => matchesPeer(b.match, peer));
    if (peerMatch) {
      return choose(peerMatch.agentId, 'binding.peer');
    }
  }

  // Thread parent inheritance: if peer (thread) didn't match,
  // check parent peer binding
  const parentPeer = input.parentPeer ?
    {kind: input.parentPeer.kind, id: normalizeId(input.parentPeer.id)} :
    null;
  if (parentPeer && parentPeer.id) {
    const parentPeerMatch = bindings.find(
      (b) => matchesPeer(b.match, parentPeer)
    );
    if (parentPeerMatch) {
      return choose(parentPeerMatch.agentId, 'binding.peer.parent');
    }
  }

  if (guildId) {
    const guildMatch = bindings.find((b) => matchesGuild(b.match, guildId));
    if (guildMatch) {
      return choose(guildMatch.agentId, 'binding.guild');
    }
  }

  if (teamId) {
    const teamMatch = bindings.find((b) => matchesTeam(b.match, teamId));
    if (teamMatch) {
      return choose(teamMatch.agentId, 'binding.team');
    }
  }

  const accountMatch = bindings.find(
    (b) =>
      b.match?.accountId?.trim() !== '*' &&
      !b.match?.peer &&
      !b.match?.guildId &&
      !b.match?.teamId
  );
  if (accountMatch) {
    return choose(accountMatch.agentId, 'binding.account');
  }

  const anyAccountMatch = bindings.find(
    (b) =>
      b.match?.accountId?.trim() === '*' &&
      !b.match?.peer &&
      !b.match?.guildId &&
      !b.match?.teamId
  );
  if (anyAccountMatch) {
    return choose(anyAccountMatch.agentId, 'binding.channel');
  }

  return choose(resolveDefaultAgentId(input.cfg), 'default');
}
