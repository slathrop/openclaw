/**
 * @module timeout
 * Agent session timeout resolution and configuration.
 */
const DEFAULT_AGENT_TIMEOUT_SECONDS = 600;
const normalizeNumber = (value) => typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : void 0;
function resolveAgentTimeoutSeconds(cfg) {
  const raw = normalizeNumber(cfg?.agents?.defaults?.timeoutSeconds);
  const seconds = raw ?? DEFAULT_AGENT_TIMEOUT_SECONDS;
  return Math.max(seconds, 1);
}
function resolveAgentTimeoutMs(opts) {
  const minMs = Math.max(normalizeNumber(opts.minMs) ?? 1, 1);
  const defaultMs = resolveAgentTimeoutSeconds(opts.cfg) * 1e3;
  const NO_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1e3;
  const overrideMs = normalizeNumber(opts.overrideMs);
  if (overrideMs !== void 0) {
    if (overrideMs === 0) {
      return NO_TIMEOUT_MS;
    }
    if (overrideMs < 0) {
      return defaultMs;
    }
    return Math.max(overrideMs, minMs);
  }
  const overrideSeconds = normalizeNumber(opts.overrideSeconds);
  if (overrideSeconds !== void 0) {
    if (overrideSeconds === 0) {
      return NO_TIMEOUT_MS;
    }
    if (overrideSeconds < 0) {
      return defaultMs;
    }
    return Math.max(overrideSeconds * 1e3, minMs);
  }
  return Math.max(defaultMs, minMs);
}
export {
  resolveAgentTimeoutMs,
  resolveAgentTimeoutSeconds
};
