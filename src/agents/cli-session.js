/**
 * @module cli-session
 * CLI session management and persistence.
 */
import { normalizeProviderId } from './model-selection.js';
function getCliSessionId(entry, provider) {
  if (!entry) {
    return void 0;
  }
  const normalized = normalizeProviderId(provider);
  const fromMap = entry.cliSessionIds?.[normalized];
  if (fromMap?.trim()) {
    return fromMap.trim();
  }
  if (normalized === 'claude-cli') {
    const legacy = entry.claudeCliSessionId?.trim();
    if (legacy) {
      return legacy;
    }
  }
  return void 0;
}
function setCliSessionId(entry, provider, sessionId) {
  const normalized = normalizeProviderId(provider);
  const trimmed = sessionId.trim();
  if (!trimmed) {
    return;
  }
  const existing = entry.cliSessionIds ?? {};
  entry.cliSessionIds = { ...existing };
  entry.cliSessionIds[normalized] = trimmed;
  if (normalized === 'claude-cli') {
    entry.claudeCliSessionId = trimmed;
  }
}
export {
  getCliSessionId,
  setCliSessionId
};
