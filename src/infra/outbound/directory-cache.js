/**
 * Directory entry caching for target resolution.
 * TTL-based cache that auto-invalidates when config changes.
 * @module
 */

function buildDirectoryCacheKey(key) {
  const signature = key.signature ?? 'default';
  return `${key.channel}:${key.accountId ?? 'default'}:${key.kind}:${key.source}:${signature}`;
}
class DirectoryCache {
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
  }
  cache = /* @__PURE__ */ new Map();
  lastConfigRef = null;
  get(key, cfg) {
    this.resetIfConfigChanged(cfg);
    const entry = this.cache.get(key);
    if (!entry) {
      return void 0;
    }
    if (Date.now() - entry.fetchedAt > this.ttlMs) {
      this.cache.delete(key);
      return void 0;
    }
    return entry.value;
  }
  set(key, value, cfg) {
    this.resetIfConfigChanged(cfg);
    this.cache.set(key, { value, fetchedAt: Date.now() });
  }
  clearMatching(match) {
    for (const key of this.cache.keys()) {
      if (match(key)) {
        this.cache.delete(key);
      }
    }
  }
  clear(cfg) {
    this.cache.clear();
    if (cfg) {
      this.lastConfigRef = cfg;
    }
  }
  resetIfConfigChanged(cfg) {
    if (this.lastConfigRef && this.lastConfigRef !== cfg) {
      this.cache.clear();
    }
    this.lastConfigRef = cfg;
  }
}
export {
  DirectoryCache,
  buildDirectoryCacheKey
};
