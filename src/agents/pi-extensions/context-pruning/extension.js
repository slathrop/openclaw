/**
 * Extension registration for context pruning.
 * @module agents/pi-extensions/context-pruning/extension
 */
import { pruneContextMessages } from './pruner.js';
import { getContextPruningRuntime } from './runtime.js';
function contextPruningExtension(api) {
  api.on('context', (event, ctx) => {
    const runtime = getContextPruningRuntime(ctx.sessionManager);
    if (!runtime) {
      return void 0;
    }
    if (runtime.settings.mode === 'cache-ttl') {
      const ttlMs = runtime.settings.ttlMs;
      const lastTouch = runtime.lastCacheTouchAt ?? null;
      if (!lastTouch || ttlMs <= 0) {
        return void 0;
      }
      if (ttlMs > 0 && Date.now() - lastTouch < ttlMs) {
        return void 0;
      }
    }
    const next = pruneContextMessages({
      messages: event.messages,
      settings: runtime.settings,
      ctx,
      isToolPrunable: runtime.isToolPrunable,
      contextWindowTokensOverride: runtime.contextWindowTokens ?? void 0
    });
    if (next === event.messages) {
      return void 0;
    }
    if (runtime.settings.mode === 'cache-ttl') {
      runtime.lastCacheTouchAt = Date.now();
    }
    return { messages: next };
  });
}
export {
  contextPruningExtension as default
};
