const handlers = /* @__PURE__ */ new Map();
function registerInternalHook(eventKey, handler) {
  if (!handlers.has(eventKey)) {
    handlers.set(eventKey, []);
  }
  handlers.get(eventKey).push(handler);
}
function unregisterInternalHook(eventKey, handler) {
  const eventHandlers = handlers.get(eventKey);
  if (!eventHandlers) {
    return;
  }
  const index = eventHandlers.indexOf(handler);
  if (index !== -1) {
    eventHandlers.splice(index, 1);
  }
  if (eventHandlers.length === 0) {
    handlers.delete(eventKey);
  }
}
function clearInternalHooks() {
  handlers.clear();
}
function getRegisteredEventKeys() {
  return Array.from(handlers.keys());
}
async function triggerInternalHook(event) {
  const typeHandlers = handlers.get(event.type) ?? [];
  const specificHandlers = handlers.get(`${event.type}:${event.action}`) ?? [];
  const allHandlers = [...typeHandlers, ...specificHandlers];
  if (allHandlers.length === 0) {
    return;
  }
  for (const handler of allHandlers) {
    try {
      await handler(event);
    } catch (err) {
      console.error(
        `Hook error [${event.type}:${event.action}]:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}
function createInternalHookEvent(type, action, sessionKey, context = {}) {
  return {
    type,
    action,
    sessionKey,
    context,
    timestamp: /* @__PURE__ */ new Date(),
    messages: []
  };
}
function isAgentBootstrapEvent(event) {
  if (event.type !== 'agent' || event.action !== 'bootstrap') {
    return false;
  }
  const context = event.context;
  if (!context || typeof context !== 'object') {
    return false;
  }
  if (typeof context.workspaceDir !== 'string') {
    return false;
  }
  return Array.isArray(context.bootstrapFiles);
}
export {
  clearInternalHooks,
  createInternalHookEvent,
  getRegisteredEventKeys,
  isAgentBootstrapEvent,
  registerInternalHook,
  triggerInternalHook,
  unregisterInternalHook
};
