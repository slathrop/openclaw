/**
 * Helper utilities for session tool operations.
 * @module agents/tools/sessions-helpers
 */
import { callGateway } from '../../gateway/call.js';
import { isAcpSessionKey, normalizeMainKey } from '../../routing/session-key.js';
import { sanitizeUserFacingText } from '../pi-embedded-helpers.js';
import {
  stripDowngradedToolCallText,
  stripMinimaxToolCallXml,
  stripThinkingTagsFromText
} from '../pi-embedded-utils.js';
function normalizeKey(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : void 0;
}
function resolveMainSessionAlias(cfg) {
  const mainKey = normalizeMainKey(cfg.session?.mainKey);
  const scope = cfg.session?.scope ?? 'per-sender';
  const alias = scope === 'global' ? 'global' : mainKey;
  return { mainKey, alias, scope };
}
function resolveDisplaySessionKey(params) {
  if (params.key === params.alias) {
    return 'main';
  }
  if (params.key === params.mainKey) {
    return 'main';
  }
  return params.key;
}
function resolveInternalSessionKey(params) {
  if (params.key === 'main') {
    return params.alias;
  }
  return params.key;
}
function createAgentToAgentPolicy(cfg) {
  const routingA2A = cfg.tools?.agentToAgent;
  const enabled = routingA2A?.enabled === true;
  const allowPatterns = Array.isArray(routingA2A?.allow) ? routingA2A.allow : [];
  const matchesAllow = (agentId) => {
    if (allowPatterns.length === 0) {
      return true;
    }
    return allowPatterns.some((pattern) => {
      const raw = String(pattern ?? '').trim();
      if (!raw) {
        return false;
      }
      if (raw === '*') {
        return true;
      }
      if (!raw.includes('*')) {
        return raw === agentId;
      }
      const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`^${escaped.replaceAll('\\*', '.*')}$`, 'i');
      return re.test(agentId);
    });
  };
  const isAllowed = (requesterAgentId, targetAgentId) => {
    if (requesterAgentId === targetAgentId) {
      return true;
    }
    if (!enabled) {
      return false;
    }
    return matchesAllow(requesterAgentId) && matchesAllow(targetAgentId);
  };
  return { enabled, matchesAllow, isAllowed };
}
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function looksLikeSessionId(value) {
  return SESSION_ID_RE.test(value.trim());
}
function looksLikeSessionKey(value) {
  const raw = value.trim();
  if (!raw) {
    return false;
  }
  if (raw === 'main' || raw === 'global' || raw === 'unknown') {
    return true;
  }
  if (isAcpSessionKey(raw)) {
    return true;
  }
  if (raw.startsWith('agent:')) {
    return true;
  }
  if (raw.startsWith('cron:') || raw.startsWith('hook:')) {
    return true;
  }
  if (raw.startsWith('node-') || raw.startsWith('node:')) {
    return true;
  }
  if (raw.includes(':group:') || raw.includes(':channel:')) {
    return true;
  }
  return false;
}
function shouldResolveSessionIdInput(value) {
  return looksLikeSessionId(value) || !looksLikeSessionKey(value);
}
async function resolveSessionKeyFromSessionId(params) {
  try {
    const result = await callGateway({
      method: 'sessions.resolve',
      params: {
        sessionId: params.sessionId,
        spawnedBy: params.restrictToSpawned ? params.requesterInternalKey : void 0,
        includeGlobal: !params.restrictToSpawned,
        includeUnknown: !params.restrictToSpawned
      }
    });
    const key = typeof result?.key === 'string' ? result.key.trim() : '';
    if (!key) {
      throw new Error(
        `Session not found: ${params.sessionId} (use the full sessionKey from sessions_list)`
      );
    }
    return {
      ok: true,
      key,
      displayKey: resolveDisplaySessionKey({
        key,
        alias: params.alias,
        mainKey: params.mainKey
      }),
      resolvedViaSessionId: true
    };
  } catch (err) {
    if (params.restrictToSpawned) {
      return {
        ok: false,
        status: 'forbidden',
        error: `Session not visible from this sandboxed agent session: ${params.sessionId}`
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 'error',
      error: message || `Session not found: ${params.sessionId} (use the full sessionKey from sessions_list)`
    };
  }
}
async function resolveSessionKeyFromKey(params) {
  try {
    const result = await callGateway({
      method: 'sessions.resolve',
      params: {
        key: params.key,
        spawnedBy: params.restrictToSpawned ? params.requesterInternalKey : void 0
      }
    });
    const key = typeof result?.key === 'string' ? result.key.trim() : '';
    if (!key) {
      return null;
    }
    return {
      ok: true,
      key,
      displayKey: resolveDisplaySessionKey({
        key,
        alias: params.alias,
        mainKey: params.mainKey
      }),
      resolvedViaSessionId: false
    };
  } catch {
    return null;
  }
}
async function resolveSessionReference(params) {
  const raw = params.sessionKey.trim();
  if (shouldResolveSessionIdInput(raw)) {
    const resolvedByKey = await resolveSessionKeyFromKey({
      key: raw,
      alias: params.alias,
      mainKey: params.mainKey,
      requesterInternalKey: params.requesterInternalKey,
      restrictToSpawned: params.restrictToSpawned
    });
    if (resolvedByKey) {
      return resolvedByKey;
    }
    return await resolveSessionKeyFromSessionId({
      sessionId: raw,
      alias: params.alias,
      mainKey: params.mainKey,
      requesterInternalKey: params.requesterInternalKey,
      restrictToSpawned: params.restrictToSpawned
    });
  }
  const resolvedKey = resolveInternalSessionKey({
    key: raw,
    alias: params.alias,
    mainKey: params.mainKey
  });
  const displayKey = resolveDisplaySessionKey({
    key: resolvedKey,
    alias: params.alias,
    mainKey: params.mainKey
  });
  return { ok: true, key: resolvedKey, displayKey, resolvedViaSessionId: false };
}
function classifySessionKind(params) {
  const key = params.key;
  if (key === params.alias || key === params.mainKey) {
    return 'main';
  }
  if (key.startsWith('cron:')) {
    return 'cron';
  }
  if (key.startsWith('hook:')) {
    return 'hook';
  }
  if (key.startsWith('node-') || key.startsWith('node:')) {
    return 'node';
  }
  if (params.gatewayKind === 'group') {
    return 'group';
  }
  if (key.includes(':group:') || key.includes(':channel:')) {
    return 'group';
  }
  return 'other';
}
function deriveChannel(params) {
  if (params.kind === 'cron' || params.kind === 'hook' || params.kind === 'node') {
    return 'internal';
  }
  const channel = normalizeKey(params.channel ?? void 0);
  if (channel) {
    return channel;
  }
  const lastChannel = normalizeKey(params.lastChannel ?? void 0);
  if (lastChannel) {
    return lastChannel;
  }
  const parts = params.key.split(':').filter(Boolean);
  if (parts.length >= 3 && (parts[1] === 'group' || parts[1] === 'channel')) {
    return parts[0];
  }
  return 'unknown';
}
function stripToolMessages(messages) {
  return messages.filter((msg) => {
    if (!msg || typeof msg !== 'object') {
      return true;
    }
    const role = msg.role;
    return role !== 'toolResult';
  });
}
function sanitizeTextContent(text) {
  if (!text) {
    return text;
  }
  return stripThinkingTagsFromText(stripDowngradedToolCallText(stripMinimaxToolCallXml(text)));
}
function extractAssistantText(message) {
  if (!message || typeof message !== 'object') {
    return void 0;
  }
  if (message.role !== 'assistant') {
    return void 0;
  }
  const content = message.content;
  if (!Array.isArray(content)) {
    return void 0;
  }
  const chunks = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') {
      continue;
    }
    if (block.type !== 'text') {
      continue;
    }
    const text = block.text;
    if (typeof text === 'string') {
      const sanitized = sanitizeTextContent(text);
      if (sanitized.trim()) {
        chunks.push(sanitized);
      }
    }
  }
  const joined = chunks.join('').trim();
  return joined ? sanitizeUserFacingText(joined) : void 0;
}
export {
  classifySessionKind,
  createAgentToAgentPolicy,
  deriveChannel,
  extractAssistantText,
  looksLikeSessionId,
  looksLikeSessionKey,
  resolveDisplaySessionKey,
  resolveInternalSessionKey,
  resolveMainSessionAlias,
  resolveSessionReference,
  sanitizeTextContent,
  shouldResolveSessionIdInput,
  stripToolMessages
};
