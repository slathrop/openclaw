/**
 * Context pruning extension for conversation history trimming.
 * @module agents/pi-extensions/context-pruning
 */
import { default as default2 } from './context-pruning/extension.js';
import { pruneContextMessages } from './context-pruning/pruner.js';
import {
  computeEffectiveSettings,
  DEFAULT_CONTEXT_PRUNING_SETTINGS
} from './context-pruning/settings.js';
export {
  DEFAULT_CONTEXT_PRUNING_SETTINGS,
  computeEffectiveSettings,
  default2 as default,
  pruneContextMessages
};
