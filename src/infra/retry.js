/**
 * Generic async retry with configurable backoff and policies.
 *
 * Supports both simple numeric retry counts and rich option objects
 * with custom shouldRetry predicates, retry-after extraction, jitter,
 * and callback hooks.
 */
import {sleep} from '../utils.js';

/**
 * @typedef {{
 *   attempts?: number,
 *   minDelayMs?: number,
 *   maxDelayMs?: number,
 *   jitter?: number
 * }} RetryConfig
 */

/**
 * @typedef {{
 *   attempt: number,
 *   maxAttempts: number,
 *   delayMs: number,
 *   err: unknown,
 *   label?: string
 * }} RetryInfo
 */

/**
 * @typedef {RetryConfig & {
 *   label?: string,
 *   shouldRetry?: (err: unknown, attempt: number) => boolean,
 *   retryAfterMs?: (err: unknown) => number | undefined,
 *   onRetry?: (info: RetryInfo) => void
 * }} RetryOptions
 */

const DEFAULT_RETRY_CONFIG = {
  attempts: 3,
  minDelayMs: 300,
  maxDelayMs: 30_000,
  jitter: 0
};

/**
 * @param {unknown} value
 * @returns {number | undefined}
 */
const asFiniteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} [min]
 * @param {number} [max]
 * @returns {number}
 */
const clampNumber = (value, fallback, min, max) => {
  const next = asFiniteNumber(value);
  if (next === undefined) {
    return fallback;
  }
  const floor = typeof min === 'number' ? min : Number.NEGATIVE_INFINITY;
  const ceiling = typeof max === 'number' ? max : Number.POSITIVE_INFINITY;
  return Math.min(Math.max(next, floor), ceiling);
};

/**
 * Resolves a retry config by merging defaults with optional overrides.
 * @param {{ attempts: number, minDelayMs: number, maxDelayMs: number, jitter: number }} defaults
 * @param {RetryConfig} [overrides]
 * @returns {{ attempts: number, minDelayMs: number, maxDelayMs: number, jitter: number }}
 */
export function resolveRetryConfig(
  defaults = DEFAULT_RETRY_CONFIG,
  overrides
) {
  const attempts = Math.max(1, Math.round(clampNumber(overrides?.attempts, defaults.attempts, 1)));
  const minDelayMs = Math.max(
    0,
    Math.round(clampNumber(overrides?.minDelayMs, defaults.minDelayMs, 0))
  );
  const maxDelayMs = Math.max(
    minDelayMs,
    Math.round(clampNumber(overrides?.maxDelayMs, defaults.maxDelayMs, 0))
  );
  const jitter = clampNumber(overrides?.jitter, defaults.jitter, 0, 1);
  return {attempts, minDelayMs, maxDelayMs, jitter};
}

/**
 * Applies jitter to a delay value.
 * @param {number} delayMs
 * @param {number} jitter
 * @returns {number}
 */
function applyJitter(delayMs, jitter) {
  if (jitter <= 0) {
    return delayMs;
  }
  const offset = (Math.random() * 2 - 1) * jitter;
  return Math.max(0, Math.round(delayMs * (1 + offset)));
}

/**
 * Retries an async function with configurable backoff.
 * @param {() => Promise<*>} fn - The async function to retry
 * @param {number | RetryOptions} [attemptsOrOptions]
 * @param {number} [initialDelayMs]
 * @returns {Promise<*>}
 */
export async function retryAsync(
  fn,
  attemptsOrOptions = 3,
  initialDelayMs = 300
) {
  if (typeof attemptsOrOptions === 'number') {
    const attempts = Math.max(1, Math.round(attemptsOrOptions));
    let lastErr;
    for (let i = 0; i < attempts; i += 1) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (i === attempts - 1) {
          break;
        }
        const delayMs = initialDelayMs * 2 ** i;
        await sleep(delayMs);
      }
    }
    throw lastErr ?? new Error('Retry failed');
  }

  const options = attemptsOrOptions;

  const resolved = resolveRetryConfig(DEFAULT_RETRY_CONFIG, options);
  const maxAttempts = resolved.attempts;
  const minDelayMs = resolved.minDelayMs;
  const maxDelayMs =
    Number.isFinite(resolved.maxDelayMs) && resolved.maxDelayMs > 0
      ? resolved.maxDelayMs
      : Number.POSITIVE_INFINITY;
  const jitter = resolved.jitter;
  const shouldRetry = options.shouldRetry ?? (() => true);
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts || !shouldRetry(err, attempt)) {
        break;
      }

      const retryAfterMs = options.retryAfterMs?.(err);
      const hasRetryAfter = typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs);
      const baseDelay = hasRetryAfter
        ? Math.max(retryAfterMs, minDelayMs)
        : minDelayMs * 2 ** (attempt - 1);
      let delayVal = Math.min(baseDelay, maxDelayMs);
      delayVal = applyJitter(delayVal, jitter);
      delayVal = Math.min(Math.max(delayVal, minDelayMs), maxDelayMs);

      options.onRetry?.({
        attempt,
        maxAttempts,
        delayMs: delayVal,
        err,
        label: options.label
      });
      await sleep(delayVal);
    }
  }

  throw lastErr ?? new Error('Retry failed');
}
