/**
 * Diagnostic event system for gateway observability.
 *
 * Emits structured diagnostic events (model usage, webhook lifecycle,
 * message processing, session state, queue metrics) with monotonic
 * sequencing for real-time monitoring.
 */

/**
 * @typedef {'idle' | 'processing' | 'waiting'} DiagnosticSessionState
 */

/**
 * @typedef {object} DiagnosticUsageEvent
 * @property {'model.usage'} type
 * @property {number} ts
 * @property {number} seq
 * @property {string} [sessionKey]
 * @property {string} [sessionId]
 * @property {string} [channel]
 * @property {string} [provider]
 * @property {string} [model]
 * @property {object} usage
 * @property {number} [usage.input]
 * @property {number} [usage.output]
 * @property {number} [usage.cacheRead]
 * @property {number} [usage.cacheWrite]
 * @property {number} [usage.promptTokens]
 * @property {number} [usage.total]
 * @property {object} [context]
 * @property {number} [context.limit]
 * @property {number} [context.used]
 * @property {number} [costUsd]
 * @property {number} [durationMs]
 */

/**
 * @typedef {object} DiagnosticWebhookReceivedEvent
 * @property {'webhook.received'} type
 * @property {number} ts
 * @property {number} seq
 * @property {string} channel
 * @property {string} [updateType]
 * @property {number | string} [chatId]
 */

/**
 * @typedef {object} DiagnosticWebhookProcessedEvent
 * @property {'webhook.processed'} type
 * @property {number} ts
 * @property {number} seq
 * @property {string} channel
 * @property {string} [updateType]
 * @property {number | string} [chatId]
 * @property {number} [durationMs]
 */

/**
 * @typedef {object} DiagnosticWebhookErrorEvent
 * @property {'webhook.error'} type
 * @property {number} ts
 * @property {number} seq
 * @property {string} channel
 * @property {string} [updateType]
 * @property {number | string} [chatId]
 * @property {string} error
 */

/**
 * @typedef {object} DiagnosticMessageQueuedEvent
 * @property {'message.queued'} type
 * @property {number} ts
 * @property {number} seq
 * @property {string} [sessionKey]
 * @property {string} [sessionId]
 * @property {string} [channel]
 * @property {string} source
 * @property {number} [queueDepth]
 */

/**
 * @typedef {object} DiagnosticMessageProcessedEvent
 * @property {'message.processed'} type
 * @property {number} ts
 * @property {number} seq
 * @property {string} channel
 * @property {number | string} [messageId]
 * @property {number | string} [chatId]
 * @property {string} [sessionKey]
 * @property {string} [sessionId]
 * @property {number} [durationMs]
 * @property {'completed' | 'skipped' | 'error'} outcome
 * @property {string} [reason]
 * @property {string} [error]
 */

/**
 * @typedef {object} DiagnosticSessionStateEvent
 * @property {'session.state'} type
 * @property {number} ts
 * @property {number} seq
 * @property {string} [sessionKey]
 * @property {string} [sessionId]
 * @property {DiagnosticSessionState} [prevState]
 * @property {DiagnosticSessionState} state
 * @property {string} [reason]
 * @property {number} [queueDepth]
 */

/**
 * @typedef {object} DiagnosticSessionStuckEvent
 * @property {'session.stuck'} type
 * @property {number} ts
 * @property {number} seq
 * @property {string} [sessionKey]
 * @property {string} [sessionId]
 * @property {DiagnosticSessionState} state
 * @property {number} ageMs
 * @property {number} [queueDepth]
 */

/**
 * @typedef {object} DiagnosticLaneEnqueueEvent
 * @property {'queue.lane.enqueue'} type
 * @property {number} ts
 * @property {number} seq
 * @property {string} lane
 * @property {number} queueSize
 */

/**
 * @typedef {object} DiagnosticLaneDequeueEvent
 * @property {'queue.lane.dequeue'} type
 * @property {number} ts
 * @property {number} seq
 * @property {string} lane
 * @property {number} queueSize
 * @property {number} waitMs
 */

/**
 * @typedef {object} DiagnosticRunAttemptEvent
 * @property {'run.attempt'} type
 * @property {number} ts
 * @property {number} seq
 * @property {string} [sessionKey]
 * @property {string} [sessionId]
 * @property {string} runId
 * @property {number} attempt
 */

/**
 * @typedef {object} DiagnosticHeartbeatEvent
 * @property {'diagnostic.heartbeat'} type
 * @property {number} ts
 * @property {number} seq
 * @property {object} webhooks
 * @property {number} webhooks.received
 * @property {number} webhooks.processed
 * @property {number} webhooks.errors
 * @property {number} active
 * @property {number} waiting
 * @property {number} queued
 */

/**
 * @typedef {DiagnosticUsageEvent | DiagnosticWebhookReceivedEvent | DiagnosticWebhookProcessedEvent | DiagnosticWebhookErrorEvent | DiagnosticMessageQueuedEvent | DiagnosticMessageProcessedEvent | DiagnosticSessionStateEvent | DiagnosticSessionStuckEvent | DiagnosticLaneEnqueueEvent | DiagnosticLaneDequeueEvent | DiagnosticRunAttemptEvent | DiagnosticHeartbeatEvent} DiagnosticEventPayload
 */

let seq = 0;
/** @type {Set<(evt: DiagnosticEventPayload) => void>} */
const listeners = new Set();

/**
 * Returns whether diagnostics are enabled in config.
 * @param {import('../config/config.js').OpenClawConfig} [config]
 * @returns {boolean}
 */
export function isDiagnosticsEnabled(config) {
  return config?.diagnostics?.enabled === true;
}

/**
 * Emits a diagnostic event to all registered listeners.
 * @param {object} event - Event without seq/ts (auto-populated)
 */
export function emitDiagnosticEvent(event) {
  const enriched = {
    ...event,
    seq: (seq += 1),
    ts: Date.now()
  };
  for (const listener of listeners) {
    try {
      listener(enriched);
    } catch {
      // Ignore listener failures.
    }
  }
}

/**
 * Registers a listener for diagnostic events.
 * @param {(evt: DiagnosticEventPayload) => void} listener
 * @returns {() => void} Unsubscribe function
 */
export function onDiagnosticEvent(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Resets diagnostic event state (for testing).
 */
export function resetDiagnosticEventsForTest() {
  seq = 0;
  listeners.clear();
}
