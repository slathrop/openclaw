/**
 * @module sessions/main-session
 * Main session key resolution and canonicalization for agents.
 */
import {
  buildAgentMainSessionKey,
  DEFAULT_AGENT_ID,
  normalizeAgentId,
  normalizeMainKey,
  resolveAgentIdFromSessionKey
} from '../../routing/session-key.js';
import {loadConfig} from '../config.js';

/**
 * Resolves the main session key based on config scope and agents list.
 * @param {{ session?: { scope?: string, mainKey?: string }, agents?: { list?: Array<{ id?: string, default?: boolean }> } }} [cfg]
 * @returns {string}
 */
export function resolveMainSessionKey(cfg) {
  if (cfg?.session?.scope === 'global') {
    return 'global';
  }
  const agents = cfg?.agents?.list ?? [];
  const defaultAgentId =
    agents.find((agent) => agent?.default)?.id ?? agents[0]?.id ?? DEFAULT_AGENT_ID;
  const agentId = normalizeAgentId(defaultAgentId);
  const mainKey = normalizeMainKey(cfg?.session?.mainKey);
  return buildAgentMainSessionKey({agentId, mainKey});
}

/**
 * @returns {string}
 */
export function resolveMainSessionKeyFromConfig() {
  return resolveMainSessionKey(loadConfig());
}

export {resolveAgentIdFromSessionKey};

/**
 * Resolves the main session key for a specific agent.
 * @param {{ cfg?: { session?: { mainKey?: string } }, agentId: string }} params
 * @returns {string}
 */
export function resolveAgentMainSessionKey(params) {
  const mainKey = normalizeMainKey(params.cfg?.session?.mainKey);
  return buildAgentMainSessionKey({agentId: params.agentId, mainKey});
}

/**
 * @param {{ cfg?: { session?: { scope?: string, mainKey?: string } }, agentId?: string | null }} params
 * @returns {string | undefined}
 */
export function resolveExplicitAgentSessionKey(params) {
  const agentId = params.agentId?.trim();
  if (!agentId) {
    return undefined;
  }
  return resolveAgentMainSessionKey({cfg: params.cfg, agentId});
}

/**
 * Canonicalizes session key aliases (e.g., "main" -> full agent:id:main key).
 * @param {{ cfg?: { session?: { scope?: string, mainKey?: string } }, agentId: string, sessionKey: string }} params
 * @returns {string}
 */
export function canonicalizeMainSessionAlias(params) {
  const raw = params.sessionKey.trim();
  if (!raw) {
    return raw;
  }

  const agentId = normalizeAgentId(params.agentId);
  const mainKey = normalizeMainKey(params.cfg?.session?.mainKey);
  const agentMainSessionKey = buildAgentMainSessionKey({agentId, mainKey});
  const agentMainAliasKey = buildAgentMainSessionKey({
    agentId,
    mainKey: 'main'
  });

  const isMainAlias =
    raw === 'main' || raw === mainKey || raw === agentMainSessionKey || raw === agentMainAliasKey;

  if (params.cfg?.session?.scope === 'global' && isMainAlias) {
    return 'global';
  }
  if (isMainAlias) {
    return agentMainSessionKey;
  }
  return raw;
}
