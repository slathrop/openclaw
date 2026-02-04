/**
 * @module cache-utils
 * Shared cache TTL resolution and file mtime utilities.
 */
import fs from 'node:fs';

/**
 * Resolves cache TTL from an env value, falling back to a default.
 * @param {{ envValue: string | undefined, defaultTtlMs: number }} params
 * @returns {number}
 */
export function resolveCacheTtlMs(params) {
  const {envValue, defaultTtlMs} = params;
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return defaultTtlMs;
}

/**
 * @param {number} ttlMs
 * @returns {boolean}
 */
export function isCacheEnabled(ttlMs) {
  return ttlMs > 0;
}

/**
 * @param {string} filePath
 * @returns {number | undefined}
 */
export function getFileMtimeMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return undefined;
  }
}
