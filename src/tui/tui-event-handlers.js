import { asString, extractTextFromMessage, isCommandMessage } from './tui-formatters.js';
import { TuiStreamAssembler } from './tui-stream-assembler.js';
function createEventHandlers(context) {
  const {
    chatLog,
    tui,
    state,
    setActivityStatus,
    refreshSessionInfo,
    loadHistory,
    isLocalRunId,
    forgetLocalRunId,
    clearLocalRunIds
  } = context;
  const finalizedRuns = /* @__PURE__ */ new Map();
  const sessionRuns = /* @__PURE__ */ new Map();
  let streamAssembler = new TuiStreamAssembler();
  let lastSessionKey = state.currentSessionKey;
  const pruneRunMap = (runs) => {
    if (runs.size <= 200) {
      return;
    }
    const keepUntil = Date.now() - 10 * 60 * 1e3;
    for (const [key, ts] of runs) {
      if (runs.size <= 150) {
        break;
      }
      if (ts < keepUntil) {
        runs.delete(key);
      }
    }
    if (runs.size > 200) {
      for (const key of runs.keys()) {
        runs.delete(key);
        if (runs.size <= 150) {
          break;
        }
      }
    }
  };
  const syncSessionKey = () => {
    if (state.currentSessionKey === lastSessionKey) {
      return;
    }
    lastSessionKey = state.currentSessionKey;
    finalizedRuns.clear();
    sessionRuns.clear();
    streamAssembler = new TuiStreamAssembler();
    clearLocalRunIds?.();
  };
  const noteSessionRun = (runId) => {
    sessionRuns.set(runId, Date.now());
    pruneRunMap(sessionRuns);
  };
  const noteFinalizedRun = (runId) => {
    finalizedRuns.set(runId, Date.now());
    sessionRuns.delete(runId);
    streamAssembler.drop(runId);
    pruneRunMap(finalizedRuns);
  };
  const handleChatEvent = (payload) => {
    if (!payload || typeof payload !== 'object') {
      return;
    }
    const evt = payload;
    syncSessionKey();
    if (evt.sessionKey !== state.currentSessionKey) {
      return;
    }
    if (finalizedRuns.has(evt.runId)) {
      if (evt.state === 'delta') {
        return;
      }
      if (evt.state === 'final') {
        return;
      }
    }
    noteSessionRun(evt.runId);
    if (!state.activeChatRunId) {
      state.activeChatRunId = evt.runId;
    }
    if (evt.state === 'delta') {
      const displayText = streamAssembler.ingestDelta(evt.runId, evt.message, state.showThinking);
      if (!displayText) {
        return;
      }
      chatLog.updateAssistant(displayText, evt.runId);
      setActivityStatus('streaming');
    }
    if (evt.state === 'final') {
      if (isCommandMessage(evt.message)) {
        if (isLocalRunId?.(evt.runId)) {
          forgetLocalRunId?.(evt.runId);
        } else {
          void loadHistory?.();
        }
        const text = extractTextFromMessage(evt.message);
        if (text) {
          chatLog.addSystem(text);
        }
        streamAssembler.drop(evt.runId);
        noteFinalizedRun(evt.runId);
        state.activeChatRunId = null;
        setActivityStatus('idle');
        void refreshSessionInfo?.();
        tui.requestRender();
        return;
      }
      if (isLocalRunId?.(evt.runId)) {
        forgetLocalRunId?.(evt.runId);
      } else {
        void loadHistory?.();
      }
      const stopReason = evt.message && typeof evt.message === 'object' && !Array.isArray(evt.message) ? typeof evt.message.stopReason === 'string' ? evt.message.stopReason : '' : '';
      const finalText = streamAssembler.finalize(evt.runId, evt.message, state.showThinking);
      chatLog.finalizeAssistant(finalText, evt.runId);
      noteFinalizedRun(evt.runId);
      state.activeChatRunId = null;
      setActivityStatus(stopReason === 'error' ? 'error' : 'idle');
      void refreshSessionInfo?.();
    }
    if (evt.state === 'aborted') {
      chatLog.addSystem('run aborted');
      streamAssembler.drop(evt.runId);
      sessionRuns.delete(evt.runId);
      state.activeChatRunId = null;
      setActivityStatus('aborted');
      void refreshSessionInfo?.();
      if (isLocalRunId?.(evt.runId)) {
        forgetLocalRunId?.(evt.runId);
      } else {
        void loadHistory?.();
      }
    }
    if (evt.state === 'error') {
      chatLog.addSystem(`run error: ${evt.errorMessage ?? 'unknown'}`);
      streamAssembler.drop(evt.runId);
      sessionRuns.delete(evt.runId);
      state.activeChatRunId = null;
      setActivityStatus('error');
      void refreshSessionInfo?.();
      if (isLocalRunId?.(evt.runId)) {
        forgetLocalRunId?.(evt.runId);
      } else {
        void loadHistory?.();
      }
    }
    tui.requestRender();
  };
  const handleAgentEvent = (payload) => {
    if (!payload || typeof payload !== 'object') {
      return;
    }
    const evt = payload;
    syncSessionKey();
    const isActiveRun = evt.runId === state.activeChatRunId;
    const isKnownRun = isActiveRun || sessionRuns.has(evt.runId) || finalizedRuns.has(evt.runId);
    if (!isKnownRun) {
      return;
    }
    if (evt.stream === 'tool') {
      const verbose = state.sessionInfo.verboseLevel ?? 'off';
      const allowToolEvents = verbose !== 'off';
      const allowToolOutput = verbose === 'full';
      if (!allowToolEvents) {
        return;
      }
      const data = evt.data ?? {};
      const phase = asString(data.phase, '');
      const toolCallId = asString(data.toolCallId, '');
      const toolName = asString(data.name, 'tool');
      if (!toolCallId) {
        return;
      }
      if (phase === 'start') {
        chatLog.startTool(toolCallId, toolName, data.args);
      } else if (phase === 'update') {
        if (!allowToolOutput) {
          return;
        }
        chatLog.updateToolResult(toolCallId, data.partialResult, {
          partial: true
        });
      } else if (phase === 'result') {
        if (allowToolOutput) {
          chatLog.updateToolResult(toolCallId, data.result, {
            isError: Boolean(data.isError)
          });
        } else {
          chatLog.updateToolResult(toolCallId, { content: [] }, { isError: Boolean(data.isError) });
        }
      }
      tui.requestRender();
      return;
    }
    if (evt.stream === 'lifecycle') {
      if (!isActiveRun) {
        return;
      }
      const phase = typeof evt.data?.phase === 'string' ? evt.data.phase : '';
      if (phase === 'start') {
        setActivityStatus('running');
      }
      if (phase === 'end') {
        setActivityStatus('idle');
      }
      if (phase === 'error') {
        setActivityStatus('error');
      }
      tui.requestRender();
    }
  };
  return { handleChatEvent, handleAgentEvent };
}
export {
  createEventHandlers
};
