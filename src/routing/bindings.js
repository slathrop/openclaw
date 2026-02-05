/**
 * @module routing/bindings
 * Channel-to-agent binding resolution.
 *
 * Resolves which agent should handle a message based on channel bindings
 * configured in OpenClawConfig. Bindings map channel + account combinations
 * to specific agents, allowing multi-agent routing per channel.
 */
import {resolveDefaultAgentId} from '../agents/agent-scope.js';
import {normalizeChatChannelId} from '../channels/registry.js';
import {normalizeAccountId, normalizeAgentId} from './session-key.js';

/**
 * Normalizes a channel ID for binding comparison.
 * Falls back to lowercase trim if registry normalization fails.
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
function normalizeBindingChannelId(raw) {
  const normalized = normalizeChatChannelId(raw);
  if (normalized) {
    return normalized;
  }
  const fallback = (raw ?? '').trim().toLowerCase();
  return fallback || null;
}

/**
 * Returns the list of agent bindings from config.
 * @param {object} cfg - OpenClaw configuration
 * @returns {Array<object>}
 */
export function listBindings(cfg) {
  return Array.isArray(cfg.bindings) ? cfg.bindings : [];
}

/**
 * Lists all account IDs bound to a specific channel.
 * @param {object} cfg - OpenClaw configuration
 * @param {string} channelId
 * @returns {string[]}
 */
export function listBoundAccountIds(cfg, channelId) {
  const normalizedChannel = normalizeBindingChannelId(channelId);
  if (!normalizedChannel) {
    return [];
  }
  const ids = new Set();
  for (const binding of listBindings(cfg)) {
    if (!binding || typeof binding !== 'object') {
      continue;
    }
    const match = binding.match;
    if (!match || typeof match !== 'object') {
      continue;
    }
    const channel = normalizeBindingChannelId(match.channel);
    if (!channel || channel !== normalizedChannel) {
      continue;
    }
    const accountId = typeof match.accountId === 'string' ?
      match.accountId.trim() :
      '';
    if (!accountId || accountId === '*') {
      continue;
    }
    ids.add(normalizeAccountId(accountId));
  }
  return Array.from(ids).toSorted((a, b) => a.localeCompare(b));
}

/**
 * Resolves the default agent's bound account ID for a channel.
 * @param {object} cfg - OpenClaw configuration
 * @param {string} channelId
 * @returns {string | null}
 */
export function resolveDefaultAgentBoundAccountId(cfg, channelId) {
  const normalizedChannel = normalizeBindingChannelId(channelId);
  if (!normalizedChannel) {
    return null;
  }
  const defaultAgentId = normalizeAgentId(resolveDefaultAgentId(cfg));
  for (const binding of listBindings(cfg)) {
    if (!binding || typeof binding !== 'object') {
      continue;
    }
    if (normalizeAgentId(binding.agentId) !== defaultAgentId) {
      continue;
    }
    const match = binding.match;
    if (!match || typeof match !== 'object') {
      continue;
    }
    const channel = normalizeBindingChannelId(match.channel);
    if (!channel || channel !== normalizedChannel) {
      continue;
    }
    const accountId = typeof match.accountId === 'string' ?
      match.accountId.trim() :
      '';
    if (!accountId || accountId === '*') {
      continue;
    }
    return normalizeAccountId(accountId);
  }
  return null;
}

/**
 * Builds a map of channel -> agent -> account IDs from config bindings.
 * @param {object} cfg - OpenClaw configuration
 * @returns {Map<string, Map<string, string[]>>}
 */
export function buildChannelAccountBindings(cfg) {
  const map = new Map();
  for (const binding of listBindings(cfg)) {
    if (!binding || typeof binding !== 'object') {
      continue;
    }
    const match = binding.match;
    if (!match || typeof match !== 'object') {
      continue;
    }
    const channelId = normalizeBindingChannelId(match.channel);
    if (!channelId) {
      continue;
    }
    const accountId = typeof match.accountId === 'string' ?
      match.accountId.trim() :
      '';
    if (!accountId || accountId === '*') {
      continue;
    }
    const agentId = normalizeAgentId(binding.agentId);
    const byAgent = map.get(channelId) ?? new Map();
    const list = byAgent.get(agentId) ?? [];
    const normalizedAccountId = normalizeAccountId(accountId);
    if (!list.includes(normalizedAccountId)) {
      list.push(normalizedAccountId);
    }
    byAgent.set(agentId, list);
    map.set(channelId, byAgent);
  }
  return map;
}

/**
 * Picks the preferred account ID from bound accounts or falls back to default.
 * @param {object} params
 * @param {string[]} params.accountIds
 * @param {string} params.defaultAccountId
 * @param {string[]} params.boundAccounts
 * @returns {string}
 */
export function resolvePreferredAccountId(params) {
  if (params.boundAccounts.length > 0) {
    return params.boundAccounts[0];
  }
  return params.defaultAccountId;
}
