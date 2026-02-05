/**
 * Diagnostic event logging for gateway runtime observability.
 *
 * Tracks webhook activity, message processing, session state transitions,
 * queue lane operations, and run attempts. Emits structured diagnostic
 * events and provides a periodic heartbeat for monitoring stuck sessions.
 */
import { emitDiagnosticEvent } from '../infra/diagnostic-events.js';
import { createSubsystemLogger } from './subsystem.js';

const diag = createSubsystemLogger('diagnostic');

/** @type {Map<string, object>} */
const sessionStates = new Map();

const webhookStats = {
  received: 0,
  processed: 0,
  errors: 0,
  lastReceived: 0
};

let lastActivityAt = 0;

const markActivity = () => {
  lastActivityAt = Date.now();
};

const resolveSessionKey = ({ sessionKey, sessionId }) => {
  return sessionKey ?? sessionId ?? 'unknown';
};

const getSessionState = (ref) => {
  const key = resolveSessionKey(ref);
  const existing = sessionStates.get(key);
  if (existing) {
    if (ref.sessionId) {
      existing.sessionId = ref.sessionId;
    }
    if (ref.sessionKey) {
      existing.sessionKey = ref.sessionKey;
    }
    return existing;
  }
  const created = {
    sessionId: ref.sessionId,
    sessionKey: ref.sessionKey,
    lastActivity: Date.now(),
    state: 'idle',
    queueDepth: 0
  };
  sessionStates.set(key, created);
  return created;
};

/**
 * @param {object} params
 * @param {string} params.channel
 * @param {string} [params.updateType]
 * @param {number | string} [params.chatId]
 */
export const logWebhookReceived = (params) => {
  webhookStats.received += 1;
  webhookStats.lastReceived = Date.now();
  diag.debug(
    `webhook received: channel=${params.channel} type=${params.updateType ?? 'unknown'} chatId=${
      params.chatId ?? 'unknown'
    } total=${webhookStats.received}`
  );
  emitDiagnosticEvent({
    type: 'webhook.received',
    channel: params.channel,
    updateType: params.updateType,
    chatId: params.chatId
  });
  markActivity();
};

/**
 * @param {object} params
 * @param {string} params.channel
 * @param {string} [params.updateType]
 * @param {number | string} [params.chatId]
 * @param {number} [params.durationMs]
 */
export const logWebhookProcessed = (params) => {
  webhookStats.processed += 1;
  diag.debug(
    `webhook processed: channel=${params.channel} type=${
      params.updateType ?? 'unknown'
    } chatId=${params.chatId ?? 'unknown'} duration=${params.durationMs ?? 0}ms processed=${
      webhookStats.processed
    }`
  );
  emitDiagnosticEvent({
    type: 'webhook.processed',
    channel: params.channel,
    updateType: params.updateType,
    chatId: params.chatId,
    durationMs: params.durationMs
  });
  markActivity();
};

/**
 * @param {object} params
 * @param {string} params.channel
 * @param {string} [params.updateType]
 * @param {number | string} [params.chatId]
 * @param {string} params.error
 */
export const logWebhookError = (params) => {
  webhookStats.errors += 1;
  diag.error(
    `webhook error: channel=${params.channel} type=${params.updateType ?? 'unknown'} chatId=${
      params.chatId ?? 'unknown'
    } error="${params.error}" errors=${webhookStats.errors}`
  );
  emitDiagnosticEvent({
    type: 'webhook.error',
    channel: params.channel,
    updateType: params.updateType,
    chatId: params.chatId,
    error: params.error
  });
  markActivity();
};

/**
 * @param {object} params
 * @param {string} [params.sessionId]
 * @param {string} [params.sessionKey]
 * @param {string} [params.channel]
 * @param {string} params.source
 */
export const logMessageQueued = (params) => {
  const state = getSessionState(params);
  state.queueDepth += 1;
  state.lastActivity = Date.now();
  diag.debug(
    `message queued: sessionId=${state.sessionId ?? 'unknown'} sessionKey=${
      state.sessionKey ?? 'unknown'
    } source=${params.source} queueDepth=${state.queueDepth} sessionState=${state.state}`
  );
  emitDiagnosticEvent({
    type: 'message.queued',
    sessionId: state.sessionId,
    sessionKey: state.sessionKey,
    channel: params.channel,
    source: params.source,
    queueDepth: state.queueDepth
  });
  markActivity();
};

/**
 * @param {object} params
 * @param {string} params.channel
 * @param {number | string} [params.messageId]
 * @param {number | string} [params.chatId]
 * @param {string} [params.sessionId]
 * @param {string} [params.sessionKey]
 * @param {number} [params.durationMs]
 * @param {"completed" | "skipped" | "error"} params.outcome
 * @param {string} [params.reason]
 * @param {string} [params.error]
 */
export const logMessageProcessed = (params) => {
  const payload = `message processed: channel=${params.channel} chatId=${
    params.chatId ?? 'unknown'
  } messageId=${params.messageId ?? 'unknown'} sessionId=${
    params.sessionId ?? 'unknown'
  } sessionKey=${params.sessionKey ?? 'unknown'} outcome=${params.outcome} duration=${
    params.durationMs ?? 0
  }ms${params.reason ? ` reason=${params.reason}` : ''}${
    params.error ? ` error="${params.error}"` : ''
  }`;
  if (params.outcome === 'error') {
    diag.error(payload);
  } else if (params.outcome === 'skipped') {
    diag.debug(payload);
  } else {
    diag.debug(payload);
  }
  emitDiagnosticEvent({
    type: 'message.processed',
    channel: params.channel,
    chatId: params.chatId,
    messageId: params.messageId,
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    durationMs: params.durationMs,
    outcome: params.outcome,
    reason: params.reason,
    error: params.error
  });
  markActivity();
};

/**
 * @param {object} params
 * @param {string} [params.sessionId]
 * @param {string} [params.sessionKey]
 * @param {string} params.state
 * @param {string} [params.reason]
 */
export const logSessionStateChange = (params) => {
  const state = getSessionState(params);
  const isProbeSession = state.sessionId?.startsWith('probe-') ?? false;
  const prevState = state.state;
  state.state = params.state;
  state.lastActivity = Date.now();
  if (params.state === 'idle') {
    state.queueDepth = Math.max(0, state.queueDepth - 1);
  }
  if (!isProbeSession) {
    diag.debug(
      `session state: sessionId=${state.sessionId ?? 'unknown'} sessionKey=${
        state.sessionKey ?? 'unknown'
      } prev=${prevState} new=${params.state} reason="${params.reason ?? ''}" queueDepth=${
        state.queueDepth
      }`
    );
  }
  emitDiagnosticEvent({
    type: 'session.state',
    sessionId: state.sessionId,
    sessionKey: state.sessionKey,
    prevState,
    state: params.state,
    reason: params.reason,
    queueDepth: state.queueDepth
  });
  markActivity();
};

/**
 * @param {object} params
 * @param {string} [params.sessionId]
 * @param {string} [params.sessionKey]
 * @param {string} params.state
 * @param {number} params.ageMs
 */
export const logSessionStuck = (params) => {
  const state = getSessionState(params);
  diag.warn(
    `stuck session: sessionId=${state.sessionId ?? 'unknown'} sessionKey=${
      state.sessionKey ?? 'unknown'
    } state=${params.state} age=${Math.round(params.ageMs / 1000)}s queueDepth=${state.queueDepth}`
  );
  emitDiagnosticEvent({
    type: 'session.stuck',
    sessionId: state.sessionId,
    sessionKey: state.sessionKey,
    state: params.state,
    ageMs: params.ageMs,
    queueDepth: state.queueDepth
  });
  markActivity();
};

/**
 * @param {string} lane
 * @param {number} queueSize
 */
export const logLaneEnqueue = (lane, queueSize) => {
  diag.debug(`lane enqueue: lane=${lane} queueSize=${queueSize}`);
  emitDiagnosticEvent({
    type: 'queue.lane.enqueue',
    lane,
    queueSize
  });
  markActivity();
};

/**
 * @param {string} lane
 * @param {number} waitMs
 * @param {number} queueSize
 */
export const logLaneDequeue = (lane, waitMs, queueSize) => {
  diag.debug(`lane dequeue: lane=${lane} waitMs=${waitMs} queueSize=${queueSize}`);
  emitDiagnosticEvent({
    type: 'queue.lane.dequeue',
    lane,
    queueSize,
    waitMs
  });
  markActivity();
};

/**
 * @param {object} params
 * @param {string} [params.sessionId]
 * @param {string} [params.sessionKey]
 * @param {string} params.runId
 * @param {number} params.attempt
 */
export const logRunAttempt = (params) => {
  diag.debug(
    `run attempt: sessionId=${params.sessionId ?? 'unknown'} sessionKey=${
      params.sessionKey ?? 'unknown'
    } runId=${params.runId} attempt=${params.attempt}`
  );
  emitDiagnosticEvent({
    type: 'run.attempt',
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    runId: params.runId,
    attempt: params.attempt
  });
  markActivity();
};

export const logActiveRuns = () => {
  const activeSessions = Array.from(sessionStates.entries())
    .filter(([, s]) => s.state === 'processing')
    .map(
      ([id, s]) =>
        `${id}(q=${s.queueDepth},age=${Math.round((Date.now() - s.lastActivity) / 1000)}s)`
    );
  diag.debug(`active runs: count=${activeSessions.length} sessions=[${activeSessions.join(', ')}]`);
  markActivity();
};

/** @type {ReturnType<typeof setInterval> | null} */
let heartbeatInterval = null;

export const startDiagnosticHeartbeat = () => {
  if (heartbeatInterval) {
    return;
  }
  heartbeatInterval = setInterval(() => {
    const now = Date.now();
    const activeCount = Array.from(sessionStates.values()).filter(
      (s) => s.state === 'processing'
    ).length;
    const waitingCount = Array.from(sessionStates.values()).filter(
      (s) => s.state === 'waiting'
    ).length;
    const totalQueued = Array.from(sessionStates.values()).reduce(
      (sum, s) => sum + s.queueDepth,
      0
    );
    const hasActivity =
      lastActivityAt > 0 ||
      webhookStats.received > 0 ||
      activeCount > 0 ||
      waitingCount > 0 ||
      totalQueued > 0;
    if (!hasActivity) {
      return;
    }
    if (now - lastActivityAt > 120_000 && activeCount === 0 && waitingCount === 0) {
      return;
    }

    diag.debug(
      `heartbeat: webhooks=${webhookStats.received}/${webhookStats.processed}/${webhookStats.errors} active=${activeCount} waiting=${waitingCount} queued=${totalQueued}`
    );
    emitDiagnosticEvent({
      type: 'diagnostic.heartbeat',
      webhooks: {
        received: webhookStats.received,
        processed: webhookStats.processed,
        errors: webhookStats.errors
      },
      active: activeCount,
      waiting: waitingCount,
      queued: totalQueued
    });

    for (const [, state] of sessionStates) {
      const ageMs = now - state.lastActivity;
      if (state.state === 'processing' && ageMs > 120_000) {
        logSessionStuck({
          sessionId: state.sessionId,
          sessionKey: state.sessionKey,
          state: state.state,
          ageMs
        });
      }
    }
  }, 30_000);
  heartbeatInterval.unref?.();
};

export const stopDiagnosticHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

export { diag as diagnosticLogger };
