/**
 * Agent event bus with per-run monotonic sequencing.
 *
 * Provides event emission, subscription, and run context management
 * for agent lifecycle, tool use, and assistant events. Each run
 * maintains strictly monotonic sequence numbers.
 */

/**
 * @typedef {'lifecycle' | 'tool' | 'assistant' | 'error' | string} AgentEventStream
 */

/**
 * @typedef {object} AgentEventPayload
 * @property {string} runId
 * @property {number} seq
 * @property {AgentEventStream} stream
 * @property {number} ts
 * @property {Record<string, unknown>} data
 * @property {string} [sessionKey]
 */

/**
 * @typedef {object} AgentRunContext
 * @property {string} [sessionKey]
 * @property {import('../auto-reply/thinking.js').VerboseLevel} [verboseLevel]
 * @property {boolean} [isHeartbeat]
 */

// Keep per-run counters so streams stay strictly monotonic per runId.
/** @type {Map<string, number>} */
const seqByRun = new Map();
/** @type {Set<(evt: AgentEventPayload) => void>} */
const listeners = new Set();
/** @type {Map<string, AgentRunContext>} */
const runContextById = new Map();

/**
 * Registers or updates a run context.
 * @param {string} runId
 * @param {AgentRunContext} context
 */
export function registerAgentRunContext(runId, context) {
  if (!runId) {
    return;
  }
  const existing = runContextById.get(runId);
  if (!existing) {
    runContextById.set(runId, {...context});
    return;
  }
  if (context.sessionKey && existing.sessionKey !== context.sessionKey) {
    existing.sessionKey = context.sessionKey;
  }
  if (context.verboseLevel && existing.verboseLevel !== context.verboseLevel) {
    existing.verboseLevel = context.verboseLevel;
  }
  if (context.isHeartbeat !== undefined && existing.isHeartbeat !== context.isHeartbeat) {
    existing.isHeartbeat = context.isHeartbeat;
  }
}

/**
 * Returns the run context for a given runId.
 * @param {string} runId
 * @returns {AgentRunContext | undefined}
 */
export function getAgentRunContext(runId) {
  return runContextById.get(runId);
}

/**
 * Clears the run context for a given runId.
 * @param {string} runId
 */
export function clearAgentRunContext(runId) {
  runContextById.delete(runId);
}

/**
 * Resets all run contexts (for testing).
 */
export function resetAgentRunContextForTest() {
  runContextById.clear();
}

/**
 * Emits an agent event to all registered listeners.
 * @param {Omit<AgentEventPayload, 'seq' | 'ts'>} event
 */
export function emitAgentEvent(event) {
  const nextSeq = (seqByRun.get(event.runId) ?? 0) + 1;
  seqByRun.set(event.runId, nextSeq);
  const context = runContextById.get(event.runId);
  const sessionKey =
    typeof event.sessionKey === 'string' && event.sessionKey.trim()
      ? event.sessionKey
      : context?.sessionKey;
  /** @type {AgentEventPayload} */
  const enriched = {
    ...event,
    sessionKey,
    seq: nextSeq,
    ts: Date.now()
  };
  for (const listener of listeners) {
    try {
      listener(enriched);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Registers a listener for agent events.
 * @param {(evt: AgentEventPayload) => void} listener
 * @returns {() => void} Unsubscribe function
 */
export function onAgentEvent(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
