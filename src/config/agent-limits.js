/**
 * @module agent-limits
 * Default concurrency limits for agents and subagents.
 */

export const DEFAULT_AGENT_MAX_CONCURRENT = 4;
export const DEFAULT_SUBAGENT_MAX_CONCURRENT = 8;

/**
 * Resolves the maximum concurrent agent count from config.
 * @param {import('./types.js').OpenClawConfig} [cfg]
 * @returns {number}
 */
export function resolveAgentMaxConcurrent(cfg) {
  const raw = cfg?.agents?.defaults?.maxConcurrent;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(1, Math.floor(raw));
  }
  return DEFAULT_AGENT_MAX_CONCURRENT;
}

/**
 * Resolves the maximum concurrent subagent count from config.
 * @param {import('./types.js').OpenClawConfig} [cfg]
 * @returns {number}
 */
export function resolveSubagentMaxConcurrent(cfg) {
  const raw = cfg?.agents?.defaults?.subagents?.maxConcurrent;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(1, Math.floor(raw));
  }
  return DEFAULT_SUBAGENT_MAX_CONCURRENT;
}
