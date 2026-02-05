/**
 * Configuration hashing for sandbox cache invalidation.
 * @module agents/sandbox/config-hash
 */
import crypto from 'node:crypto';
function isPrimitive(value) {
  return value === null || typeof value !== 'object' && typeof value !== 'function';
}
function normalizeForHash(value) {
  if (value === void 0) {
    return void 0;
  }
  if (Array.isArray(value)) {
    const normalized = value.map(normalizeForHash).filter((item) => item !== void 0);
    const primitives = normalized.filter(isPrimitive);
    if (primitives.length === normalized.length) {
      return [...primitives].toSorted(
        (a, b) => primitiveToString(a).localeCompare(primitiveToString(b))
      );
    }
    return normalized;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).toSorted(([a], [b]) => a.localeCompare(b));
    const normalized = {};
    for (const [key, entryValue] of entries) {
      const next = normalizeForHash(entryValue);
      if (next !== void 0) {
        normalized[key] = next;
      }
    }
    return normalized;
  }
  return value;
}
function primitiveToString(value) {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return JSON.stringify(value);
}
function computeSandboxConfigHash(input) {
  const payload = normalizeForHash(input);
  const raw = JSON.stringify(payload);
  return crypto.createHash('sha1').update(raw).digest('hex');
}
export {
  computeSandboxConfigHash
};
