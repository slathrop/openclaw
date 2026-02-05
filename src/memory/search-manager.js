/** @module memory/search-manager - Memory search manager factory with fallback support. */
import { createSubsystemLogger } from '../logging/subsystem.js';
import { resolveMemoryBackendConfig } from './backend-config.js';
const log = createSubsystemLogger('memory');
const QMD_MANAGER_CACHE = /* @__PURE__ */ new Map();
async function getMemorySearchManager(params) {
  const resolved = resolveMemoryBackendConfig(params);
  if (resolved.backend === 'qmd' && resolved.qmd) {
    const cacheKey = buildQmdCacheKey(params.agentId, resolved.qmd);
    const cached = QMD_MANAGER_CACHE.get(cacheKey);
    if (cached) {
      return { manager: cached };
    }
    try {
      const { QmdMemoryManager } = await import('./qmd-manager.js');
      const primary = await QmdMemoryManager.create({
        cfg: params.cfg,
        agentId: params.agentId,
        resolved
      });
      if (primary) {
        const wrapper = new FallbackMemoryManager(
          {
            primary,
            fallbackFactory: async () => {
              const { MemoryIndexManager } = await import('./manager.js');
              return await MemoryIndexManager.get(params);
            }
          },
          () => QMD_MANAGER_CACHE.delete(cacheKey)
        );
        QMD_MANAGER_CACHE.set(cacheKey, wrapper);
        return { manager: wrapper };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn(`qmd memory unavailable; falling back to builtin: ${message}`);
    }
  }
  try {
    const { MemoryIndexManager } = await import('./manager.js');
    const manager = await MemoryIndexManager.get(params);
    return { manager };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { manager: null, error: message };
  }
}
/**
 * @implements {MemorySearchManager}
 */
class FallbackMemoryManager {
  constructor(deps, onClose) {
    this._deps = deps;
    this._onClose = onClose;
  }
  _fallback = null;
  _primaryFailed = false;
  _lastError;
  async search(query, opts) {
    if (!this._primaryFailed) {
      try {
        return await this._deps.primary.search(query, opts);
      } catch (err) {
        this._primaryFailed = true;
        this._lastError = err instanceof Error ? err.message : String(err);
        log.warn(`qmd memory failed; switching to builtin index: ${this._lastError}`);
        await this._deps.primary.close?.().catch(() => {
        });
      }
    }
    const fallback = await this._ensureFallback();
    if (fallback) {
      return await fallback.search(query, opts);
    }
    throw new Error(this._lastError ?? 'memory search unavailable');
  }
  async readFile(params) {
    if (!this._primaryFailed) {
      return await this._deps.primary.readFile(params);
    }
    const fallback = await this._ensureFallback();
    if (fallback) {
      return await fallback.readFile(params);
    }
    throw new Error(this._lastError ?? 'memory read unavailable');
  }
  status() {
    if (!this._primaryFailed) {
      return this._deps.primary.status();
    }
    const fallbackStatus = this._fallback?.status();
    const fallbackInfo = { from: 'qmd', reason: this._lastError ?? 'unknown' };
    if (fallbackStatus) {
      const custom2 = fallbackStatus.custom ?? {};
      return {
        ...fallbackStatus,
        fallback: fallbackInfo,
        custom: {
          ...custom2,
          fallback: { disabled: true, reason: this._lastError ?? 'unknown' }
        }
      };
    }
    const primaryStatus = this._deps.primary.status();
    const custom = primaryStatus.custom ?? {};
    return {
      ...primaryStatus,
      fallback: fallbackInfo,
      custom: {
        ...custom,
        fallback: { disabled: true, reason: this._lastError ?? 'unknown' }
      }
    };
  }
  async sync(params) {
    if (!this._primaryFailed) {
      await this._deps.primary.sync?.(params);
      return;
    }
    const fallback = await this._ensureFallback();
    await fallback?.sync?.(params);
  }
  async probeEmbeddingAvailability() {
    if (!this._primaryFailed) {
      return await this._deps.primary.probeEmbeddingAvailability();
    }
    const fallback = await this._ensureFallback();
    if (fallback) {
      return await fallback.probeEmbeddingAvailability();
    }
    return { ok: false, error: this._lastError ?? 'memory embeddings unavailable' };
  }
  async probeVectorAvailability() {
    if (!this._primaryFailed) {
      return await this._deps.primary.probeVectorAvailability();
    }
    const fallback = await this._ensureFallback();
    return await fallback?.probeVectorAvailability() ?? false;
  }
  async close() {
    await this._deps.primary.close?.();
    await this._fallback?.close?.();
    this._onClose?.();
  }
  async _ensureFallback() {
    if (this._fallback) {
      return this._fallback;
    }
    const fallback = await this._deps.fallbackFactory();
    if (!fallback) {
      log.warn('memory fallback requested but builtin index is unavailable');
      return null;
    }
    this._fallback = fallback;
    return this._fallback;
  }
}
function buildQmdCacheKey(agentId, config) {
  return `${agentId}:${stableSerialize(config)}`;
}
function stableSerialize(value) {
  return JSON.stringify(sortValue(value));
}
function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }
  if (value && typeof value === 'object') {
    const sortedEntries = Object.keys(value).toSorted((a, b) => a.localeCompare(b)).map((key) => [key, sortValue(value[key])]);
    return Object.fromEntries(sortedEntries);
  }
  return value;
}
export {
  getMemorySearchManager
};
