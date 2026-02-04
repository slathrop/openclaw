/**
 * Heartbeat wake scheduling with coalescing and retry.
 *
 * Manages wake handler registration, request coalescing, and retry
 * logic for the heartbeat runner's timer-based scheduling.
 */

/**
 * @typedef {object} HeartbeatRunResultRan
 * @property {'ran'} status
 * @property {number} durationMs
 */

/**
 * @typedef {object} HeartbeatRunResultSkipped
 * @property {'skipped'} status
 * @property {string} reason
 */

/**
 * @typedef {object} HeartbeatRunResultFailed
 * @property {'failed'} status
 * @property {string} reason
 */

/**
 * @typedef {HeartbeatRunResultRan | HeartbeatRunResultSkipped | HeartbeatRunResultFailed} HeartbeatRunResult
 */

/**
 * @typedef {(opts: { reason?: string }) => Promise<HeartbeatRunResult>} HeartbeatWakeHandler
 */

/** @type {HeartbeatWakeHandler | null} */
let handler = null;
/** @type {string | null} */
let pendingReason = null;
let scheduled = false;
let running = false;
/** @type {NodeJS.Timeout | null} */
let timer = null;

const DEFAULT_COALESCE_MS = 250;
const DEFAULT_RETRY_MS = 1_000;

/**
 * @param {number} coalesceMs
 */
function schedule(coalesceMs) {
  if (timer) {
    return;
  }
  timer = setTimeout(async () => {
    timer = null;
    scheduled = false;
    const active = handler;
    if (!active) {
      return;
    }
    if (running) {
      scheduled = true;
      schedule(coalesceMs);
      return;
    }

    const reason = pendingReason;
    pendingReason = null;
    running = true;
    try {
      const res = await active({reason: reason ?? undefined});
      if (res.status === 'skipped' && res.reason === 'requests-in-flight') {
        // The main lane is busy; retry soon.
        pendingReason = reason ?? 'retry';
        schedule(DEFAULT_RETRY_MS);
      }
    } catch {
      // Error is already logged by the heartbeat runner; schedule a retry.
      pendingReason = reason ?? 'retry';
      schedule(DEFAULT_RETRY_MS);
    } finally {
      running = false;
      if (pendingReason || scheduled) {
        schedule(coalesceMs);
      }
    }
  }, coalesceMs);
  timer.unref?.();
}

/**
 * Sets or clears the heartbeat wake handler.
 * @param {HeartbeatWakeHandler | null} next
 */
export function setHeartbeatWakeHandler(next) {
  handler = next;
  if (handler && pendingReason) {
    schedule(DEFAULT_COALESCE_MS);
  }
}

/**
 * Requests a heartbeat wake with optional coalescing delay.
 * @param {object} [opts]
 * @param {string} [opts.reason]
 * @param {number} [opts.coalesceMs]
 */
export function requestHeartbeatNow(opts) {
  pendingReason = opts?.reason ?? pendingReason ?? 'requested';
  schedule(opts?.coalesceMs ?? DEFAULT_COALESCE_MS);
}

/**
 * Returns whether a wake handler is currently registered.
 * @returns {boolean}
 */
export function hasHeartbeatWakeHandler() {
  return handler !== null;
}

/**
 * Returns whether there is a pending heartbeat wake.
 * @returns {boolean}
 */
export function hasPendingHeartbeatWake() {
  return pendingReason !== null || Boolean(timer) || scheduled;
}
