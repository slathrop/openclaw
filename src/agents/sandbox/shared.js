/**
 * Shared utilities for sandbox modules.
 * @module agents/sandbox/shared
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { normalizeAgentId } from '../../routing/session-key.js';
import { resolveUserPath } from '../../utils.js';
import { resolveAgentIdFromSessionKey } from '../agent-scope.js';
function slugifySessionKey(value) {
  const trimmed = value.trim() || 'session';
  const hash = crypto.createHash('sha1').update(trimmed).digest('hex').slice(0, 8);
  const safe = trimmed.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  const base = safe.slice(0, 32) || 'session';
  return `${base}-${hash}`;
}
function resolveSandboxWorkspaceDir(root, sessionKey) {
  const resolvedRoot = resolveUserPath(root);
  const slug = slugifySessionKey(sessionKey);
  return path.join(resolvedRoot, slug);
}
function resolveSandboxScopeKey(scope, sessionKey) {
  const trimmed = sessionKey.trim() || 'main';
  if (scope === 'shared') {
    return 'shared';
  }
  if (scope === 'session') {
    return trimmed;
  }
  const agentId = resolveAgentIdFromSessionKey(trimmed);
  return `agent:${agentId}`;
}
function resolveSandboxAgentId(scopeKey) {
  const trimmed = scopeKey.trim();
  if (!trimmed || trimmed === 'shared') {
    return void 0;
  }
  const parts = trimmed.split(':').filter(Boolean);
  if (parts[0] === 'agent' && parts[1]) {
    return normalizeAgentId(parts[1]);
  }
  return resolveAgentIdFromSessionKey(trimmed);
}
export {
  resolveSandboxAgentId,
  resolveSandboxScopeKey,
  resolveSandboxWorkspaceDir,
  slugifySessionKey
};
