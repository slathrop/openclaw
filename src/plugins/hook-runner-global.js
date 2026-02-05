/** @module plugins/hook-runner-global - Global hook runner initialization and dispatch. */
import { createSubsystemLogger } from '../logging/subsystem.js';
import { createHookRunner } from './hooks.js';
const log = createSubsystemLogger('plugins');
let globalHookRunner = null;
let globalRegistry = null;
function initializeGlobalHookRunner(registry) {
  globalRegistry = registry;
  globalHookRunner = createHookRunner(registry, {
    logger: {
      debug: (msg) => log.debug(msg),
      warn: (msg) => log.warn(msg),
      error: (msg) => log.error(msg)
    },
    catchErrors: true
  });
  const hookCount = registry.hooks.length;
  if (hookCount > 0) {
    log.info(`hook runner initialized with ${hookCount} registered hooks`);
  }
}
function getGlobalHookRunner() {
  return globalHookRunner;
}
function getGlobalPluginRegistry() {
  return globalRegistry;
}
function hasGlobalHooks(hookName) {
  return globalHookRunner?.hasHooks(hookName) ?? false;
}
function resetGlobalHookRunner() {
  globalHookRunner = null;
  globalRegistry = null;
}
export {
  getGlobalHookRunner,
  getGlobalPluginRegistry,
  hasGlobalHooks,
  initializeGlobalHookRunner,
  resetGlobalHookRunner
};
