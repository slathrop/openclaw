/**
 * Runtime logic for context pruning extension.
 * @module agents/pi-extensions/context-pruning/runtime
 */
const REGISTRY = /* @__PURE__ */ new WeakMap();
function setContextPruningRuntime(sessionManager, value) {
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
function getContextPruningRuntime(sessionManager) {
  if (!sessionManager || typeof sessionManager !== 'object') {
    return null;
  }
  return REGISTRY.get(sessionManager) ?? null;
}
export {
  getContextPruningRuntime,
  setContextPruningRuntime
};
