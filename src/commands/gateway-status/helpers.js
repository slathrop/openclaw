const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { resolveGatewayPort } from '../../config/config.js';
import { pickPrimaryTailnetIPv4 } from '../../infra/tailnet.js';
import { colorize, theme } from '../../terminal/theme.js';
function parseIntOrNull(value) {
  const s = typeof value === 'string' ? value.trim() : typeof value === 'number' || typeof value === 'bigint' ? String(value) : '';
  if (!s) {
    return null;
  }
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
__name(parseIntOrNull, 'parseIntOrNull');
function parseTimeoutMs(raw, fallbackMs) {
  const value = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' || typeof raw === 'bigint' ? String(raw) : '';
  if (!value) {
    return fallbackMs;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`invalid --timeout: ${value}`);
  }
  return parsed;
}
__name(parseTimeoutMs, 'parseTimeoutMs');
function normalizeWsUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!trimmed.startsWith('ws://') && !trimmed.startsWith('wss://')) {
    return null;
  }
  return trimmed;
}
__name(normalizeWsUrl, 'normalizeWsUrl');
function resolveTargets(cfg, explicitUrl) {
  const targets = [];
  const add = /* @__PURE__ */ __name((t) => {
    if (!targets.some((x) => x.url === t.url)) {
      targets.push(t);
    }
  }, 'add');
  const explicit = typeof explicitUrl === 'string' ? normalizeWsUrl(explicitUrl) : null;
  if (explicit) {
    add({ id: 'explicit', kind: 'explicit', url: explicit, active: true });
  }
  const remoteUrl = typeof cfg.gateway?.remote?.url === 'string' ? normalizeWsUrl(cfg.gateway.remote.url) : null;
  if (remoteUrl) {
    add({
      id: 'configRemote',
      kind: 'configRemote',
      url: remoteUrl,
      active: cfg.gateway?.mode === 'remote'
    });
  }
  const port = resolveGatewayPort(cfg);
  add({
    id: 'localLoopback',
    kind: 'localLoopback',
    url: `ws://127.0.0.1:${port}`,
    active: cfg.gateway?.mode !== 'remote'
  });
  return targets;
}
__name(resolveTargets, 'resolveTargets');
function resolveProbeBudgetMs(overallMs, kind) {
  if (kind === 'localLoopback') {
    return Math.min(800, overallMs);
  }
  if (kind === 'sshTunnel') {
    return Math.min(2e3, overallMs);
  }
  return Math.min(1500, overallMs);
}
__name(resolveProbeBudgetMs, 'resolveProbeBudgetMs');
function sanitizeSshTarget(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/^ssh\\s+/, '');
}
__name(sanitizeSshTarget, 'sanitizeSshTarget');
function resolveAuthForTarget(cfg, target, overrides) {
  const tokenOverride = overrides.token?.trim() ? overrides.token.trim() : void 0;
  const passwordOverride = overrides.password?.trim() ? overrides.password.trim() : void 0;
  if (tokenOverride || passwordOverride) {
    return { token: tokenOverride, password: passwordOverride };
  }
  if (target.kind === 'configRemote' || target.kind === 'sshTunnel') {
    const token = typeof cfg.gateway?.remote?.token === 'string' ? cfg.gateway.remote.token.trim() : '';
    const remotePassword = cfg.gateway?.remote?.password;
    const password = typeof remotePassword === 'string' ? remotePassword.trim() : '';
    return {
      token: token.length > 0 ? token : void 0,
      password: password.length > 0 ? password : void 0
    };
  }
  const envToken = process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || '';
  const envPassword = process.env.OPENCLAW_GATEWAY_PASSWORD?.trim() || '';
  const cfgToken = typeof cfg.gateway?.auth?.token === 'string' ? cfg.gateway.auth.token.trim() : '';
  const cfgPassword = typeof cfg.gateway?.auth?.password === 'string' ? cfg.gateway.auth.password.trim() : '';
  return {
    token: envToken || cfgToken || void 0,
    password: envPassword || cfgPassword || void 0
  };
}
__name(resolveAuthForTarget, 'resolveAuthForTarget');
function pickGatewaySelfPresence(presence) {
  if (!Array.isArray(presence)) {
    return null;
  }
  const entries = presence;
  const self = entries.find((e) => e.mode === 'gateway' && e.reason === 'self') ?? entries.find((e) => typeof e.text === 'string' && String(e.text).startsWith('Gateway:')) ?? null;
  if (!self) {
    return null;
  }
  return {
    host: typeof self.host === 'string' ? self.host : void 0,
    ip: typeof self.ip === 'string' ? self.ip : void 0,
    version: typeof self.version === 'string' ? self.version : void 0,
    platform: typeof self.platform === 'string' ? self.platform : void 0
  };
}
__name(pickGatewaySelfPresence, 'pickGatewaySelfPresence');
function extractConfigSummary(snapshotUnknown) {
  const snap = snapshotUnknown;
  const path = typeof snap?.path === 'string' ? snap.path : null;
  const exists = Boolean(snap?.exists);
  const valid = Boolean(snap?.valid);
  const issuesRaw = Array.isArray(snap?.issues) ? snap.issues : [];
  const legacyRaw = Array.isArray(snap?.legacyIssues) ? snap.legacyIssues : [];
  const cfg = snap?.config ?? {};
  const gateway = cfg.gateway ?? {};
  const discovery = cfg.discovery ?? {};
  const wideArea = discovery.wideArea ?? {};
  const remote = gateway.remote ?? {};
  const auth = gateway.auth ?? {};
  const controlUi = gateway.controlUi ?? {};
  const tailscale = gateway.tailscale ?? {};
  const authMode = typeof auth.mode === 'string' ? auth.mode : null;
  const authTokenConfigured = typeof auth.token === 'string' ? auth.token.trim().length > 0 : false;
  const authPasswordConfigured = typeof auth.password === 'string' ? auth.password.trim().length > 0 : false;
  const remoteUrl = typeof remote.url === 'string' ? normalizeWsUrl(remote.url) : null;
  const remoteTokenConfigured = typeof remote.token === 'string' ? remote.token.trim().length > 0 : false;
  const remotePasswordConfigured = typeof remote.password === 'string' ? String(remote.password).trim().length > 0 : false;
  const wideAreaEnabled = typeof wideArea.enabled === 'boolean' ? wideArea.enabled : null;
  return {
    path,
    exists,
    valid,
    issues: issuesRaw.filter(
      (i) => Boolean(i && typeof i.path === 'string' && typeof i.message === 'string')
    ).map((i) => ({ path: i.path, message: i.message })),
    legacyIssues: legacyRaw.filter(
      (i) => Boolean(i && typeof i.path === 'string' && typeof i.message === 'string')
    ).map((i) => ({ path: i.path, message: i.message })),
    gateway: {
      mode: typeof gateway.mode === 'string' ? gateway.mode : null,
      bind: typeof gateway.bind === 'string' ? gateway.bind : null,
      port: parseIntOrNull(gateway.port),
      controlUiEnabled: typeof controlUi.enabled === 'boolean' ? controlUi.enabled : null,
      controlUiBasePath: typeof controlUi.basePath === 'string' ? controlUi.basePath : null,
      authMode,
      authTokenConfigured,
      authPasswordConfigured,
      remoteUrl,
      remoteTokenConfigured,
      remotePasswordConfigured,
      tailscaleMode: typeof tailscale.mode === 'string' ? tailscale.mode : null
    },
    discovery: { wideAreaEnabled }
  };
}
__name(extractConfigSummary, 'extractConfigSummary');
function buildNetworkHints(cfg) {
  const tailnetIPv4 = pickPrimaryTailnetIPv4();
  const port = resolveGatewayPort(cfg);
  return {
    localLoopbackUrl: `ws://127.0.0.1:${port}`,
    localTailnetUrl: tailnetIPv4 ? `ws://${tailnetIPv4}:${port}` : null,
    tailnetIPv4: tailnetIPv4 ?? null
  };
}
__name(buildNetworkHints, 'buildNetworkHints');
function renderTargetHeader(target, rich) {
  const kindLabel = target.kind === 'localLoopback' ? 'Local loopback' : target.kind === 'sshTunnel' ? 'Remote over SSH' : target.kind === 'configRemote' ? target.active ? 'Remote (configured)' : 'Remote (configured, inactive)' : 'URL (explicit)';
  return `${colorize(rich, theme.heading, kindLabel)} ${colorize(rich, theme.muted, target.url)}`;
}
__name(renderTargetHeader, 'renderTargetHeader');
function renderProbeSummaryLine(probe, rich) {
  if (probe.ok) {
    const latency = typeof probe.connectLatencyMs === 'number' ? `${probe.connectLatencyMs}ms` : 'unknown';
    return `${colorize(rich, theme.success, 'Connect: ok')} (${latency}) \xB7 ${colorize(rich, theme.success, 'RPC: ok')}`;
  }
  const detail = probe.error ? ` - ${probe.error}` : '';
  if (probe.connectLatencyMs !== null && probe.connectLatencyMs !== undefined) {
    const latency = typeof probe.connectLatencyMs === 'number' ? `${probe.connectLatencyMs}ms` : 'unknown';
    return `${colorize(rich, theme.success, 'Connect: ok')} (${latency}) \xB7 ${colorize(rich, theme.error, 'RPC: failed')}${detail}`;
  }
  return `${colorize(rich, theme.error, 'Connect: failed')}${detail}`;
}
__name(renderProbeSummaryLine, 'renderProbeSummaryLine');
export {
  buildNetworkHints,
  extractConfigSummary,
  parseTimeoutMs,
  pickGatewaySelfPresence,
  renderProbeSummaryLine,
  renderTargetHeader,
  resolveAuthForTarget,
  resolveProbeBudgetMs,
  resolveTargets,
  sanitizeSshTarget
};
