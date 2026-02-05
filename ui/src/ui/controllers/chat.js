import { extractText } from '../chat/message-extract.js';
import { generateUUID } from '../uuid.js';
async function loadChatHistory(state) {
  if (!state.client || !state.connected) {
    return;
  }
  state.chatLoading = true;
  state.lastError = null;
  try {
    const res = await state.client.request(
      'chat.history',
      {
        sessionKey: state.sessionKey,
        limit: 200
      }
    );
    state.chatMessages = Array.isArray(res.messages) ? res.messages : [];
    state.chatThinkingLevel = res.thinkingLevel ?? null;
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.chatLoading = false;
  }
}
function dataUrlToBase64(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return null;
  }
  return { mimeType: match[1], content: match[2] };
}
async function sendChatMessage(state, message, attachments) {
  if (!state.client || !state.connected) {
    return null;
  }
  const msg = message.trim();
  const hasAttachments = attachments && attachments.length > 0;
  if (!msg && !hasAttachments) {
    return null;
  }
  const now = Date.now();
  const contentBlocks = [];
  if (msg) {
    contentBlocks.push({ type: 'text', text: msg });
  }
  if (hasAttachments) {
    for (const att of attachments) {
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: att.mimeType, data: att.dataUrl }
      });
    }
  }
  state.chatMessages = [
    ...state.chatMessages,
    {
      role: 'user',
      content: contentBlocks,
      timestamp: now
    }
  ];
  state.chatSending = true;
  state.lastError = null;
  const runId = generateUUID();
  state.chatRunId = runId;
  state.chatStream = '';
  state.chatStreamStartedAt = now;
  const apiAttachments = hasAttachments ? attachments.map((att) => {
    const parsed = dataUrlToBase64(att.dataUrl);
    if (!parsed) {
      return null;
    }
    return {
      type: 'image',
      mimeType: parsed.mimeType,
      content: parsed.content
    };
  }).filter((a) => a !== null) : void 0;
  try {
    await state.client.request('chat.send', {
      sessionKey: state.sessionKey,
      message: msg,
      deliver: false,
      idempotencyKey: runId,
      attachments: apiAttachments
    });
    return runId;
  } catch (err) {
    const error = String(err);
    state.chatRunId = null;
    state.chatStream = null;
    state.chatStreamStartedAt = null;
    state.lastError = error;
    state.chatMessages = [
      ...state.chatMessages,
      {
        role: 'assistant',
        content: [{ type: 'text', text: `Error: ${  error}` }],
        timestamp: Date.now()
      }
    ];
    return null;
  } finally {
    state.chatSending = false;
  }
}
async function abortChatRun(state) {
  if (!state.client || !state.connected) {
    return false;
  }
  const runId = state.chatRunId;
  try {
    await state.client.request(
      'chat.abort',
      runId ? { sessionKey: state.sessionKey, runId } : { sessionKey: state.sessionKey }
    );
    return true;
  } catch (err) {
    state.lastError = String(err);
    return false;
  }
}
function handleChatEvent(state, payload) {
  if (!payload) {
    return null;
  }
  if (payload.sessionKey !== state.sessionKey) {
    return null;
  }
  if (payload.runId && state.chatRunId && payload.runId !== state.chatRunId) {
    if (payload.state === 'final') {
      return 'final';
    }
    return null;
  }
  if (payload.state === 'delta') {
    const next = extractText(payload.message);
    if (typeof next === 'string') {
      const current = state.chatStream ?? '';
      if (!current || next.length >= current.length) {
        state.chatStream = next;
      }
    }
  } else if (payload.state === 'final') {
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
  } else if (payload.state === 'aborted') {
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
  } else if (payload.state === 'error') {
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
    state.lastError = payload.errorMessage ?? 'chat error';
  }
  return payload.state;
}
export {
  abortChatRun,
  handleChatEvent,
  loadChatHistory,
  sendChatMessage
};
