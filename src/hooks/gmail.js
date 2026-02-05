import { randomBytes } from 'node:crypto';
import {
  DEFAULT_GATEWAY_PORT,
  resolveGatewayPort
} from '../config/config.js';
const DEFAULT_GMAIL_LABEL = 'INBOX';
const DEFAULT_GMAIL_TOPIC = 'gog-gmail-watch';
const DEFAULT_GMAIL_SUBSCRIPTION = 'gog-gmail-watch-push';
const DEFAULT_GMAIL_SERVE_BIND = '127.0.0.1';
const DEFAULT_GMAIL_SERVE_PORT = 8788;
const DEFAULT_GMAIL_SERVE_PATH = '/gmail-pubsub';
const DEFAULT_GMAIL_MAX_BYTES = 2e4;
const DEFAULT_GMAIL_RENEW_MINUTES = 12 * 60;
const DEFAULT_HOOKS_PATH = '/hooks';
function generateHookToken(bytes = 24) {
  return randomBytes(bytes).toString('hex');
}
function mergeHookPresets(existing, preset) {
  const next = new Set((existing ?? []).map((item) => item.trim()).filter(Boolean));
  next.add(preset);
  return Array.from(next);
}
function normalizeHooksPath(raw) {
  const base = raw?.trim() || DEFAULT_HOOKS_PATH;
  if (base === '/') {
    return DEFAULT_HOOKS_PATH;
  }
  const withSlash = base.startsWith('/') ? base : `/${base}`;
  return withSlash.replace(/\/+$/, '');
}
function normalizeServePath(raw) {
  const base = raw?.trim() || DEFAULT_GMAIL_SERVE_PATH;
  if (base === '/') {
    return '/';
  }
  const withSlash = base.startsWith('/') ? base : `/${base}`;
  return withSlash.replace(/\/+$/, '');
}
function buildDefaultHookUrl(hooksPath, port = DEFAULT_GATEWAY_PORT) {
  const basePath = normalizeHooksPath(hooksPath);
  const baseUrl = `http://127.0.0.1:${port}`;
  return joinUrl(baseUrl, `${basePath}/gmail`);
}
function resolveGmailHookRuntimeConfig(cfg, overrides) {
  const hooks = cfg.hooks;
  const gmail = hooks?.gmail;
  const hookToken = overrides.hookToken ?? hooks?.token ?? '';
  if (!hookToken) {
    return { ok: false, error: 'hooks.token missing (needed for gmail hook)' };
  }
  const account = overrides.account ?? gmail?.account ?? '';
  if (!account) {
    return { ok: false, error: 'gmail account required' };
  }
  const topic = overrides.topic ?? gmail?.topic ?? '';
  if (!topic) {
    return { ok: false, error: 'gmail topic required' };
  }
  const subscription = overrides.subscription ?? gmail?.subscription ?? DEFAULT_GMAIL_SUBSCRIPTION;
  const pushToken = overrides.pushToken ?? gmail?.pushToken ?? '';
  if (!pushToken) {
    return { ok: false, error: 'gmail push token required' };
  }
  const hookUrl = overrides.hookUrl ?? gmail?.hookUrl ?? buildDefaultHookUrl(hooks?.path, resolveGatewayPort(cfg));
  const includeBody = overrides.includeBody ?? gmail?.includeBody ?? true;
  const maxBytesRaw = overrides.maxBytes ?? gmail?.maxBytes;
  const maxBytes = typeof maxBytesRaw === 'number' && Number.isFinite(maxBytesRaw) && maxBytesRaw > 0 ? Math.floor(maxBytesRaw) : DEFAULT_GMAIL_MAX_BYTES;
  const renewEveryMinutesRaw = overrides.renewEveryMinutes ?? gmail?.renewEveryMinutes;
  const renewEveryMinutes = typeof renewEveryMinutesRaw === 'number' && Number.isFinite(renewEveryMinutesRaw) && renewEveryMinutesRaw > 0 ? Math.floor(renewEveryMinutesRaw) : DEFAULT_GMAIL_RENEW_MINUTES;
  const serveBind = overrides.serveBind ?? gmail?.serve?.bind ?? DEFAULT_GMAIL_SERVE_BIND;
  const servePortRaw = overrides.servePort ?? gmail?.serve?.port;
  const servePort = typeof servePortRaw === 'number' && Number.isFinite(servePortRaw) && servePortRaw > 0 ? Math.floor(servePortRaw) : DEFAULT_GMAIL_SERVE_PORT;
  const servePathRaw = overrides.servePath ?? gmail?.serve?.path;
  const normalizedServePathRaw = typeof servePathRaw === 'string' && servePathRaw.trim().length > 0 ? normalizeServePath(servePathRaw) : DEFAULT_GMAIL_SERVE_PATH;
  const tailscaleTargetRaw = overrides.tailscaleTarget ?? gmail?.tailscale?.target;
  const tailscaleMode = overrides.tailscaleMode ?? gmail?.tailscale?.mode ?? 'off';
  const tailscaleTarget = tailscaleMode !== 'off' && typeof tailscaleTargetRaw === 'string' && tailscaleTargetRaw.trim().length > 0 ? tailscaleTargetRaw.trim() : void 0;
  const servePath = normalizeServePath(
    tailscaleMode !== 'off' && !tailscaleTarget ? '/' : normalizedServePathRaw
  );
  const tailscalePathRaw = overrides.tailscalePath ?? gmail?.tailscale?.path;
  const tailscalePath = normalizeServePath(
    tailscaleMode !== 'off' ? tailscalePathRaw ?? normalizedServePathRaw : tailscalePathRaw ?? servePath
  );
  return {
    ok: true,
    value: {
      account,
      label: overrides.label ?? gmail?.label ?? DEFAULT_GMAIL_LABEL,
      topic,
      subscription,
      pushToken,
      hookToken,
      hookUrl,
      includeBody,
      maxBytes,
      renewEveryMinutes,
      serve: {
        bind: serveBind,
        port: servePort,
        path: servePath
      },
      tailscale: {
        mode: tailscaleMode,
        path: tailscalePath,
        target: tailscaleTarget
      }
    }
  };
}
function buildGogWatchStartArgs(cfg) {
  return [
    'gmail',
    'watch',
    'start',
    '--account',
    cfg.account,
    '--label',
    cfg.label,
    '--topic',
    cfg.topic
  ];
}
function buildGogWatchServeArgs(cfg) {
  const args = [
    'gmail',
    'watch',
    'serve',
    '--account',
    cfg.account,
    '--bind',
    cfg.serve.bind,
    '--port',
    String(cfg.serve.port),
    '--path',
    cfg.serve.path,
    '--token',
    cfg.pushToken,
    '--hook-url',
    cfg.hookUrl,
    '--hook-token',
    cfg.hookToken
  ];
  if (cfg.includeBody) {
    args.push('--include-body');
  }
  if (cfg.maxBytes > 0) {
    args.push('--max-bytes', String(cfg.maxBytes));
  }
  return args;
}
function buildTopicPath(projectId, topicName) {
  return `projects/${projectId}/topics/${topicName}`;
}
function parseTopicPath(topic) {
  const match = topic.trim().match(/^projects\/([^/]+)\/topics\/([^/]+)$/i);
  if (!match) {
    return null;
  }
  return { projectId: match[1] ?? '', topicName: match[2] ?? '' };
}
function joinUrl(base, path) {
  const url = new URL(base);
  const basePath = url.pathname.replace(/\/+$/, '');
  const extra = path.startsWith('/') ? path : `/${path}`;
  url.pathname = `${basePath}${extra}`;
  return url.toString();
}
export {
  DEFAULT_GMAIL_LABEL,
  DEFAULT_GMAIL_MAX_BYTES,
  DEFAULT_GMAIL_RENEW_MINUTES,
  DEFAULT_GMAIL_SERVE_BIND,
  DEFAULT_GMAIL_SERVE_PATH,
  DEFAULT_GMAIL_SERVE_PORT,
  DEFAULT_GMAIL_SUBSCRIPTION,
  DEFAULT_GMAIL_TOPIC,
  DEFAULT_HOOKS_PATH,
  buildDefaultHookUrl,
  buildGogWatchServeArgs,
  buildGogWatchStartArgs,
  buildTopicPath,
  generateHookToken,
  mergeHookPresets,
  normalizeHooksPath,
  normalizeServePath,
  parseTopicPath,
  resolveGmailHookRuntimeConfig
};
