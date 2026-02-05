import { CHAT_SESSIONS_ACTIVE_MINUTES, flushChatQueueForEvent } from './app-chat.js';
import {
  applySettings,
  loadCron,
  refreshActiveTab,
  setLastActiveSessionKey
} from './app-settings.js';
import { handleAgentEvent, resetToolStream } from './app-tool-stream.js';
import { loadAgents } from './controllers/agents.js';
import { loadAssistantIdentity } from './controllers/assistant-identity.js';
import { loadChatHistory } from './controllers/chat.js';
import { handleChatEvent } from './controllers/chat.js';
import { loadDevices } from './controllers/devices.js';
import {
  addExecApproval,
  parseExecApprovalRequested,
  parseExecApprovalResolved,
  removeExecApproval
} from './controllers/exec-approval.js';
import { loadNodes } from './controllers/nodes.js';
import { loadSessions } from './controllers/sessions.js';
import { GatewayBrowserClient } from './gateway.js';
function normalizeSessionKeyForDefaults(value, defaults) {
  const raw = (value ?? '').trim();
  const mainSessionKey = defaults.mainSessionKey?.trim();
  if (!mainSessionKey) {
    return raw;
  }
  if (!raw) {
    return mainSessionKey;
  }
  const mainKey = defaults.mainKey?.trim() || 'main';
  const defaultAgentId = defaults.defaultAgentId?.trim();
  const isAlias = raw === 'main' || raw === mainKey || defaultAgentId && (raw === `agent:${defaultAgentId}:main` || raw === `agent:${defaultAgentId}:${mainKey}`);
  return isAlias ? mainSessionKey : raw;
}
function applySessionDefaults(host, defaults) {
  if (!defaults?.mainSessionKey) {
    return;
  }
  const resolvedSessionKey = normalizeSessionKeyForDefaults(host.sessionKey, defaults);
  const resolvedSettingsSessionKey = normalizeSessionKeyForDefaults(
    host.settings.sessionKey,
    defaults
  );
  const resolvedLastActiveSessionKey = normalizeSessionKeyForDefaults(
    host.settings.lastActiveSessionKey,
    defaults
  );
  const nextSessionKey = resolvedSessionKey || resolvedSettingsSessionKey || host.sessionKey;
  const nextSettings = {
    ...host.settings,
    sessionKey: resolvedSettingsSessionKey || nextSessionKey,
    lastActiveSessionKey: resolvedLastActiveSessionKey || nextSessionKey
  };
  const shouldUpdateSettings = nextSettings.sessionKey !== host.settings.sessionKey || nextSettings.lastActiveSessionKey !== host.settings.lastActiveSessionKey;
  if (nextSessionKey !== host.sessionKey) {
    host.sessionKey = nextSessionKey;
  }
  if (shouldUpdateSettings) {
    applySettings(host, nextSettings);
  }
}
function connectGateway(host) {
  host.lastError = null;
  host.hello = null;
  host.connected = false;
  host.execApprovalQueue = [];
  host.execApprovalError = null;
  host.client?.stop();
  host.client = new GatewayBrowserClient({
    url: host.settings.gatewayUrl,
    token: host.settings.token.trim() ? host.settings.token : void 0,
    password: host.password.trim() ? host.password : void 0,
    clientName: 'openclaw-control-ui',
    mode: 'webchat',
    onHello: (hello) => {
      host.connected = true;
      host.lastError = null;
      host.hello = hello;
      applySnapshot(host, hello);
      host.chatRunId = null;
      host.chatStream = null;
      host.chatStreamStartedAt = null;
      resetToolStream(host);
      void loadAssistantIdentity(host);
      void loadAgents(host);
      void loadNodes(host, { quiet: true });
      void loadDevices(host, { quiet: true });
      void refreshActiveTab(host);
    },
    onClose: ({ code, reason }) => {
      host.connected = false;
      if (code !== 1012) {
        host.lastError = `disconnected (${code}): ${reason || 'no reason'}`;
      }
    },
    onEvent: (evt) => handleGatewayEvent(host, evt),
    onGap: ({ expected, received }) => {
      host.lastError = `event gap detected (expected seq ${expected}, got ${received}); refresh recommended`;
    }
  });
  host.client.start();
}
function handleGatewayEvent(host, evt) {
  try {
    handleGatewayEventUnsafe(host, evt);
  } catch (err) {
    console.error('[gateway] handleGatewayEvent error:', evt.event, err);
  }
}
function handleGatewayEventUnsafe(host, evt) {
  host.eventLogBuffer = [
    { ts: Date.now(), event: evt.event, payload: evt.payload },
    ...host.eventLogBuffer
  ].slice(0, 250);
  if (host.tab === 'debug') {
    host.eventLog = host.eventLogBuffer;
  }
  if (evt.event === 'agent') {
    if (host.onboarding) {
      return;
    }
    handleAgentEvent(
      host,
      evt.payload
    );
    return;
  }
  if (evt.event === 'chat') {
    const payload = evt.payload;
    if (payload?.sessionKey) {
      setLastActiveSessionKey(
        host,
        payload.sessionKey
      );
    }
    const state = handleChatEvent(host, payload);
    if (state === 'final' || state === 'error' || state === 'aborted') {
      resetToolStream(host);
      void flushChatQueueForEvent(host);
      const runId = payload?.runId;
      if (runId && host.refreshSessionsAfterChat.has(runId)) {
        host.refreshSessionsAfterChat.delete(runId);
        if (state === 'final') {
          void loadSessions(host, {
            activeMinutes: CHAT_SESSIONS_ACTIVE_MINUTES
          });
        }
      }
    }
    if (state === 'final') {
      void loadChatHistory(host);
    }
    return;
  }
  if (evt.event === 'presence') {
    const payload = evt.payload;
    if (payload?.presence && Array.isArray(payload.presence)) {
      host.presenceEntries = payload.presence;
      host.presenceError = null;
      host.presenceStatus = null;
    }
    return;
  }
  if (evt.event === 'cron' && host.tab === 'cron') {
    void loadCron(host);
  }
  if (evt.event === 'device.pair.requested' || evt.event === 'device.pair.resolved') {
    void loadDevices(host, { quiet: true });
  }
  if (evt.event === 'exec.approval.requested') {
    const entry = parseExecApprovalRequested(evt.payload);
    if (entry) {
      host.execApprovalQueue = addExecApproval(host.execApprovalQueue, entry);
      host.execApprovalError = null;
      const delay = Math.max(0, entry.expiresAtMs - Date.now() + 500);
      window.setTimeout(() => {
        host.execApprovalQueue = removeExecApproval(host.execApprovalQueue, entry.id);
      }, delay);
    }
    return;
  }
  if (evt.event === 'exec.approval.resolved') {
    const resolved = parseExecApprovalResolved(evt.payload);
    if (resolved) {
      host.execApprovalQueue = removeExecApproval(host.execApprovalQueue, resolved.id);
    }
  }
}
function applySnapshot(host, hello) {
  const snapshot = hello.snapshot;
  if (snapshot?.presence && Array.isArray(snapshot.presence)) {
    host.presenceEntries = snapshot.presence;
  }
  if (snapshot?.health) {
    host.debugHealth = snapshot.health;
  }
  if (snapshot?.sessionDefaults) {
    applySessionDefaults(host, snapshot.sessionDefaults);
  }
}
export {
  applySnapshot,
  connectGateway,
  handleGatewayEvent
};
