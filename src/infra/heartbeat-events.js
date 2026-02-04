/**
 * Heartbeat event types and pub/sub system.
 *
 * Provides event emission, subscription, and indicator type resolution
 * for heartbeat lifecycle events (sent, ok, skipped, failed).
 */

/**
 * @typedef {'ok' | 'alert' | 'error'} HeartbeatIndicatorType
 */

/**
 * @typedef {object} HeartbeatEventPayload
 * @property {number} ts
 * @property {'sent' | 'ok-empty' | 'ok-token' | 'skipped' | 'failed'} status
 * @property {string} [to]
 * @property {string} [accountId]
 * @property {string} [preview]
 * @property {number} [durationMs]
 * @property {boolean} [hasMedia]
 * @property {string} [reason]
 * @property {string} [channel] - The channel this heartbeat was sent to.
 * @property {boolean} [silent] - Whether the message was silently suppressed (showOk: false).
 * @property {HeartbeatIndicatorType} [indicatorType] - Indicator type for UI status display.
 */

/**
 * Resolves the indicator type for a heartbeat status.
 * @param {HeartbeatEventPayload['status']} status
 * @returns {HeartbeatIndicatorType | undefined}
 */
export function resolveIndicatorType(status) {
  switch (status) {
    case 'ok-empty':
    case 'ok-token':
      return 'ok';
    case 'sent':
      return 'alert';
    case 'failed':
      return 'error';
    case 'skipped':
      return undefined;
  }
}

/** @type {HeartbeatEventPayload | null} */
let lastHeartbeat = null;
/** @type {Set<(evt: HeartbeatEventPayload) => void>} */
const listeners = new Set();

/**
 * Emits a heartbeat event to all registered listeners.
 * @param {Omit<HeartbeatEventPayload, 'ts'>} evt
 */
export function emitHeartbeatEvent(evt) {
  /** @type {HeartbeatEventPayload} */
  const enriched = {ts: Date.now(), ...evt};
  lastHeartbeat = enriched;
  for (const listener of listeners) {
    try {
      listener(enriched);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Registers a listener for heartbeat events.
 * @param {(evt: HeartbeatEventPayload) => void} listener
 * @returns {() => void} Unsubscribe function
 */
export function onHeartbeatEvent(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Returns the most recent heartbeat event, or null if none.
 * @returns {HeartbeatEventPayload | null}
 */
export function getLastHeartbeatEvent() {
  return lastHeartbeat;
}
