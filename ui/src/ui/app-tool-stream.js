import { truncateText } from './format.js';
const TOOL_STREAM_LIMIT = 50;
const TOOL_STREAM_THROTTLE_MS = 80;
const TOOL_OUTPUT_CHAR_LIMIT = 12e4;
function extractToolOutputText(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value;
  if (typeof record.text === 'string') {
    return record.text;
  }
  const content = record.content;
  if (!Array.isArray(content)) {
    return null;
  }
  const parts = content.map((item) => {
    if (!item || typeof item !== 'object') {
      return null;
    }
    const entry = item;
    if (entry.type === 'text' && typeof entry.text === 'string') {
      return entry.text;
    }
    return null;
  }).filter((part) => Boolean(part));
  if (parts.length === 0) {
    return null;
  }
  return parts.join('\n');
}
function formatToolOutput(value) {
  if (value === null || value === void 0) {
    return null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  const contentText = extractToolOutputText(value);
  let text;
  if (typeof value === 'string') {
    text = value;
  } else if (contentText) {
    text = contentText;
  } else {
    try {
      text = JSON.stringify(value, null, 2);
    } catch {
      text = String(value);
    }
  }
  const truncated = truncateText(text, TOOL_OUTPUT_CHAR_LIMIT);
  if (!truncated.truncated) {
    return truncated.text;
  }
  return `${truncated.text}

\u2026 truncated (${truncated.total} chars, showing first ${truncated.text.length}).`;
}
function buildToolStreamMessage(entry) {
  const content = [];
  content.push({
    type: 'toolcall',
    name: entry.name,
    arguments: entry.args ?? {}
  });
  if (entry.output) {
    content.push({
      type: 'toolresult',
      name: entry.name,
      text: entry.output
    });
  }
  return {
    role: 'assistant',
    toolCallId: entry.toolCallId,
    runId: entry.runId,
    content,
    timestamp: entry.startedAt
  };
}
function trimToolStream(host) {
  if (host.toolStreamOrder.length <= TOOL_STREAM_LIMIT) {
    return;
  }
  const overflow = host.toolStreamOrder.length - TOOL_STREAM_LIMIT;
  const removed = host.toolStreamOrder.splice(0, overflow);
  for (const id of removed) {
    host.toolStreamById.delete(id);
  }
}
function syncToolStreamMessages(host) {
  host.chatToolMessages = host.toolStreamOrder.map((id) => host.toolStreamById.get(id)?.message).filter((msg) => Boolean(msg));
}
function flushToolStreamSync(host) {
  if (host.toolStreamSyncTimer !== null && host.toolStreamSyncTimer !== undefined) {
    clearTimeout(host.toolStreamSyncTimer);
    host.toolStreamSyncTimer = null;
  }
  syncToolStreamMessages(host);
}
function scheduleToolStreamSync(host, force = false) {
  if (force) {
    flushToolStreamSync(host);
    return;
  }
  if (host.toolStreamSyncTimer !== null && host.toolStreamSyncTimer !== undefined) {
    return;
  }
  host.toolStreamSyncTimer = window.setTimeout(
    () => flushToolStreamSync(host),
    TOOL_STREAM_THROTTLE_MS
  );
}
function resetToolStream(host) {
  host.toolStreamById.clear();
  host.toolStreamOrder = [];
  host.chatToolMessages = [];
  flushToolStreamSync(host);
}
const COMPACTION_TOAST_DURATION_MS = 5e3;
function handleCompactionEvent(host, payload) {
  const data = payload.data ?? {};
  const phase = typeof data.phase === 'string' ? data.phase : '';
  if (host.compactionClearTimer !== null && host.compactionClearTimer !== undefined) {
    window.clearTimeout(host.compactionClearTimer);
    host.compactionClearTimer = null;
  }
  if (phase === 'start') {
    host.compactionStatus = {
      active: true,
      startedAt: Date.now(),
      completedAt: null
    };
  } else if (phase === 'end') {
    host.compactionStatus = {
      active: false,
      startedAt: host.compactionStatus?.startedAt ?? null,
      completedAt: Date.now()
    };
    host.compactionClearTimer = window.setTimeout(() => {
      host.compactionStatus = null;
      host.compactionClearTimer = null;
    }, COMPACTION_TOAST_DURATION_MS);
  }
}
function handleAgentEvent(host, payload) {
  if (!payload) {
    return;
  }
  if (payload.stream === 'compaction') {
    handleCompactionEvent(host, payload);
    return;
  }
  if (payload.stream !== 'tool') {
    return;
  }
  const sessionKey = typeof payload.sessionKey === 'string' ? payload.sessionKey : void 0;
  if (sessionKey && sessionKey !== host.sessionKey) {
    return;
  }
  if (!sessionKey && host.chatRunId && payload.runId !== host.chatRunId) {
    return;
  }
  if (host.chatRunId && payload.runId !== host.chatRunId) {
    return;
  }
  if (!host.chatRunId) {
    return;
  }
  const data = payload.data ?? {};
  const toolCallId = typeof data.toolCallId === 'string' ? data.toolCallId : '';
  if (!toolCallId) {
    return;
  }
  const name = typeof data.name === 'string' ? data.name : 'tool';
  const phase = typeof data.phase === 'string' ? data.phase : '';
  const args = phase === 'start' ? data.args : void 0;
  const output = phase === 'update' ? formatToolOutput(data.partialResult) : phase === 'result' ? formatToolOutput(data.result) : void 0;
  const now = Date.now();
  let entry = host.toolStreamById.get(toolCallId);
  if (!entry) {
    entry = {
      toolCallId,
      runId: payload.runId,
      sessionKey,
      name,
      args,
      output: output || void 0,
      startedAt: typeof payload.ts === 'number' ? payload.ts : now,
      updatedAt: now,
      message: {}
    };
    host.toolStreamById.set(toolCallId, entry);
    host.toolStreamOrder.push(toolCallId);
  } else {
    entry.name = name;
    if (args !== void 0) {
      entry.args = args;
    }
    if (output !== void 0) {
      entry.output = output || void 0;
    }
    entry.updatedAt = now;
  }
  entry.message = buildToolStreamMessage(entry);
  trimToolStream(host);
  scheduleToolStreamSync(host, phase === 'result');
}
export {
  flushToolStreamSync,
  handleAgentEvent,
  handleCompactionEvent,
  resetToolStream,
  scheduleToolStreamSync
};
