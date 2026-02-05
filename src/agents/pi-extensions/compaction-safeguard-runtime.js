/**
 * Runtime logic for compaction safeguard extension.
 * @module agents/pi-extensions/compaction-safeguard-runtime
 */
const REGISTRY = /* @__PURE__ */ new WeakMap();
function setCompactionSafeguardRuntime(sessionManager, value) {
  if (!sessionManager || typeof sessionManager !== 'object') {
    return;
  }
  const key = sessionManager;
  if (value === null) {
    REGISTRY.delete(key);
    return;
  }
  REGISTRY.set(key, value);
}
function getCompactionSafeguardRuntime(sessionManager) {
  if (!sessionManager || typeof sessionManager !== 'object') {
    return null;
  }
  return REGISTRY.get(sessionManager) ?? null;
}
export {
  getCompactionSafeguardRuntime,
  setCompactionSafeguardRuntime
};
