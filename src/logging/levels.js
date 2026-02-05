/**
 * Log level definitions and normalization.
 *
 * Defines the allowed log levels (silent through trace) and provides
 * helpers to normalize user input and map levels to tslog numeric values.
 */

export const ALLOWED_LOG_LEVELS = [
  'silent',
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace'
];

/**
 * @typedef {"silent" | "fatal" | "error" | "warn" | "info" | "debug" | "trace"} LogLevel
 */

/**
 * @param {string} [level]
 * @param {string} [fallback]
 * @returns {string}
 */
export const normalizeLogLevel = (level, fallback = 'info') => {
  const candidate = (level ?? fallback).trim();
  return ALLOWED_LOG_LEVELS.includes(candidate) ? candidate : fallback;
};

/**
 * @param {string} level
 * @returns {number}
 */
export const levelToMinLevel = (level) => {
  // tslog level ordering: fatal=0, error=1, warn=2, info=3, debug=4, trace=5
  const map = {
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    trace: 5,
    silent: Number.POSITIVE_INFINITY
  };
  return map[level];
};
