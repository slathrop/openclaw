/** @module gateway/server-methods/agent-job -- Agent job execution and lifecycle management. */
import { onAgentEvent } from '../../infra/agent-events.js';
const AGENT_RUN_CACHE_TTL_MS = 10 * 6e4;
const agentRunCache = /* @__PURE__ */ new Map();
const agentRunStarts = /* @__PURE__ */ new Map();
let agentRunListenerStarted = false;
function pruneAgentRunCache(now = Date.now()) {
  for (const [runId, entry] of agentRunCache) {
    if (now - entry.ts > AGENT_RUN_CACHE_TTL_MS) {
      agentRunCache.delete(runId);
    }
  }
}
function recordAgentRunSnapshot(entry) {
  pruneAgentRunCache(entry.ts);
  agentRunCache.set(entry.runId, entry);
}
function ensureAgentRunListener() {
  if (agentRunListenerStarted) {
    return;
  }
  agentRunListenerStarted = true;
  onAgentEvent((evt) => {
    if (!evt) {
      return;
    }
    if (evt.stream !== 'lifecycle') {
      return;
    }
    const phase = evt.data?.phase;
    if (phase === 'start') {
      const startedAt2 = typeof evt.data?.startedAt === 'number' ? evt.data.startedAt : void 0;
      agentRunStarts.set(evt.runId, startedAt2 ?? Date.now());
      return;
    }
    if (phase !== 'end' && phase !== 'error') {
      return;
    }
    const startedAt = typeof evt.data?.startedAt === 'number' ? evt.data.startedAt : agentRunStarts.get(evt.runId);
    const endedAt = typeof evt.data?.endedAt === 'number' ? evt.data.endedAt : void 0;
    const error = typeof evt.data?.error === 'string' ? evt.data.error : void 0;
    agentRunStarts.delete(evt.runId);
    recordAgentRunSnapshot({
      runId: evt.runId,
      status: phase === 'error' ? 'error' : 'ok',
      startedAt,
      endedAt,
      error,
      ts: Date.now()
    });
  });
}
function getCachedAgentRun(runId) {
  pruneAgentRunCache();
  return agentRunCache.get(runId);
}
async function waitForAgentJob(params) {
  const { runId, timeoutMs } = params;
  ensureAgentRunListener();
  const cached = getCachedAgentRun(runId);
  if (cached) {
    return cached;
  }
  if (timeoutMs <= 0) {
    return null;
  }
  return await new Promise((resolve) => {
    let settled = false;
    const finish = (entry) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(entry);
    };
    const unsubscribe = onAgentEvent((evt) => {
      if (!evt || evt.stream !== 'lifecycle') {
        return;
      }
      if (evt.runId !== runId) {
        return;
      }
      const phase = evt.data?.phase;
      if (phase !== 'end' && phase !== 'error') {
        return;
      }
      const cached2 = getCachedAgentRun(runId);
      if (cached2) {
        finish(cached2);
        return;
      }
      const startedAt = typeof evt.data?.startedAt === 'number' ? evt.data.startedAt : agentRunStarts.get(evt.runId);
      const endedAt = typeof evt.data?.endedAt === 'number' ? evt.data.endedAt : void 0;
      const error = typeof evt.data?.error === 'string' ? evt.data.error : void 0;
      const snapshot = {
        runId: evt.runId,
        status: phase === 'error' ? 'error' : 'ok',
        startedAt,
        endedAt,
        error,
        ts: Date.now()
      };
      recordAgentRunSnapshot(snapshot);
      finish(snapshot);
    });
    const timer = setTimeout(() => finish(null), Math.max(1, timeoutMs));
  });
}
ensureAgentRunListener();
export {
  waitForAgentJob
};
