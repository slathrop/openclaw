/**
 * Session manager caching for Pi embedded runner.
 * @module agents/pi-embedded-runner/session-manager-cache
 */
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import { isCacheEnabled, resolveCacheTtlMs } from '../../config/cache-utils.js';
const SESSION_MANAGER_CACHE = /* @__PURE__ */ new Map();
const DEFAULT_SESSION_MANAGER_TTL_MS = 45e3;
function getSessionManagerTtl() {
  return resolveCacheTtlMs({
    envValue: process.env.OPENCLAW_SESSION_MANAGER_CACHE_TTL_MS,
    defaultTtlMs: DEFAULT_SESSION_MANAGER_TTL_MS
  });
}
function isSessionManagerCacheEnabled() {
  return isCacheEnabled(getSessionManagerTtl());
}
function trackSessionManagerAccess(sessionFile) {
  if (!isSessionManagerCacheEnabled()) {
    return;
  }
  const now = Date.now();
  SESSION_MANAGER_CACHE.set(sessionFile, {
    sessionFile,
    loadedAt: now
  });
}
function isSessionManagerCached(sessionFile) {
  if (!isSessionManagerCacheEnabled()) {
    return false;
  }
  const entry = SESSION_MANAGER_CACHE.get(sessionFile);
  if (!entry) {
    return false;
  }
  const now = Date.now();
  const ttl = getSessionManagerTtl();
  return now - entry.loadedAt <= ttl;
}
async function prewarmSessionFile(sessionFile) {
  if (!isSessionManagerCacheEnabled()) {
    return;
  }
  if (isSessionManagerCached(sessionFile)) {
    return;
  }
  try {
    const handle = await fs.open(sessionFile, 'r');
    try {
      const buffer = Buffer.alloc(4096);
      await handle.read(buffer, 0, buffer.length, 0);
    } finally {
      await handle.close();
    }
    trackSessionManagerAccess(sessionFile);
  } catch {
    // intentionally ignored
  }
}
export {
  prewarmSessionFile,
  trackSessionManagerAccess
};
