/**
 * Dot-notation config path utilities for safe get/set/unset.
 *
 * Parses "foo.bar" style paths, guards against prototype pollution,
 * and traverses nested config objects for CLI config set/get/unset.
 */

const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Parses a dot-notation config path string into an array of segments.
 * @param {string} raw
 * @returns {{ ok: boolean, path?: string[], error?: string }}
 */
export function parseConfigPath(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: 'Invalid path. Use dot notation (e.g. foo.bar).'
    };
  }
  const parts = trimmed.split('.').map((part) => part.trim());
  if (parts.some((part) => !part)) {
    return {
      ok: false,
      error: 'Invalid path. Use dot notation (e.g. foo.bar).'
    };
  }
  if (parts.some((part) => BLOCKED_KEYS.has(part))) {
    return { ok: false, error: 'Invalid path segment.' };
  }
  return { ok: true, path: parts };
}

/**
 * Sets a value at a nested path in a config object, creating intermediates as needed.
 * @param {Record<string, unknown>} root
 * @param {string[]} path
 * @param {unknown} value
 */
export function setConfigValueAtPath(root, path, value) {
  let cursor = root;
  for (let idx = 0; idx < path.length - 1; idx += 1) {
    const key = path[idx];
    const next = cursor[key];
    if (!isPlainObject(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[path[path.length - 1]] = value;
}

/**
 * Removes a value at a nested path and prunes empty parent branches.
 * @param {Record<string, unknown>} root
 * @param {string[]} path
 * @returns {boolean} Whether the key was found and deleted.
 */
export function unsetConfigValueAtPath(root, path) {
  const stack = [];
  let cursor = root;
  for (let idx = 0; idx < path.length - 1; idx += 1) {
    const key = path[idx];
    const next = cursor[key];
    if (!isPlainObject(next)) {
      return false;
    }
    stack.push({ node: cursor, key });
    cursor = next;
  }
  const leafKey = path[path.length - 1];
  if (!(leafKey in cursor)) {
    return false;
  }
  delete cursor[leafKey];
  for (let idx = stack.length - 1; idx >= 0; idx -= 1) {
    const { node, key } = stack[idx];
    const child = node[key];
    if (isPlainObject(child) && Object.keys(child).length === 0) {
      delete node[key];
    } else {
      break;
    }
  }
  return true;
}

/**
 * Retrieves the value at a nested path in a config object.
 * @param {Record<string, unknown>} root
 * @param {string[]} path
 * @returns {unknown}
 */
export function getConfigValueAtPath(root, path) {
  let cursor = root;
  for (const key of path) {
    if (!isPlainObject(cursor)) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return cursor;
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
