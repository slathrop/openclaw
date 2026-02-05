/** @module plugins/runtime/types - Type definitions for the plugin runtime. */

/**
 * @typedef {object} RuntimeLogger
 * @property {Function} [debug] - Debug log.
 * @property {Function} info - Info log.
 * @property {Function} warn - Warning log.
 * @property {Function} error - Error log.
 */

/**
 * @typedef {object} PluginRuntime
 * @property {string} version - Runtime version.
 * @property {object} config - Config operations.
 * @property {object} system - System operations.
 * @property {object} media - Media operations.
 * @property {object} tts - Text-to-speech operations.
 * @property {object} tools - Tool operations.
 * @property {object} channel - Channel operations.
 * @property {object} logging - Logging operations.
 * @property {object} state - State operations.
 */
