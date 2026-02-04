/**
 * @module agent-dirs
 * Agent directory resolution and duplicate detection for multi-agent configs.
 */
import os from 'node:os';
import path from 'node:path';
import {DEFAULT_AGENT_ID, normalizeAgentId} from '../routing/session-key.js';
import {resolveUserPath} from '../utils.js';
import {resolveStateDir} from './paths.js';

/**
 * @typedef {{ agentDir: string, agentIds: string[] }} DuplicateAgentDir
 */

export class DuplicateAgentDirError extends Error {
  /**
   * @param {DuplicateAgentDir[]} duplicates
   */
  constructor(duplicates) {
    super(formatDuplicateAgentDirError(duplicates));
    this.name = 'DuplicateAgentDirError';
    this.duplicates = duplicates;
  }
}

/**
 * @param {string} agentDir
 * @returns {string}
 */
function canonicalizeAgentDir(agentDir) {
  const resolved = path.resolve(agentDir);
  if (process.platform === 'darwin' || process.platform === 'win32') {
    return resolved.toLowerCase();
  }
  return resolved;
}

/**
 * Collects all agent IDs referenced in the config (agents list + bindings).
 * @param {import('./types.js').OpenClawConfig} cfg
 * @returns {string[]}
 */
function collectReferencedAgentIds(cfg) {
  const ids = new Set();

  const agents = Array.isArray(cfg.agents?.list) ? cfg.agents?.list : [];
  const defaultAgentId =
    agents.find((agent) => agent?.default)?.id ?? agents[0]?.id ?? DEFAULT_AGENT_ID;
  ids.add(normalizeAgentId(defaultAgentId));

  for (const entry of agents) {
    if (entry?.id) {
      ids.add(normalizeAgentId(entry.id));
    }
  }

  const bindings = cfg.bindings;
  if (Array.isArray(bindings)) {
    for (const binding of bindings) {
      const id = binding?.agentId;
      if (typeof id === 'string' && id.trim()) {
        ids.add(normalizeAgentId(id));
      }
    }
  }

  return [...ids];
}

/**
 * @param {import('./types.js').OpenClawConfig} cfg
 * @param {string} agentId
 * @param {{ env?: NodeJS.ProcessEnv, homedir?: () => string }} [deps]
 * @returns {string}
 */
function resolveEffectiveAgentDir(cfg, agentId, deps) {
  const id = normalizeAgentId(agentId);
  const configured = Array.isArray(cfg.agents?.list)
    ? cfg.agents?.list.find((agent) => normalizeAgentId(agent.id) === id)?.agentDir
    : undefined;
  const trimmed = configured?.trim();
  if (trimmed) {
    return resolveUserPath(trimmed);
  }
  const root = resolveStateDir(deps?.env ?? process.env, deps?.homedir ?? os.homedir);
  return path.join(root, 'agents', id, 'agent');
}

/**
 * Finds agent IDs sharing the same resolved directory.
 * @param {import('./types.js').OpenClawConfig} cfg
 * @param {{ env?: NodeJS.ProcessEnv, homedir?: () => string }} [deps]
 * @returns {DuplicateAgentDir[]}
 */
export function findDuplicateAgentDirs(cfg, deps) {
  const byDir = new Map();

  for (const agentId of collectReferencedAgentIds(cfg)) {
    const agentDir = resolveEffectiveAgentDir(cfg, agentId, deps);
    const key = canonicalizeAgentDir(agentDir);
    const entry = byDir.get(key);
    if (entry) {
      entry.agentIds.push(agentId);
    } else {
      byDir.set(key, {agentDir, agentIds: [agentId]});
    }
  }

  return [...byDir.values()].filter((v) => v.agentIds.length > 1);
}

/**
 * Formats a human-readable error message for duplicate agent directories.
 * @param {DuplicateAgentDir[]} dups
 * @returns {string}
 */
export function formatDuplicateAgentDirError(dups) {
  const lines = [
    'Duplicate agentDir detected (multi-agent config).',
    'Each agent must have a unique agentDir; sharing it causes auth/session state collisions and token invalidation.',
    '',
    'Conflicts:',
    ...dups.map((d) => `- ${d.agentDir}: ${d.agentIds.map((id) => `"${id}"`).join(', ')}`),
    '',
    'Fix: remove the shared agents.list[].agentDir override (or give each agent its own directory).',
    'If you want to share credentials, copy auth-profiles.json instead of sharing the entire agentDir.'
  ];
  return lines.join('\n');
}
