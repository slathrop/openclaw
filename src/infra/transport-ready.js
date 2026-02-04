/**
 * Transport readiness polling with timeout and logging.
 *
 * Polls a transport check function until it reports ready,
 * with configurable timeout, polling interval, and abort support.
 */
import {danger} from '../globals.js';
import {sleepWithAbort} from './backoff.js';

/**
 * @typedef {object} TransportReadyResult
 * @property {boolean} ok
 * @property {string | null} [error]
 */

/**
 * @typedef {object} WaitForTransportReadyParams
 * @property {string} label
 * @property {number} timeoutMs
 * @property {number} [logAfterMs]
 * @property {number} [logIntervalMs]
 * @property {number} [pollIntervalMs]
 * @property {AbortSignal} [abortSignal]
 * @property {import('../runtime.js').RuntimeEnv} runtime
 * @property {() => Promise<TransportReadyResult>} check
 */

/**
 * Waits for a transport to become ready, polling at intervals.
 * @param {WaitForTransportReadyParams} params
 * @returns {Promise<void>}
 */
export async function waitForTransportReady(params) {
  const started = Date.now();
  const timeoutMs = Math.max(0, params.timeoutMs);
  const deadline = started + timeoutMs;
  const logAfterMs = Math.max(0, params.logAfterMs ?? timeoutMs);
  const logIntervalMs = Math.max(1_000, params.logIntervalMs ?? 30_000);
  const pollIntervalMs = Math.max(50, params.pollIntervalMs ?? 150);
  let nextLogAt = started + logAfterMs;
  let lastError = null;

  while (true) {
    if (params.abortSignal?.aborted) {
      return;
    }
    const res = await params.check();
    if (res.ok) {
      return;
    }
    lastError = res.error ?? null;

    const now = Date.now();
    if (now >= deadline) {
      break;
    }
    if (now >= nextLogAt) {
      const elapsedMs = now - started;
      params.runtime.error?.(
        danger(`${params.label} not ready after ${elapsedMs}ms (${lastError ?? 'unknown error'})`)
      );
      nextLogAt = now + logIntervalMs;
    }

    try {
      await sleepWithAbort(pollIntervalMs, params.abortSignal);
    } catch (err) {
      if (params.abortSignal?.aborted) {
        return;
      }
      throw err;
    }
  }

  params.runtime.error?.(
    danger(`${params.label} not ready after ${timeoutMs}ms (${lastError ?? 'unknown error'})`)
  );
  throw new Error(`${params.label} not ready (${lastError ?? 'unknown error'})`);
}
