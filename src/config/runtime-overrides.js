/**
 * Runtime config overrides for ephemeral /debug-style config changes.
 *
 * Stores in-memory overrides that are deep-merged on top of the loaded
 * config. Supports set, unset, and reset operations via dot-notation paths.
 */
import { parseConfigPath, setConfigValueAtPath, unsetConfigValueAtPath } from './config-paths.js';

let overrides = {};

/**
 * @param {unknown} base
 * @param {unknown} override
 * @returns {unknown}
 */
function mergeOverrides(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override;
  }
  const next = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) {
      continue;
    }
    next[key] = mergeOverrides(base[key], value);
  }
  return next;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Returns the current override tree.
 * @returns {Record<string, unknown>}
 */
export function getConfigOverrides() {
  return overrides;
}

/**
 * Clears all runtime overrides.
 */
export function resetConfigOverrides() {
  overrides = {};
}

/**
 * Sets a runtime override at a dot-notation path.
 * @param {string} pathRaw
 * @param {unknown} value
 * @returns {{ ok: boolean, error?: string }}
 */
export function setConfigOverride(
  pathRaw,
  value
) {
  const parsed = parseConfigPath(pathRaw);
  if (!parsed.ok || !parsed.path) {
    return { ok: false, error: parsed.error ?? 'Invalid path.' };
  }
  setConfigValueAtPath(overrides, parsed.path, value);
  return { ok: true };
}

/**
 * Removes a runtime override at a dot-notation path.
 * @param {string} pathRaw
 * @returns {{ ok: boolean, removed: boolean, error?: string }}
 */
export function unsetConfigOverride(pathRaw) {
  const parsed = parseConfigPath(pathRaw);
  if (!parsed.ok || !parsed.path) {
    return {
      ok: false,
      removed: false,
      error: parsed.error ?? 'Invalid path.'
    };
  }
  const removed = unsetConfigValueAtPath(overrides, parsed.path);
  return { ok: true, removed };
}

/**
 * Applies runtime overrides on top of a loaded config.
 * @param {import("./types.js").OpenClawConfig} cfg
 * @returns {import("./types.js").OpenClawConfig}
 */
export function applyConfigOverrides(cfg) {
  if (!overrides || Object.keys(overrides).length === 0) {
    return cfg;
  }
  return mergeOverrides(cfg, overrides);
}
