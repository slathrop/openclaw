import { parseAgentSessionKey } from '../../../src/sessions/session-key-utils.js';
import { scheduleChatScroll } from './app-scroll.js';
import { setLastActiveSessionKey } from './app-settings.js';
import { resetToolStream } from './app-tool-stream.js';
import { abortChatRun, loadChatHistory, sendChatMessage } from './controllers/chat.js';
import { loadSessions } from './controllers/sessions.js';
import { normalizeBasePath } from './navigation.js';
import { generateUUID } from './uuid.js';
const CHAT_SESSIONS_ACTIVE_MINUTES = 120;
function isChatBusy(host) {
  return host.chatSending || Boolean(host.chatRunId);
}
function isChatStopCommand(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  const normalized = trimmed.toLowerCase();
  if (normalized === '/stop') {
    return true;
  }
  return normalized === 'stop' || normalized === 'esc' || normalized === 'abort' || normalized === 'wait' || normalized === 'exit';
}
function isChatResetCommand(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  const normalized = trimmed.toLowerCase();
  if (normalized === '/new' || normalized === '/reset') {
    return true;
  }
  return normalized.startsWith('/new ') || normalized.startsWith('/reset ');
}
async function handleAbortChat(host) {
  if (!host.connected) {
    return;
  }
  host.chatMessage = '';
  await abortChatRun(host);
}
function enqueueChatMessage(host, text, attachments, refreshSessions) {
  const trimmed = text.trim();
  const hasAttachments = Boolean(attachments && attachments.length > 0);
  if (!trimmed && !hasAttachments) {
    return;
  }
  host.chatQueue = [
    ...host.chatQueue,
    {
      id: generateUUID(),
      text: trimmed,
      createdAt: Date.now(),
      attachments: hasAttachments ? attachments?.map((att) => ({ ...att })) : void 0,
      refreshSessions
    }
  ];
}
async function sendChatMessageNow(host, message, opts) {
  resetToolStream(host);
  const runId = await sendChatMessage(host, message, opts?.attachments);
  const ok = Boolean(runId);
  if (!ok && opts?.previousDraft !== null && opts?.previousDraft !== undefined) {
    host.chatMessage = opts.previousDraft;
  }
  if (!ok && opts?.previousAttachments) {
    host.chatAttachments = opts.previousAttachments;
  }
  if (ok) {
    setLastActiveSessionKey(
      host,
      host.sessionKey
    );
  }
  if (ok && opts?.restoreDraft && opts.previousDraft?.trim()) {
    host.chatMessage = opts.previousDraft;
  }
  if (ok && opts?.restoreAttachments && opts.previousAttachments?.length) {
    host.chatAttachments = opts.previousAttachments;
  }
  scheduleChatScroll(host);
  if (ok && !host.chatRunId) {
    void flushChatQueue(host);
  }
  if (ok && opts?.refreshSessions && runId) {
    host.refreshSessionsAfterChat.add(runId);
  }
  return ok;
}
async function flushChatQueue(host) {
  if (!host.connected || isChatBusy(host)) {
    return;
  }
  const [next, ...rest] = host.chatQueue;
  if (!next) {
    return;
  }
  host.chatQueue = rest;
  const ok = await sendChatMessageNow(host, next.text, {
    attachments: next.attachments,
    refreshSessions: next.refreshSessions
  });
  if (!ok) {
    host.chatQueue = [next, ...host.chatQueue];
  }
}
function removeQueuedMessage(host, id) {
  host.chatQueue = host.chatQueue.filter((item) => item.id !== id);
}
async function handleSendChat(host, messageOverride, opts) {
  if (!host.connected) {
    return;
  }
  const previousDraft = host.chatMessage;
  const message = (messageOverride ?? host.chatMessage).trim();
  const attachments = host.chatAttachments ?? [];
  const attachmentsToSend = messageOverride === null || messageOverride === undefined ? attachments : [];
  const hasAttachments = attachmentsToSend.length > 0;
  if (!message && !hasAttachments) {
    return;
  }
  if (isChatStopCommand(message)) {
    await handleAbortChat(host);
    return;
  }
  const refreshSessions = isChatResetCommand(message);
  if (messageOverride === null || messageOverride === undefined) {
    host.chatMessage = '';
    host.chatAttachments = [];
  }
  if (isChatBusy(host)) {
    enqueueChatMessage(host, message, attachmentsToSend, refreshSessions);
    return;
  }
  await sendChatMessageNow(host, message, {
    previousDraft: messageOverride === null || messageOverride === undefined ? previousDraft : void 0,
    restoreDraft: Boolean(messageOverride && opts?.restoreDraft),
    attachments: hasAttachments ? attachmentsToSend : void 0,
    previousAttachments: messageOverride === null || messageOverride === undefined ? attachments : void 0,
    restoreAttachments: Boolean(messageOverride && opts?.restoreDraft),
    refreshSessions
  });
}
async function refreshChat(host) {
  await Promise.all([
    loadChatHistory(host),
    loadSessions(host, {
      activeMinutes: CHAT_SESSIONS_ACTIVE_MINUTES
    }),
    refreshChatAvatar(host)
  ]);
  scheduleChatScroll(host);
}
const flushChatQueueForEvent = flushChatQueue;
function resolveAgentIdForSession(host) {
  const parsed = parseAgentSessionKey(host.sessionKey);
  if (parsed?.agentId) {
    return parsed.agentId;
  }
  const snapshot = host.hello?.snapshot;
  const fallback = snapshot?.sessionDefaults?.defaultAgentId?.trim();
  return fallback || 'main';
}
function buildAvatarMetaUrl(basePath, agentId) {
  const base = normalizeBasePath(basePath);
  const encoded = encodeURIComponent(agentId);
  return base ? `${base}/avatar/${encoded}?meta=1` : `/avatar/${encoded}?meta=1`;
}
async function refreshChatAvatar(host) {
  if (!host.connected) {
    host.chatAvatarUrl = null;
    return;
  }
  const agentId = resolveAgentIdForSession(host);
  if (!agentId) {
    host.chatAvatarUrl = null;
    return;
  }
  host.chatAvatarUrl = null;
  const url = buildAvatarMetaUrl(host.basePath, agentId);
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      host.chatAvatarUrl = null;
      return;
    }
    const data = await res.json();
    const avatarUrl = typeof data.avatarUrl === 'string' ? data.avatarUrl.trim() : '';
    host.chatAvatarUrl = avatarUrl || null;
  } catch {
    host.chatAvatarUrl = null;
  }
}
export {
  CHAT_SESSIONS_ACTIVE_MINUTES,
  flushChatQueueForEvent,
  handleAbortChat,
  handleSendChat,
  isChatBusy,
  isChatStopCommand,
  refreshChat,
  refreshChatAvatar,
  removeQueuedMessage
};
