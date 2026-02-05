export * from './internal-hooks.js';
import {
  registerInternalHook,
  unregisterInternalHook,
  clearInternalHooks,
  getRegisteredEventKeys,
  triggerInternalHook,
  createInternalHookEvent
} from './internal-hooks.js';
export {
  clearInternalHooks as clearHooks,
  createInternalHookEvent as createHookEvent,
  getRegisteredEventKeys as getRegisteredHookEventKeys,
  registerInternalHook as registerHook,
  triggerInternalHook as triggerHook,
  unregisterInternalHook as unregisterHook
};
