import { Buffer } from 'node:buffer';
function extractShortModelName(fullModel) {
  const slash = fullModel.lastIndexOf('/');
  const modelPart = slash >= 0 ? fullModel.slice(slash + 1) : fullModel;
  return modelPart.replace(/-\d{8}$/, '').replace(/-latest$/, '');
}
function formatInboundFromLabel(params) {
  if (params.isGroup) {
    const label = params.groupLabel?.trim() || params.groupFallback || 'Group';
    const id = params.groupId?.trim();
    return id ? `${label} id:${id}` : label;
  }
  const directLabel = params.directLabel.trim();
  const directId = params.directId?.trim();
  if (!directId || directId === directLabel) {
    return directLabel;
  }
  return `${directLabel} id:${directId}`;
}
function createDedupeCache(options) {
  const ttlMs = Math.max(0, options.ttlMs);
  const maxSize = Math.max(0, Math.floor(options.maxSize));
  const cache = /* @__PURE__ */ new Map();
  const touch = (key, now) => {
    cache.delete(key);
    cache.set(key, now);
  };
  const prune = (now) => {
    const cutoff = ttlMs > 0 ? now - ttlMs : void 0;
    if (cutoff !== void 0) {
      for (const [entryKey, entryTs] of cache) {
        if (entryTs < cutoff) {
          cache.delete(entryKey);
        }
      }
    }
    if (maxSize <= 0) {
      cache.clear();
      return;
    }
    while (cache.size > maxSize) {
      const oldestKey = cache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      cache.delete(oldestKey);
    }
  };
  return {
    check: (key, now = Date.now()) => {
      if (!key) {
        return false;
      }
      const existing = cache.get(key);
      if (existing !== void 0 && (ttlMs <= 0 || now - existing < ttlMs)) {
        touch(key, now);
        return true;
      }
      touch(key, now);
      prune(now);
      return false;
    }
  };
}
function rawDataToString(data, encoding = 'utf8') {
  if (typeof data === 'string') {
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return data.toString(encoding);
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString(encoding);
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString(encoding);
  }
  return Buffer.from(String(data)).toString(encoding);
}
function normalizeAgentId(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return 'main';
  }
  if (/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+/, '').replace(/-+$/, '').slice(0, 64) || 'main';
}
function listAgents(cfg) {
  const list = cfg.agents?.list;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter((entry) => Boolean(entry && typeof entry === 'object'));
}
function resolveAgentEntry(cfg, agentId) {
  const id = normalizeAgentId(agentId);
  return listAgents(cfg).find((entry) => normalizeAgentId(entry.id) === id);
}
function resolveIdentityName(cfg, agentId) {
  const entry = resolveAgentEntry(cfg, agentId);
  return entry?.identity?.name?.trim() || void 0;
}
function resolveThreadSessionKeys(params) {
  const threadId = (params.threadId ?? '').trim();
  if (!threadId) {
    return { sessionKey: params.baseSessionKey, parentSessionKey: void 0 };
  }
  const useSuffix = params.useSuffix ?? true;
  const sessionKey = useSuffix ? `${params.baseSessionKey}:thread:${threadId}` : params.baseSessionKey;
  return { sessionKey, parentSessionKey: params.parentSessionKey };
}
export {
  createDedupeCache,
  extractShortModelName,
  formatInboundFromLabel,
  rawDataToString,
  resolveIdentityName,
  resolveThreadSessionKeys
};
