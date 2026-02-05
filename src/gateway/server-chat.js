/** @module gateway/server-chat -- Chat message processing pipeline on the server side. */
import { normalizeVerboseLevel } from '../auto-reply/thinking.js';
import { loadConfig } from '../config/config.js';
import { getAgentRunContext } from '../infra/agent-events.js';
import { resolveHeartbeatVisibility } from '../infra/heartbeat-visibility.js';
import { loadSessionEntry } from './session-utils.js';
import { formatForLog } from './ws-log.js';
function shouldSuppressHeartbeatBroadcast(runId) {
  const runContext = getAgentRunContext(runId);
  if (!runContext?.isHeartbeat) {
    return false;
  }
  try {
    const cfg = loadConfig();
    const visibility = resolveHeartbeatVisibility({ cfg, channel: 'webchat' });
    return !visibility.showOk;
  } catch {
    return true;
  }
}
function createChatRunRegistry() {
  const chatRunSessions = /* @__PURE__ */ new Map();
  const add = (sessionId, entry) => {
    const queue = chatRunSessions.get(sessionId);
    if (queue) {
      queue.push(entry);
    } else {
      chatRunSessions.set(sessionId, [entry]);
    }
  };
  const peek = (sessionId) => chatRunSessions.get(sessionId)?.[0];
  const shift = (sessionId) => {
    const queue = chatRunSessions.get(sessionId);
    if (!queue || queue.length === 0) {
      return void 0;
    }
    const entry = queue.shift();
    if (!queue.length) {
      chatRunSessions.delete(sessionId);
    }
    return entry;
  };
  const remove = (sessionId, clientRunId, sessionKey) => {
    const queue = chatRunSessions.get(sessionId);
    if (!queue || queue.length === 0) {
      return void 0;
    }
    const idx = queue.findIndex(
      (entry2) => entry2.clientRunId === clientRunId && (sessionKey ? entry2.sessionKey === sessionKey : true)
    );
    if (idx < 0) {
      return void 0;
    }
    const [entry] = queue.splice(idx, 1);
    if (!queue.length) {
      chatRunSessions.delete(sessionId);
    }
    return entry;
  };
  const clear = () => {
    chatRunSessions.clear();
  };
  return { add, peek, shift, remove, clear };
}
function createChatRunState() {
  const registry = createChatRunRegistry();
  const buffers = /* @__PURE__ */ new Map();
  const deltaSentAt = /* @__PURE__ */ new Map();
  const abortedRuns = /* @__PURE__ */ new Map();
  const clear = () => {
    registry.clear();
    buffers.clear();
    deltaSentAt.clear();
    abortedRuns.clear();
  };
  return {
    registry,
    buffers,
    deltaSentAt,
    abortedRuns,
    clear
  };
}
const TOOL_EVENT_RECIPIENT_TTL_MS = 10 * 60 * 1e3;
const TOOL_EVENT_RECIPIENT_FINAL_GRACE_MS = 30 * 1e3;
function createToolEventRecipientRegistry() {
  const recipients = /* @__PURE__ */ new Map();
  const prune = () => {
    if (recipients.size === 0) {
      return;
    }
    const now = Date.now();
    for (const [runId, entry] of recipients) {
      const cutoff = entry.finalizedAt ? entry.finalizedAt + TOOL_EVENT_RECIPIENT_FINAL_GRACE_MS : entry.updatedAt + TOOL_EVENT_RECIPIENT_TTL_MS;
      if (now >= cutoff) {
        recipients.delete(runId);
      }
    }
  };
  const add = (runId, connId) => {
    if (!runId || !connId) {
      return;
    }
    const now = Date.now();
    const existing = recipients.get(runId);
    if (existing) {
      existing.connIds.add(connId);
      existing.updatedAt = now;
    } else {
      recipients.set(runId, {
        connIds: /* @__PURE__ */ new Set([connId]),
        updatedAt: now
      });
    }
    prune();
  };
  const get = (runId) => {
    const entry = recipients.get(runId);
    if (!entry) {
      return void 0;
    }
    entry.updatedAt = Date.now();
    prune();
    return entry.connIds;
  };
  const markFinal = (runId) => {
    const entry = recipients.get(runId);
    if (!entry) {
      return;
    }
    entry.finalizedAt = Date.now();
    prune();
  };
  return { add, get, markFinal };
}
function createAgentEventHandler({
  broadcast,
  broadcastToConnIds,
  nodeSendToSession,
  agentRunSeq,
  chatRunState,
  resolveSessionKeyForRun,
  clearAgentRunContext,
  toolEventRecipients
}) {
  const emitChatDelta = (sessionKey, clientRunId, seq, text) => {
    chatRunState.buffers.set(clientRunId, text);
    const now = Date.now();
    const last = chatRunState.deltaSentAt.get(clientRunId) ?? 0;
    if (now - last < 150) {
      return;
    }
    chatRunState.deltaSentAt.set(clientRunId, now);
    const payload = {
      runId: clientRunId,
      sessionKey,
      seq,
      state: 'delta',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text }],
        timestamp: now
      }
    };
    if (!shouldSuppressHeartbeatBroadcast(clientRunId)) {
      broadcast('chat', payload, { dropIfSlow: true });
    }
    nodeSendToSession(sessionKey, 'chat', payload);
  };
  const emitChatFinal = (sessionKey, clientRunId, seq, jobState, error) => {
    const text = chatRunState.buffers.get(clientRunId)?.trim() ?? '';
    chatRunState.buffers.delete(clientRunId);
    chatRunState.deltaSentAt.delete(clientRunId);
    if (jobState === 'done') {
      const payload2 = {
        runId: clientRunId,
        sessionKey,
        seq,
        state: 'final',
        message: text ? {
          role: 'assistant',
          content: [{ type: 'text', text }],
          timestamp: Date.now()
        } : void 0
      };
      if (!shouldSuppressHeartbeatBroadcast(clientRunId)) {
        broadcast('chat', payload2);
      }
      nodeSendToSession(sessionKey, 'chat', payload2);
      return;
    }
    const payload = {
      runId: clientRunId,
      sessionKey,
      seq,
      state: 'error',
      errorMessage: error ? formatForLog(error) : void 0
    };
    broadcast('chat', payload);
    nodeSendToSession(sessionKey, 'chat', payload);
  };
  const resolveToolVerboseLevel = (runId, sessionKey) => {
    const runContext = getAgentRunContext(runId);
    const runVerbose = normalizeVerboseLevel(runContext?.verboseLevel);
    if (runVerbose) {
      return runVerbose;
    }
    if (!sessionKey) {
      return 'off';
    }
    try {
      const { cfg, entry } = loadSessionEntry(sessionKey);
      const sessionVerbose = normalizeVerboseLevel(entry?.verboseLevel);
      if (sessionVerbose) {
        return sessionVerbose;
      }
      const defaultVerbose = normalizeVerboseLevel(cfg.agents?.defaults?.verboseDefault);
      return defaultVerbose ?? 'off';
    } catch {
      return 'off';
    }
  };
  return (evt) => {
    const chatLink = chatRunState.registry.peek(evt.runId);
    const sessionKey = chatLink?.sessionKey ?? resolveSessionKeyForRun(evt.runId);
    const clientRunId = chatLink?.clientRunId ?? evt.runId;
    const isAborted = chatRunState.abortedRuns.has(clientRunId) || chatRunState.abortedRuns.has(evt.runId);
    const agentPayload = sessionKey ? { ...evt, sessionKey } : evt;
    const last = agentRunSeq.get(evt.runId) ?? 0;
    const isToolEvent = evt.stream === 'tool';
    const toolVerbose = isToolEvent ? resolveToolVerboseLevel(evt.runId, sessionKey) : 'off';
    if (isToolEvent && toolVerbose === 'off') {
      agentRunSeq.set(evt.runId, evt.seq);
      return;
    }
    const toolPayload = isToolEvent && toolVerbose !== 'full' ? (() => {
      const data = evt.data ? { ...evt.data } : {};
      delete data.result;
      delete data.partialResult;
      return sessionKey ? { ...evt, sessionKey, data } : { ...evt, data };
    })() : agentPayload;
    if (evt.seq !== last + 1) {
      broadcast('agent', {
        runId: evt.runId,
        stream: 'error',
        ts: Date.now(),
        sessionKey,
        data: {
          reason: 'seq gap',
          expected: last + 1,
          received: evt.seq
        }
      });
    }
    agentRunSeq.set(evt.runId, evt.seq);
    if (isToolEvent) {
      const recipients = toolEventRecipients.get(evt.runId);
      if (recipients && recipients.size > 0) {
        broadcastToConnIds('agent', toolPayload, recipients);
      }
    } else {
      broadcast('agent', agentPayload);
    }
    const lifecyclePhase = evt.stream === 'lifecycle' && typeof evt.data?.phase === 'string' ? evt.data.phase : null;
    if (sessionKey) {
      nodeSendToSession(sessionKey, 'agent', isToolEvent ? toolPayload : agentPayload);
      if (!isAborted && evt.stream === 'assistant' && typeof evt.data?.text === 'string') {
        emitChatDelta(sessionKey, clientRunId, evt.seq, evt.data.text);
      } else if (!isAborted && (lifecyclePhase === 'end' || lifecyclePhase === 'error')) {
        if (chatLink) {
          const finished = chatRunState.registry.shift(evt.runId);
          if (!finished) {
            clearAgentRunContext(evt.runId);
            return;
          }
          emitChatFinal(
            finished.sessionKey,
            finished.clientRunId,
            evt.seq,
            lifecyclePhase === 'error' ? 'error' : 'done',
            evt.data?.error
          );
        } else {
          emitChatFinal(
            sessionKey,
            evt.runId,
            evt.seq,
            lifecyclePhase === 'error' ? 'error' : 'done',
            evt.data?.error
          );
        }
      } else if (isAborted && (lifecyclePhase === 'end' || lifecyclePhase === 'error')) {
        chatRunState.abortedRuns.delete(clientRunId);
        chatRunState.abortedRuns.delete(evt.runId);
        chatRunState.buffers.delete(clientRunId);
        chatRunState.deltaSentAt.delete(clientRunId);
        if (chatLink) {
          chatRunState.registry.remove(evt.runId, clientRunId, sessionKey);
        }
      }
    }
    if (lifecyclePhase === 'end' || lifecyclePhase === 'error') {
      toolEventRecipients.markFinal(evt.runId);
      clearAgentRunContext(evt.runId);
    }
  };
}
export {
  createAgentEventHandler,
  createChatRunRegistry,
  createChatRunState,
  createToolEventRecipientRegistry
};
