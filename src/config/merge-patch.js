/**
 * RFC 7396 JSON Merge Patch implementation for config objects.
 *
 * Applies a merge patch to a base value: null removes keys,
 * objects merge recursively, primitives replace.
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Applies an RFC 7396 merge patch to a base value.
 * @param {unknown} base
 * @param {unknown} patch
 * @returns {unknown}
 */
export function applyMergePatch(base, patch) {
  if (!isPlainObject(patch)) {
    return patch;
  }

  const result = isPlainObject(base) ? { ...base } : {};

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key];
      continue;
    }
    if (isPlainObject(value)) {
      const baseValue = result[key];
      result[key] = applyMergePatch(isPlainObject(baseValue) ? baseValue : {}, value);
      continue;
    }
    result[key] = value;
  }

  return result;
}
