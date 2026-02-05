/** @module gateway/hooks -- Gateway lifecycle hooks (pre/post message, connect, disconnect). */
import { randomUUID } from 'node:crypto';
import { listChannelPlugins } from '../channels/plugins/index.js';
import { normalizeMessageChannel } from '../utils/message-channel.js';
import { resolveHookMappings } from './hooks-mapping.js';
const DEFAULT_HOOKS_PATH = '/hooks';
const DEFAULT_HOOKS_MAX_BODY_BYTES = 256 * 1024;
function resolveHooksConfig(cfg) {
  if (cfg.hooks?.enabled !== true) {
    return null;
  }
  const token = cfg.hooks?.token?.trim();
  if (!token) {
    throw new Error('hooks.enabled requires hooks.token');
  }
  const rawPath = cfg.hooks?.path?.trim() || DEFAULT_HOOKS_PATH;
  const withSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const trimmed = withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
  if (trimmed === '/') {
    throw new Error("hooks.path may not be '/'");
  }
  const maxBodyBytes = cfg.hooks?.maxBodyBytes && cfg.hooks.maxBodyBytes > 0 ? cfg.hooks.maxBodyBytes : DEFAULT_HOOKS_MAX_BODY_BYTES;
  const mappings = resolveHookMappings(cfg.hooks);
  return {
    basePath: trimmed,
    token,
    maxBodyBytes,
    mappings
  };
}
function extractHookToken(req, url) {
  const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token) {
      return { token, fromQuery: false };
    }
  }
  const headerToken = typeof req.headers['x-openclaw-token'] === 'string' ? req.headers['x-openclaw-token'].trim() : '';
  if (headerToken) {
    return { token: headerToken, fromQuery: false };
  }
  const queryToken = url.searchParams.get('token');
  if (queryToken) {
    return { token: queryToken.trim(), fromQuery: true };
  }
  return { token: void 0, fromQuery: false };
}
async function readJsonBody(req, maxBytes) {
  return await new Promise((resolve) => {
    let done = false;
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      if (done) {
        return;
      }
      total += chunk.length;
      if (total > maxBytes) {
        done = true;
        resolve({ ok: false, error: 'payload too large' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) {
        return;
      }
      done = true;
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) {
        resolve({ ok: true, value: {} });
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        resolve({ ok: true, value: parsed });
      } catch (err) {
        resolve({ ok: false, error: String(err) });
      }
    });
    req.on('error', (err) => {
      if (done) {
        return;
      }
      done = true;
      resolve({ ok: false, error: String(err) });
    });
  });
}
function normalizeHookHeaders(req) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers[key.toLowerCase()] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      headers[key.toLowerCase()] = value.join(', ');
    }
  }
  return headers;
}
function normalizeWakePayload(payload) {
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  if (!text) {
    return { ok: false, error: 'text required' };
  }
  const mode = payload.mode === 'next-heartbeat' ? 'next-heartbeat' : 'now';
  return { ok: true, value: { text, mode } };
}
const listHookChannelValues = () => ['last', ...listChannelPlugins().map((plugin) => plugin.id)];
const getHookChannelSet = () => new Set(listHookChannelValues());
const getHookChannelError = () => `channel must be ${listHookChannelValues().join('|')}`;
function resolveHookChannel(raw) {
  if (raw === void 0) {
    return 'last';
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const normalized = normalizeMessageChannel(raw);
  if (!normalized || !getHookChannelSet().has(normalized)) {
    return null;
  }
  return normalized;
}
function resolveHookDeliver(raw) {
  return raw !== false;
}
function normalizeAgentPayload(payload, opts) {
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (!message) {
    return { ok: false, error: 'message required' };
  }
  const nameRaw = payload.name;
  const name = typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : 'Hook';
  const wakeMode = payload.wakeMode === 'next-heartbeat' ? 'next-heartbeat' : 'now';
  const sessionKeyRaw = payload.sessionKey;
  const idFactory = opts?.idFactory ?? randomUUID;
  const sessionKey = typeof sessionKeyRaw === 'string' && sessionKeyRaw.trim() ? sessionKeyRaw.trim() : `hook:${idFactory()}`;
  const channel = resolveHookChannel(payload.channel);
  if (!channel) {
    return { ok: false, error: getHookChannelError() };
  }
  const toRaw = payload.to;
  const to = typeof toRaw === 'string' && toRaw.trim() ? toRaw.trim() : void 0;
  const modelRaw = payload.model;
  const model = typeof modelRaw === 'string' && modelRaw.trim() ? modelRaw.trim() : void 0;
  if (modelRaw !== void 0 && !model) {
    return { ok: false, error: 'model required' };
  }
  const deliver = resolveHookDeliver(payload.deliver);
  const thinkingRaw = payload.thinking;
  const thinking = typeof thinkingRaw === 'string' && thinkingRaw.trim() ? thinkingRaw.trim() : void 0;
  const timeoutRaw = payload.timeoutSeconds;
  const timeoutSeconds = typeof timeoutRaw === 'number' && Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.floor(timeoutRaw) : void 0;
  return {
    ok: true,
    value: {
      message,
      name,
      wakeMode,
      sessionKey,
      deliver,
      channel,
      to,
      model,
      thinking,
      timeoutSeconds
    }
  };
}
export {
  extractHookToken,
  getHookChannelError,
  normalizeAgentPayload,
  normalizeHookHeaders,
  normalizeWakePayload,
  readJsonBody,
  resolveHookChannel,
  resolveHookDeliver,
  resolveHooksConfig
};
