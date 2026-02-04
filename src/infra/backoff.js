/**
 * Exponential backoff computation and sleep with abort support.
 *
 * Provides configurable backoff delay calculation with jitter
 * and an interruptible sleep primitive using AbortSignal.
 */
import {setTimeout as delay} from 'node:timers/promises';

/**
 * @typedef {{
 *   initialMs: number,
 *   maxMs: number,
 *   factor: number,
 *   jitter: number
 * }} BackoffPolicy
 */

/**
 * Computes the backoff delay for a given attempt number.
 * @param {BackoffPolicy} policy
 * @param {number} attempt
 * @returns {number}
 */
export function computeBackoff(policy, attempt) {
  const base = policy.initialMs * policy.factor ** Math.max(attempt - 1, 0);
  const jitter = base * policy.jitter * Math.random();
  return Math.min(policy.maxMs, Math.round(base + jitter));
}

/**
 * Sleeps for the specified duration, respecting an optional abort signal.
 * @param {number} ms
 * @param {AbortSignal} [abortSignal]
 * @returns {Promise<void>}
 */
export async function sleepWithAbort(ms, abortSignal) {
  if (ms <= 0) {
    return;
  }
  try {
    await delay(ms, undefined, {signal: abortSignal});
  } catch (err) {
    if (abortSignal?.aborted) {
      throw new Error('aborted', {cause: err});
    }
    throw err;
  }
}
