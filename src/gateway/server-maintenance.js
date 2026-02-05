/** @module gateway/server-maintenance -- Maintenance mode handler for the gateway. */
import { abortChatRunById } from './chat-abort.js';
import {
  DEDUPE_MAX,
  DEDUPE_TTL_MS,
  HEALTH_REFRESH_INTERVAL_MS,
  TICK_INTERVAL_MS
} from './server-constants.js';
import { formatError } from './server-utils.js';
import { setBroadcastHealthUpdate } from './server/health-state.js';
function startGatewayMaintenanceTimers(params) {
  setBroadcastHealthUpdate((snap) => {
    params.broadcast('health', snap, {
      stateVersion: {
        presence: params.getPresenceVersion(),
        health: params.getHealthVersion()
      }
    });
    params.nodeSendToAllSubscribed('health', snap);
  });
  const tickInterval = setInterval(() => {
    const payload = { ts: Date.now() };
    params.broadcast('tick', payload, { dropIfSlow: true });
    params.nodeSendToAllSubscribed('tick', payload);
  }, TICK_INTERVAL_MS);
  const healthInterval = setInterval(() => {
    void params.refreshGatewayHealthSnapshot({ probe: true }).catch((err) => params.logHealth.error(`refresh failed: ${formatError(err)}`));
  }, HEALTH_REFRESH_INTERVAL_MS);
  void params.refreshGatewayHealthSnapshot({ probe: true }).catch((err) => params.logHealth.error(`initial refresh failed: ${formatError(err)}`));
  const dedupeCleanup = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of params.dedupe) {
      if (now - v.ts > DEDUPE_TTL_MS) {
        params.dedupe.delete(k);
      }
    }
    if (params.dedupe.size > DEDUPE_MAX) {
      const entries = [...params.dedupe.entries()].toSorted((a, b) => a[1].ts - b[1].ts);
      for (let i = 0; i < params.dedupe.size - DEDUPE_MAX; i++) {
        params.dedupe.delete(entries[i][0]);
      }
    }
    for (const [runId, entry] of params.chatAbortControllers) {
      if (now <= entry.expiresAtMs) {
        continue;
      }
      abortChatRunById(
        {
          chatAbortControllers: params.chatAbortControllers,
          chatRunBuffers: params.chatRunBuffers,
          chatDeltaSentAt: params.chatDeltaSentAt,
          chatAbortedRuns: params.chatRunState.abortedRuns,
          removeChatRun: params.removeChatRun,
          agentRunSeq: params.agentRunSeq,
          broadcast: params.broadcast,
          nodeSendToSession: params.nodeSendToSession
        },
        { runId, sessionKey: entry.sessionKey, stopReason: 'timeout' }
      );
    }
    const ABORTED_RUN_TTL_MS = 60 * 6e4;
    for (const [runId, abortedAt] of params.chatRunState.abortedRuns) {
      if (now - abortedAt <= ABORTED_RUN_TTL_MS) {
        continue;
      }
      params.chatRunState.abortedRuns.delete(runId);
      params.chatRunBuffers.delete(runId);
      params.chatDeltaSentAt.delete(runId);
    }
  }, 6e4);
  return { tickInterval, healthInterval, dedupeCleanup };
}
export {
  startGatewayMaintenanceTimers
};
