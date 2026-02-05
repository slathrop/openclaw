/**
 * @module globals
 * Global state initialization.
 *
 * Manages global CLI flags (verbose, yes) and re-exports themed log
 * helpers. These are set once during CLI startup and read throughout
 * the application for controlling output verbosity and confirmation prompts.
 */
import {getLogger, isFileLogLevelEnabled} from './logging/logger.js';
import {theme} from './terminal/theme.js';

let globalVerbose = false;
let globalYes = false;

/**
 * @param {boolean} v
 */
export function setVerbose(v) {
  globalVerbose = v;
}

export function isVerbose() {
  return globalVerbose;
}

export function shouldLogVerbose() {
  return globalVerbose || isFileLogLevelEnabled('debug');
}

/**
 * Logs a message at verbose level (file logger + console when --verbose).
 * @param {string} message
 */
export function logVerbose(message) {
  if (!shouldLogVerbose()) {
    return;
  }
  try {
    getLogger().debug({message}, 'verbose');
  } catch {
    // ignore logger failures to avoid breaking verbose printing
  }
  if (!globalVerbose) {
    return;
  }
  console.log(theme.muted(message));
}

/**
 * Logs a message to console only when --verbose is set.
 * @param {string} message
 */
export function logVerboseConsole(message) {
  if (!globalVerbose) {
    return;
  }
  console.log(theme.muted(message));
}

/**
 * @param {boolean} v
 */
export function setYes(v) {
  globalYes = v;
}

export function isYes() {
  return globalYes;
}

export const success = theme.success;
export const warn = theme.warn;
export const info = theme.info;
export const danger = theme.error;
