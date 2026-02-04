/**
 * Duration formatting utilities for human-readable time display.
 *
 * Formats millisecond durations into seconds or milliseconds
 * with configurable decimal precision and unit labels.
 */

/**
 * @typedef {{
 *   decimals?: number,
 *   unit?: "s" | "seconds"
 * }} FormatDurationSecondsOptions
 */

/**
 * Formats a millisecond duration as seconds with optional decimals.
 * @param {number} ms
 * @param {FormatDurationSecondsOptions} [options]
 * @returns {string}
 */
export function formatDurationSeconds(ms, options = {}) {
  if (!Number.isFinite(ms)) {
    return 'unknown';
  }
  const decimals = options.decimals ?? 1;
  const unit = options.unit ?? 's';
  const seconds = Math.max(0, ms) / 1000;
  const fixed = seconds.toFixed(Math.max(0, decimals));
  const trimmed = fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  return unit === 'seconds' ? `${trimmed} seconds` : `${trimmed}s`;
}

/**
 * @typedef {{
 *   decimals?: number,
 *   unit?: "s" | "seconds"
 * }} FormatDurationMsOptions
 */

/**
 * Formats a millisecond duration, using "ms" for values under 1 second.
 * @param {number} ms
 * @param {FormatDurationMsOptions} [options]
 * @returns {string}
 */
export function formatDurationMs(ms, options = {}) {
  if (!Number.isFinite(ms)) {
    return 'unknown';
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return formatDurationSeconds(ms, {
    decimals: options.decimals ?? 2,
    unit: options.unit ?? 's'
  });
}
