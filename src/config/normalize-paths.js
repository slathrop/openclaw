/**
 * Config path normalization.
 *
 * Expands "~" (home directory) in path-ish config fields. Only normalizes
 * fields whose keys match path-related patterns (dir, path, file, root,
 * workspace, paths, pathPrepend). Non-path fields are left untouched.
 */
import { resolveUserPath } from '../utils.js';

const PATH_VALUE_RE = /^~(?=$|[\\/])/;

const PATH_KEY_RE = /(dir|path|paths|file|root|workspace)$/i;
const PATH_LIST_KEYS = new Set(['paths', 'pathPrepend']);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {string | undefined} key
 * @param {string} value
 * @returns {string}
 */
function normalizeStringValue(key, value) {
  if (!PATH_VALUE_RE.test(value.trim())) {
    return value;
  }
  if (!key) {
    return value;
  }
  if (PATH_KEY_RE.test(key) || PATH_LIST_KEYS.has(key)) {
    return resolveUserPath(value);
  }
  return value;
}

/**
 * @param {string | undefined} key
 * @param {unknown} value
 * @returns {unknown}
 */
function normalizeAny(key, value) {
  if (typeof value === 'string') {
    return normalizeStringValue(key, value);
  }

  if (Array.isArray(value)) {
    const normalizeChildren = Boolean(key && PATH_LIST_KEYS.has(key));
    return value.map((entry) => {
      if (typeof entry === 'string') {
        return normalizeChildren ? normalizeStringValue(key, entry) : entry;
      }
      if (Array.isArray(entry)) {
        return normalizeAny(undefined, entry);
      }
      if (isPlainObject(entry)) {
        return normalizeAny(undefined, entry);
      }
      return entry;
    });
  }

  if (!isPlainObject(value)) {
    return value;
  }

  for (const [childKey, childValue] of Object.entries(value)) {
    const next = normalizeAny(childKey, childValue);
    if (next !== childValue) {
      value[childKey] = next;
    }
  }

  return value;
}

/**
 * Normalize "~" paths in path-ish config fields.
 *
 * Goal: accept `~/...` consistently across config file + env overrides, while
 * keeping the surface area small and predictable.
 * @param {import('./types.js').OpenClawConfig} cfg
 * @returns {import('./types.js').OpenClawConfig}
 */
export function normalizeConfigPaths(cfg) {
  if (!cfg || typeof cfg !== 'object') {
    return cfg;
  }
  normalizeAny(undefined, cfg);
  return cfg;
}
