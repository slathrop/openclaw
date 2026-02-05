/**
 * File path resolution for auth profile store and legacy auth files.
 * @module agents/auth-profiles/paths
 */
import fs from 'node:fs';
import path from 'node:path';
import { saveJsonFile } from '../../infra/json-file.js';
import { resolveUserPath } from '../../utils.js';
import { resolveOpenClawAgentDir } from '../agent-paths.js';
import { AUTH_PROFILE_FILENAME, AUTH_STORE_VERSION, LEGACY_AUTH_FILENAME } from './constants.js';
function resolveAuthStorePath(agentDir) {
  const resolved = resolveUserPath(agentDir ?? resolveOpenClawAgentDir());
  return path.join(resolved, AUTH_PROFILE_FILENAME);
}
function resolveLegacyAuthStorePath(agentDir) {
  const resolved = resolveUserPath(agentDir ?? resolveOpenClawAgentDir());
  return path.join(resolved, LEGACY_AUTH_FILENAME);
}
function resolveAuthStorePathForDisplay(agentDir) {
  const pathname = resolveAuthStorePath(agentDir);
  return pathname.startsWith('~') ? pathname : resolveUserPath(pathname);
}
function ensureAuthStoreFile(pathname) {
  if (fs.existsSync(pathname)) {
    return;
  }
  const payload = {
    version: AUTH_STORE_VERSION,
    profiles: {}
  };
  saveJsonFile(pathname, payload);
}
export {
  ensureAuthStoreFile,
  resolveAuthStorePath,
  resolveAuthStorePathForDisplay,
  resolveLegacyAuthStorePath
};
