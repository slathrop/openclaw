/**
 * Environment variable utilities.
 *
 * Provides normalization for provider env vars, truthy value parsing,
 * and accepted env option logging for diagnostics.
 */

import {createSubsystemLogger} from '../logging/subsystem.js';
import {parseBooleanValue} from '../utils/boolean.js';

const log = createSubsystemLogger('env');
const loggedEnv = new Set();

/**
 * Formats an env value for logging, optionally redacting sensitive values.
 * @param {string} value
 * @param {boolean} [redact]
 * @returns {string}
 */
function formatEnvValue(value, redact) {
  if (redact) {
    return '<redacted>';
  }
  const singleLine = value.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= 160) {
    return singleLine;
  }
  return `${singleLine.slice(0, 160)}\u2026`;
}

/**
 * Logs an accepted environment option once (deduplicated by key).
 * @param {{ key: string, description: string, value?: string, redact?: boolean }} option
 */
export function logAcceptedEnvOption(option) {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return;
  }
  if (loggedEnv.has(option.key)) {
    return;
  }
  const rawValue = option.value ?? process.env[option.key];
  if (!rawValue || !rawValue.trim()) {
    return;
  }
  loggedEnv.add(option.key);
  log.info(
    `env: ${option.key}=${formatEnvValue(rawValue, option.redact)} (${option.description})`
  );
}

/**
 * Normalizes Z_AI_API_KEY to ZAI_API_KEY when the latter is missing.
 */
export function normalizeZaiEnv() {
  if (!process.env.ZAI_API_KEY?.trim() && process.env.Z_AI_API_KEY?.trim()) {
    process.env.ZAI_API_KEY = process.env.Z_AI_API_KEY;
  }
}

/**
 * Returns true if the given string represents a truthy value.
 * @param {string} [value]
 * @returns {boolean}
 */
export function isTruthyEnvValue(value) {
  return parseBooleanValue(value) === true;
}

/**
 * Applies all env normalizations.
 */
export function normalizeEnv() {
  normalizeZaiEnv();
}
