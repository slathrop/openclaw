/**
 * @module logging
 * Config update logging and path formatting.
 */
import {displayPath} from '../utils.js';
import {CONFIG_PATH} from './paths.js';

/**
 * Formats a config path for display.
 * @param {string} [configPath]
 * @returns {string}
 */
export function formatConfigPath(configPath = CONFIG_PATH) {
  return displayPath(configPath);
}

/**
 * Logs a config update message.
 * @param {import('../runtime.js').RuntimeEnv} runtime
 * @param {{ path?: string, suffix?: string }} [opts]
 */
export function logConfigUpdated(runtime, opts = {}) {
  const configPath = formatConfigPath(opts.path ?? CONFIG_PATH);
  const suffix = opts.suffix ? ` ${opts.suffix}` : '';
  runtime.log(`Updated ${configPath}${suffix}`);
}
