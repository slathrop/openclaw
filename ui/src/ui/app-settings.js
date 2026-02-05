import { refreshChat } from './app-chat.js';
import {
  startLogsPolling,
  stopLogsPolling,
  startDebugPolling,
  stopDebugPolling
} from './app-polling.js';
import { scheduleChatScroll, scheduleLogsScroll } from './app-scroll.js';
import { loadAgentIdentities, loadAgentIdentity } from './controllers/agent-identity.js';
import { loadAgentSkills } from './controllers/agent-skills.js';
import { loadAgents } from './controllers/agents.js';
import { loadChannels } from './controllers/channels.js';
import { loadConfig, loadConfigSchema } from './controllers/config.js';
import { loadCronJobs, loadCronStatus } from './controllers/cron.js';
import { loadDebug } from './controllers/debug.js';
import { loadDevices } from './controllers/devices.js';
import { loadExecApprovals } from './controllers/exec-approvals.js';
import { loadLogs } from './controllers/logs.js';
import { loadNodes } from './controllers/nodes.js';
import { loadPresence } from './controllers/presence.js';
import { loadSessions } from './controllers/sessions.js';
import { loadSkills } from './controllers/skills.js';
import {
  inferBasePathFromPathname,
  normalizeBasePath,
  normalizePath,
  pathForTab,
  tabFromPath
} from './navigation.js';
import { saveSettings } from './storage.js';
import { startThemeTransition } from './theme-transition.js';
import { resolveTheme } from './theme.js';
function isTopLevelWindow() {
  try {
    return window.top === window.self;
  } catch {
    return false;
  }
}
function normalizeGatewayUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}
function applySettings(host, next) {
  const normalized = {
    ...next,
    lastActiveSessionKey: next.lastActiveSessionKey?.trim() || next.sessionKey.trim() || 'main'
  };
  host.settings = normalized;
  saveSettings(normalized);
  if (next.theme !== host.theme) {
    host.theme = next.theme;
    applyResolvedTheme(host, resolveTheme(next.theme));
  }
  host.applySessionKey = host.settings.lastActiveSessionKey;
}
function setLastActiveSessionKey(host, next) {
  const trimmed = next.trim();
  if (!trimmed) {
    return;
  }
  if (host.settings.lastActiveSessionKey === trimmed) {
    return;
  }
  applySettings(host, { ...host.settings, lastActiveSessionKey: trimmed });
}
function applySettingsFromUrl(host) {
  if (!window.location.search) {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const tokenRaw = params.get('token');
  const passwordRaw = params.get('password');
  const sessionRaw = params.get('session');
  const gatewayUrlRaw = params.get('gatewayUrl');
  let shouldCleanUrl = false;
  if (tokenRaw !== null && tokenRaw !== undefined) {
    const token = tokenRaw.trim();
    if (token && token !== host.settings.token) {
      applySettings(host, { ...host.settings, token });
    }
    params.delete('token');
    shouldCleanUrl = true;
  }
  if (passwordRaw !== null && passwordRaw !== undefined) {
    const password = passwordRaw.trim();
    if (password) {
      host.password = password;
    }
    params.delete('password');
    shouldCleanUrl = true;
  }
  if (sessionRaw !== null && sessionRaw !== undefined) {
    const session = sessionRaw.trim();
    if (session) {
      host.sessionKey = session;
      applySettings(host, {
        ...host.settings,
        sessionKey: session,
        lastActiveSessionKey: session
      });
    }
  }
  if (gatewayUrlRaw !== null && gatewayUrlRaw !== undefined) {
    const gatewayUrl = normalizeGatewayUrl(gatewayUrlRaw);
    if (gatewayUrl && gatewayUrl !== host.settings.gatewayUrl && isTopLevelWindow()) {
      host.pendingGatewayUrl = gatewayUrl;
    }
    params.delete('gatewayUrl');
    shouldCleanUrl = true;
  }
  if (!shouldCleanUrl) {
    return;
  }
  const url = new URL(window.location.href);
  url.search = params.toString();
  window.history.replaceState({}, '', url.toString());
}
function setTab(host, next) {
  if (host.tab !== next) {
    host.tab = next;
  }
  if (next === 'chat') {
    host.chatHasAutoScrolled = false;
  }
  if (next === 'logs') {
    startLogsPolling(host);
  } else {
    stopLogsPolling(host);
  }
  if (next === 'debug') {
    startDebugPolling(host);
  } else {
    stopDebugPolling(host);
  }
  void refreshActiveTab(host);
  syncUrlWithTab(host, next, false);
}
function setTheme(host, next, context) {
  const applyTheme = () => {
    host.theme = next;
    applySettings(host, { ...host.settings, theme: next });
    applyResolvedTheme(host, resolveTheme(next));
  };
  startThemeTransition({
    nextTheme: next,
    applyTheme,
    context,
    currentTheme: host.theme
  });
}
async function refreshActiveTab(host) {
  if (host.tab === 'overview') {
    await loadOverview(host);
  }
  if (host.tab === 'channels') {
    await loadChannelsTab(host);
  }
  if (host.tab === 'instances') {
    await loadPresence(host);
  }
  if (host.tab === 'sessions') {
    await loadSessions(host);
  }
  if (host.tab === 'cron') {
    await loadCron(host);
  }
  if (host.tab === 'skills') {
    await loadSkills(host);
  }
  if (host.tab === 'agents') {
    const app = host;
    await loadAgents(app);
    await loadConfig(app);
    const agentIds = app.agentsList?.agents?.map((entry) => entry.id) ?? [];
    if (agentIds.length > 0) {
      void loadAgentIdentities(app, agentIds);
    }
    const agentId = app.agentsSelectedId ?? app.agentsList?.defaultId ?? app.agentsList?.agents?.[0]?.id;
    if (agentId) {
      void loadAgentIdentity(app, agentId);
      if (app.agentsPanel === 'skills') {
        void loadAgentSkills(app, agentId);
      }
      if (app.agentsPanel === 'channels') {
        void loadChannels(app, false);
      }
      if (app.agentsPanel === 'cron') {
        void loadCron(host);
      }
    }
  }
  if (host.tab === 'nodes') {
    await loadNodes(host);
    await loadDevices(host);
    await loadConfig(host);
    await loadExecApprovals(host);
  }
  if (host.tab === 'chat') {
    await refreshChat(host);
    scheduleChatScroll(
      host,
      !host.chatHasAutoScrolled
    );
  }
  if (host.tab === 'config') {
    await loadConfigSchema(host);
    await loadConfig(host);
  }
  if (host.tab === 'debug') {
    await loadDebug(host);
    host.eventLog = host.eventLogBuffer;
  }
  if (host.tab === 'logs') {
    host.logsAtBottom = true;
    await loadLogs(host, { reset: true });
    scheduleLogsScroll(host, true);
  }
}
function inferBasePath() {
  if (typeof window === 'undefined') {
    return '';
  }
  const configured = window.__OPENCLAW_CONTROL_UI_BASE_PATH__;
  if (typeof configured === 'string' && configured.trim()) {
    return normalizeBasePath(configured);
  }
  return inferBasePathFromPathname(window.location.pathname);
}
function syncThemeWithSettings(host) {
  host.theme = host.settings.theme ?? 'system';
  applyResolvedTheme(host, resolveTheme(host.theme));
}
function applyResolvedTheme(host, resolved) {
  host.themeResolved = resolved;
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}
function attachThemeListener(host) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return;
  }
  host.themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  host.themeMediaHandler = (event) => {
    if (host.theme !== 'system') {
      return;
    }
    applyResolvedTheme(host, event.matches ? 'dark' : 'light');
  };
  if (typeof host.themeMedia.addEventListener === 'function') {
    host.themeMedia.addEventListener('change', host.themeMediaHandler);
    return;
  }
  const legacy = host.themeMedia;
  legacy.addListener(host.themeMediaHandler);
}
function detachThemeListener(host) {
  if (!host.themeMedia || !host.themeMediaHandler) {
    return;
  }
  if (typeof host.themeMedia.removeEventListener === 'function') {
    host.themeMedia.removeEventListener('change', host.themeMediaHandler);
    return;
  }
  const legacy = host.themeMedia;
  legacy.removeListener(host.themeMediaHandler);
  host.themeMedia = null;
  host.themeMediaHandler = null;
}
function syncTabWithLocation(host, replace) {
  if (typeof window === 'undefined') {
    return;
  }
  const resolved = tabFromPath(window.location.pathname, host.basePath) ?? 'chat';
  setTabFromRoute(host, resolved);
  syncUrlWithTab(host, resolved, replace);
}
function onPopState(host) {
  if (typeof window === 'undefined') {
    return;
  }
  const resolved = tabFromPath(window.location.pathname, host.basePath);
  if (!resolved) {
    return;
  }
  const url = new URL(window.location.href);
  const session = url.searchParams.get('session')?.trim();
  if (session) {
    host.sessionKey = session;
    applySettings(host, {
      ...host.settings,
      sessionKey: session,
      lastActiveSessionKey: session
    });
  }
  setTabFromRoute(host, resolved);
}
function setTabFromRoute(host, next) {
  if (host.tab !== next) {
    host.tab = next;
  }
  if (next === 'chat') {
    host.chatHasAutoScrolled = false;
  }
  if (next === 'logs') {
    startLogsPolling(host);
  } else {
    stopLogsPolling(host);
  }
  if (next === 'debug') {
    startDebugPolling(host);
  } else {
    stopDebugPolling(host);
  }
  if (host.connected) {
    void refreshActiveTab(host);
  }
}
function syncUrlWithTab(host, tab, replace) {
  if (typeof window === 'undefined') {
    return;
  }
  const targetPath = normalizePath(pathForTab(tab, host.basePath));
  const currentPath = normalizePath(window.location.pathname);
  const url = new URL(window.location.href);
  if (tab === 'chat' && host.sessionKey) {
    url.searchParams.set('session', host.sessionKey);
  } else {
    url.searchParams.delete('session');
  }
  if (currentPath !== targetPath) {
    url.pathname = targetPath;
  }
  if (replace) {
    window.history.replaceState({}, '', url.toString());
  } else {
    window.history.pushState({}, '', url.toString());
  }
}
function syncUrlWithSessionKey(sessionKey, replace) {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('session', sessionKey);
  if (replace) {
    window.history.replaceState({}, '', url.toString());
  } else {
    window.history.pushState({}, '', url.toString());
  }
}
async function loadOverview(host) {
  await Promise.all([
    loadChannels(host, false),
    loadPresence(host),
    loadSessions(host),
    loadCronStatus(host),
    loadDebug(host)
  ]);
}
async function loadChannelsTab(host) {
  await Promise.all([
    loadChannels(host, true),
    loadConfigSchema(host),
    loadConfig(host)
  ]);
}
async function loadCron(host) {
  await Promise.all([
    loadChannels(host, false),
    loadCronStatus(host),
    loadCronJobs(host)
  ]);
}
export {
  applyResolvedTheme,
  applySettings,
  applySettingsFromUrl,
  attachThemeListener,
  detachThemeListener,
  inferBasePath,
  loadChannelsTab,
  loadCron,
  loadOverview,
  onPopState,
  refreshActiveTab,
  setLastActiveSessionKey,
  setTab,
  setTabFromRoute,
  setTheme,
  syncTabWithLocation,
  syncThemeWithSettings,
  syncUrlWithSessionKey,
  syncUrlWithTab
};
