/**
 * @module gateway/session-utils
 * SECURITY: Session key validation and scoping.
 * Manages session resolution, key derivation, and access scope enforcement.
 * Session keys are scoped to prevent cross-agent data access.
 */
import fs from 'node:fs';
import path from 'node:path';
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from '../agents/agent-scope.js';
import { lookupContextTokens } from '../agents/context.js';
import { DEFAULT_CONTEXT_TOKENS, DEFAULT_MODEL, DEFAULT_PROVIDER } from '../agents/defaults.js';
import {
  resolveConfiguredModelRef,
  resolveDefaultModelForAgent
} from '../agents/model-selection.js';
import { loadConfig } from '../config/config.js';
import { resolveStateDir } from '../config/paths.js';
import {
  buildGroupDisplayName,
  canonicalizeMainSessionAlias,
  loadSessionStore,
  resolveMainSessionKey,
  resolveStorePath
} from '../config/sessions.js';
import {
  normalizeAgentId,
  normalizeMainKey,
  parseAgentSessionKey
} from '../routing/session-key.js';
import { normalizeSessionDeliveryFields } from '../utils/delivery-context.js';
import {
  readFirstUserMessageFromTranscript,
  readLastMessagePreviewFromTranscript
} from './session-utils.fs.js';
import {
  archiveFileOnDisk,
  capArrayByJsonBytes,
  readFirstUserMessageFromTranscript as readFirstUserMessageFromTranscript2,
  readLastMessagePreviewFromTranscript as readLastMessagePreviewFromTranscript2,
  readSessionPreviewItemsFromTranscript,
  readSessionMessages,
  resolveSessionTranscriptCandidates
} from './session-utils.fs.js';
const DERIVED_TITLE_MAX_LEN = 60;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_DATA_RE = /^data:/i;
const AVATAR_HTTP_RE = /^https?:\/\//i;
const AVATAR_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const WINDOWS_ABS_RE = /^[a-zA-Z]:[\\/]/;
const AVATAR_MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff'
};
function resolveAvatarMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return AVATAR_MIME_BY_EXT[ext] ?? 'application/octet-stream';
}
function isWorkspaceRelativePath(value) {
  if (!value) {
    return false;
  }
  if (value.startsWith('~')) {
    return false;
  }
  if (AVATAR_SCHEME_RE.test(value) && !WINDOWS_ABS_RE.test(value)) {
    return false;
  }
  return true;
}
function resolveIdentityAvatarUrl(cfg, agentId, avatar) {
  if (!avatar) {
    return void 0;
  }
  const trimmed = avatar.trim();
  if (!trimmed) {
    return void 0;
  }
  if (AVATAR_DATA_RE.test(trimmed) || AVATAR_HTTP_RE.test(trimmed)) {
    return trimmed;
  }
  if (!isWorkspaceRelativePath(trimmed)) {
    return void 0;
  }
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
  const workspaceRoot = path.resolve(workspaceDir);
  const resolved = path.resolve(workspaceRoot, trimmed);
  const relative = path.relative(workspaceRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return void 0;
  }
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isFile() || stat.size > AVATAR_MAX_BYTES) {
      return void 0;
    }
    const buffer = fs.readFileSync(resolved);
    const mime = resolveAvatarMime(resolved);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return void 0;
  }
}
function formatSessionIdPrefix(sessionId, updatedAt) {
  const prefix = sessionId.slice(0, 8);
  if (updatedAt && updatedAt > 0) {
    const d = new Date(updatedAt);
    const date = d.toISOString().slice(0, 10);
    return `${prefix} (${date})`;
  }
  return prefix;
}
function truncateTitle(text, maxLen) {
  if (text.length <= maxLen) {
    return text;
  }
  const cut = text.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.6) {
    return `${cut.slice(0, lastSpace)  }\u2026`;
  }
  return `${cut  }\u2026`;
}
function deriveSessionTitle(entry, firstUserMessage) {
  if (!entry) {
    return void 0;
  }
  if (entry.displayName?.trim()) {
    return entry.displayName.trim();
  }
  if (entry.subject?.trim()) {
    return entry.subject.trim();
  }
  if (firstUserMessage?.trim()) {
    const normalized = firstUserMessage.replace(/\s+/g, ' ').trim();
    return truncateTitle(normalized, DERIVED_TITLE_MAX_LEN);
  }
  if (entry.sessionId) {
    return formatSessionIdPrefix(entry.sessionId, entry.updatedAt);
  }
  return void 0;
}
function loadSessionEntry(sessionKey) {
  const cfg = loadConfig();
  const sessionCfg = cfg.session;
  const canonicalKey = resolveSessionStoreKey({ cfg, sessionKey });
  const agentId = resolveSessionStoreAgentId(cfg, canonicalKey);
  const storePath = resolveStorePath(sessionCfg?.store, { agentId });
  const store = loadSessionStore(storePath);
  const entry = store[canonicalKey];
  return { cfg, storePath, store, entry, canonicalKey };
}
function classifySessionKey(key, entry) {
  if (key === 'global') {
    return 'global';
  }
  if (key === 'unknown') {
    return 'unknown';
  }
  if (entry?.chatType === 'group' || entry?.chatType === 'channel') {
    return 'group';
  }
  if (key.includes(':group:') || key.includes(':channel:')) {
    return 'group';
  }
  return 'direct';
}
function parseGroupKey(key) {
  const agentParsed = parseAgentSessionKey(key);
  const rawKey = agentParsed?.rest ?? key;
  const parts = rawKey.split(':').filter(Boolean);
  if (parts.length >= 3) {
    const [channel, kind, ...rest] = parts;
    if (kind === 'group' || kind === 'channel') {
      const id = rest.join(':');
      return { channel, kind, id };
    }
  }
  return null;
}
function isStorePathTemplate(store) {
  return typeof store === 'string' && store.includes('{agentId}');
}
function listExistingAgentIdsFromDisk() {
  const root = resolveStateDir();
  const agentsDir = path.join(root, 'agents');
  try {
    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => normalizeAgentId(entry.name)).filter(Boolean);
  } catch {
    return [];
  }
}
function listConfiguredAgentIds(cfg) {
  const agents = cfg.agents?.list ?? [];
  if (agents.length > 0) {
    const ids2 = /* @__PURE__ */ new Set();
    for (const entry of agents) {
      if (entry?.id) {
        ids2.add(normalizeAgentId(entry.id));
      }
    }
    const defaultId2 = normalizeAgentId(resolveDefaultAgentId(cfg));
    ids2.add(defaultId2);
    const sorted2 = Array.from(ids2).filter(Boolean);
    sorted2.sort((a, b) => a.localeCompare(b));
    return sorted2.includes(defaultId2) ? [defaultId2, ...sorted2.filter((id) => id !== defaultId2)] : sorted2;
  }
  const ids = /* @__PURE__ */ new Set();
  const defaultId = normalizeAgentId(resolveDefaultAgentId(cfg));
  ids.add(defaultId);
  for (const id of listExistingAgentIdsFromDisk()) {
    ids.add(id);
  }
  const sorted = Array.from(ids).filter(Boolean);
  sorted.sort((a, b) => a.localeCompare(b));
  if (sorted.includes(defaultId)) {
    return [defaultId, ...sorted.filter((id) => id !== defaultId)];
  }
  return sorted;
}
function listAgentsForGateway(cfg) {
  const defaultId = normalizeAgentId(resolveDefaultAgentId(cfg));
  const mainKey = normalizeMainKey(cfg.session?.mainKey);
  const scope = cfg.session?.scope ?? 'per-sender';
  const configuredById = /* @__PURE__ */ new Map();
  for (const entry of cfg.agents?.list ?? []) {
    if (!entry?.id) {
      continue;
    }
    const identity = entry.identity ? {
      name: entry.identity.name?.trim() || void 0,
      theme: entry.identity.theme?.trim() || void 0,
      emoji: entry.identity.emoji?.trim() || void 0,
      avatar: entry.identity.avatar?.trim() || void 0,
      avatarUrl: resolveIdentityAvatarUrl(
        cfg,
        normalizeAgentId(entry.id),
        entry.identity.avatar?.trim()
      )
    } : void 0;
    configuredById.set(normalizeAgentId(entry.id), {
      name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : void 0,
      identity
    });
  }
  const explicitIds = new Set(
    (cfg.agents?.list ?? []).map((entry) => entry?.id ? normalizeAgentId(entry.id) : '').filter(Boolean)
  );
  const allowedIds = explicitIds.size > 0 ? /* @__PURE__ */ new Set([...explicitIds, defaultId]) : null;
  let agentIds = listConfiguredAgentIds(cfg).filter(
    (id) => allowedIds ? allowedIds.has(id) : true
  );
  if (mainKey && !agentIds.includes(mainKey)) {
    agentIds = [...agentIds, mainKey];
  }
  const agents = agentIds.map((id) => {
    const meta = configuredById.get(id);
    return {
      id,
      name: meta?.name,
      identity: meta?.identity
    };
  });
  return { defaultId, mainKey, scope, agents };
}
function canonicalizeSessionKeyForAgent(agentId, key) {
  if (key === 'global' || key === 'unknown') {
    return key;
  }
  if (key.startsWith('agent:')) {
    return key;
  }
  return `agent:${normalizeAgentId(agentId)}:${key}`;
}
function resolveDefaultStoreAgentId(cfg) {
  return normalizeAgentId(resolveDefaultAgentId(cfg));
}
function resolveSessionStoreKey(params) {
  const raw = params.sessionKey.trim();
  if (!raw) {
    return raw;
  }
  if (raw === 'global' || raw === 'unknown') {
    return raw;
  }
  const parsed = parseAgentSessionKey(raw);
  if (parsed) {
    const agentId2 = normalizeAgentId(parsed.agentId);
    const canonical = canonicalizeMainSessionAlias({
      cfg: params.cfg,
      agentId: agentId2,
      sessionKey: raw
    });
    if (canonical !== raw) {
      return canonical;
    }
    return raw;
  }
  const rawMainKey = normalizeMainKey(params.cfg.session?.mainKey);
  if (raw === 'main' || raw === rawMainKey) {
    return resolveMainSessionKey(params.cfg);
  }
  const agentId = resolveDefaultStoreAgentId(params.cfg);
  return canonicalizeSessionKeyForAgent(agentId, raw);
}
function resolveSessionStoreAgentId(cfg, canonicalKey) {
  if (canonicalKey === 'global' || canonicalKey === 'unknown') {
    return resolveDefaultStoreAgentId(cfg);
  }
  const parsed = parseAgentSessionKey(canonicalKey);
  if (parsed?.agentId) {
    return normalizeAgentId(parsed.agentId);
  }
  return resolveDefaultStoreAgentId(cfg);
}
function canonicalizeSpawnedByForAgent(agentId, spawnedBy) {
  const raw = spawnedBy?.trim();
  if (!raw) {
    return void 0;
  }
  if (raw === 'global' || raw === 'unknown') {
    return raw;
  }
  if (raw.startsWith('agent:')) {
    return raw;
  }
  return `agent:${normalizeAgentId(agentId)}:${raw}`;
}
function resolveGatewaySessionStoreTarget(params) {
  const key = params.key.trim();
  const canonicalKey = resolveSessionStoreKey({
    cfg: params.cfg,
    sessionKey: key
  });
  const agentId = resolveSessionStoreAgentId(params.cfg, canonicalKey);
  const storeConfig = params.cfg.session?.store;
  const storePath = resolveStorePath(storeConfig, { agentId });
  if (canonicalKey === 'global' || canonicalKey === 'unknown') {
    const storeKeys2 = key && key !== canonicalKey ? [canonicalKey, key] : [key];
    return { agentId, storePath, canonicalKey, storeKeys: storeKeys2 };
  }
  const storeKeys = /* @__PURE__ */ new Set();
  storeKeys.add(canonicalKey);
  if (key && key !== canonicalKey) {
    storeKeys.add(key);
  }
  return {
    agentId,
    storePath,
    canonicalKey,
    storeKeys: Array.from(storeKeys)
  };
}
function mergeSessionEntryIntoCombined(params) {
  const { combined, entry, agentId, canonicalKey } = params;
  const existing = combined[canonicalKey];
  if (existing && (existing.updatedAt ?? 0) > (entry.updatedAt ?? 0)) {
    combined[canonicalKey] = {
      ...entry,
      ...existing,
      spawnedBy: canonicalizeSpawnedByForAgent(agentId, existing.spawnedBy ?? entry.spawnedBy)
    };
  } else {
    combined[canonicalKey] = {
      ...existing,
      ...entry,
      spawnedBy: canonicalizeSpawnedByForAgent(agentId, entry.spawnedBy ?? existing?.spawnedBy)
    };
  }
}
function loadCombinedSessionStoreForGateway(cfg) {
  const storeConfig = cfg.session?.store;
  if (storeConfig && !isStorePathTemplate(storeConfig)) {
    const storePath2 = resolveStorePath(storeConfig);
    const defaultAgentId = normalizeAgentId(resolveDefaultAgentId(cfg));
    const store = loadSessionStore(storePath2);
    const combined2 = {};
    for (const [key, entry] of Object.entries(store)) {
      const canonicalKey = canonicalizeSessionKeyForAgent(defaultAgentId, key);
      mergeSessionEntryIntoCombined({
        combined: combined2,
        entry,
        agentId: defaultAgentId,
        canonicalKey
      });
    }
    return { storePath: storePath2, store: combined2 };
  }
  const agentIds = listConfiguredAgentIds(cfg);
  const combined = {};
  for (const agentId of agentIds) {
    const storePath2 = resolveStorePath(storeConfig, { agentId });
    const store = loadSessionStore(storePath2);
    for (const [key, entry] of Object.entries(store)) {
      const canonicalKey = canonicalizeSessionKeyForAgent(agentId, key);
      mergeSessionEntryIntoCombined({
        combined,
        entry,
        agentId,
        canonicalKey
      });
    }
  }
  const storePath = typeof storeConfig === 'string' && storeConfig.trim() ? storeConfig.trim() : '(multiple)';
  return { storePath, store: combined };
}
function getSessionDefaults(cfg) {
  const resolved = resolveConfiguredModelRef({
    cfg,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL
  });
  const contextTokens = cfg.agents?.defaults?.contextTokens ?? lookupContextTokens(resolved.model) ?? DEFAULT_CONTEXT_TOKENS;
  return {
    modelProvider: resolved.provider ?? null,
    model: resolved.model ?? null,
    contextTokens: contextTokens ?? null
  };
}
function resolveSessionModelRef(cfg, entry, agentId) {
  const resolved = agentId ? resolveDefaultModelForAgent({ cfg, agentId }) : resolveConfiguredModelRef({
    cfg,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL
  });
  let provider = resolved.provider;
  let model = resolved.model;
  const storedModelOverride = entry?.modelOverride?.trim();
  if (storedModelOverride) {
    provider = entry?.providerOverride?.trim() || provider;
    model = storedModelOverride;
  }
  return { provider, model };
}
function listSessionsFromStore(params) {
  const { cfg, storePath, store, opts } = params;
  const now = Date.now();
  const includeGlobal = opts.includeGlobal === true;
  const includeUnknown = opts.includeUnknown === true;
  const includeDerivedTitles = opts.includeDerivedTitles === true;
  const includeLastMessage = opts.includeLastMessage === true;
  const spawnedBy = typeof opts.spawnedBy === 'string' ? opts.spawnedBy : '';
  const label = typeof opts.label === 'string' ? opts.label.trim() : '';
  const agentId = typeof opts.agentId === 'string' ? normalizeAgentId(opts.agentId) : '';
  const search = typeof opts.search === 'string' ? opts.search.trim().toLowerCase() : '';
  const activeMinutes = typeof opts.activeMinutes === 'number' && Number.isFinite(opts.activeMinutes) ? Math.max(1, Math.floor(opts.activeMinutes)) : void 0;
  let sessions = Object.entries(store).filter(([key]) => {
    if (!includeGlobal && key === 'global') {
      return false;
    }
    if (!includeUnknown && key === 'unknown') {
      return false;
    }
    if (agentId) {
      if (key === 'global' || key === 'unknown') {
        return false;
      }
      const parsed = parseAgentSessionKey(key);
      if (!parsed) {
        return false;
      }
      return normalizeAgentId(parsed.agentId) === agentId;
    }
    return true;
  }).filter(([key, entry]) => {
    if (!spawnedBy) {
      return true;
    }
    if (key === 'unknown' || key === 'global') {
      return false;
    }
    return entry?.spawnedBy === spawnedBy;
  }).filter(([, entry]) => {
    if (!label) {
      return true;
    }
    return entry?.label === label;
  }).map(([key, entry]) => {
    const updatedAt = entry?.updatedAt ?? null;
    const input = entry?.inputTokens ?? 0;
    const output = entry?.outputTokens ?? 0;
    const total = entry?.totalTokens ?? input + output;
    const parsed = parseGroupKey(key);
    const channel = entry?.channel ?? parsed?.channel;
    const subject = entry?.subject;
    const groupChannel = entry?.groupChannel;
    const space = entry?.space;
    const id = parsed?.id;
    const origin = entry?.origin;
    const originLabel = origin?.label;
    const displayName = entry?.displayName ?? (channel ? buildGroupDisplayName({
      provider: channel,
      subject,
      groupChannel,
      space,
      id,
      key
    }) : void 0) ?? entry?.label ?? originLabel;
    const deliveryFields = normalizeSessionDeliveryFields(entry);
    const parsedAgent = parseAgentSessionKey(key);
    const sessionAgentId = normalizeAgentId(parsedAgent?.agentId ?? resolveDefaultAgentId(cfg));
    const resolvedModel = resolveSessionModelRef(cfg, entry, sessionAgentId);
    const modelProvider = resolvedModel.provider ?? DEFAULT_PROVIDER;
    const model = resolvedModel.model ?? DEFAULT_MODEL;
    return {
      key,
      entry,
      kind: classifySessionKey(key, entry),
      label: entry?.label,
      displayName,
      channel,
      subject,
      groupChannel,
      space,
      chatType: entry?.chatType,
      origin,
      updatedAt,
      sessionId: entry?.sessionId,
      systemSent: entry?.systemSent,
      abortedLastRun: entry?.abortedLastRun,
      thinkingLevel: entry?.thinkingLevel,
      verboseLevel: entry?.verboseLevel,
      reasoningLevel: entry?.reasoningLevel,
      elevatedLevel: entry?.elevatedLevel,
      sendPolicy: entry?.sendPolicy,
      inputTokens: entry?.inputTokens,
      outputTokens: entry?.outputTokens,
      totalTokens: total,
      responseUsage: entry?.responseUsage,
      modelProvider,
      model,
      contextTokens: entry?.contextTokens,
      deliveryContext: deliveryFields.deliveryContext,
      lastChannel: deliveryFields.lastChannel ?? entry?.lastChannel,
      lastTo: deliveryFields.lastTo ?? entry?.lastTo,
      lastAccountId: deliveryFields.lastAccountId ?? entry?.lastAccountId
    };
  }).toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  if (search) {
    sessions = sessions.filter((s) => {
      const fields = [s.displayName, s.label, s.subject, s.sessionId, s.key];
      return fields.some((f) => typeof f === 'string' && f.toLowerCase().includes(search));
    });
  }
  if (activeMinutes !== void 0) {
    const cutoff = now - activeMinutes * 6e4;
    sessions = sessions.filter((s) => (s.updatedAt ?? 0) >= cutoff);
  }
  if (typeof opts.limit === 'number' && Number.isFinite(opts.limit)) {
    const limit = Math.max(1, Math.floor(opts.limit));
    sessions = sessions.slice(0, limit);
  }
  const finalSessions = sessions.map((s) => {
    const { entry, ...rest } = s;
    let derivedTitle;
    let lastMessagePreview;
    if (entry?.sessionId) {
      if (includeDerivedTitles) {
        const firstUserMsg = readFirstUserMessageFromTranscript(
          entry.sessionId,
          storePath,
          entry.sessionFile
        );
        derivedTitle = deriveSessionTitle(entry, firstUserMsg);
      }
      if (includeLastMessage) {
        const lastMsg = readLastMessagePreviewFromTranscript(
          entry.sessionId,
          storePath,
          entry.sessionFile
        );
        if (lastMsg) {
          lastMessagePreview = lastMsg;
        }
      }
    }
    return { ...rest, derivedTitle, lastMessagePreview };
  });
  return {
    ts: now,
    path: storePath,
    count: finalSessions.length,
    defaults: getSessionDefaults(cfg),
    sessions: finalSessions
  };
}
export {
  archiveFileOnDisk,
  capArrayByJsonBytes,
  classifySessionKey,
  deriveSessionTitle,
  getSessionDefaults,
  listAgentsForGateway,
  listSessionsFromStore,
  loadCombinedSessionStoreForGateway,
  loadSessionEntry,
  parseGroupKey,
  readFirstUserMessageFromTranscript2 as readFirstUserMessageFromTranscript,
  readLastMessagePreviewFromTranscript2 as readLastMessagePreviewFromTranscript,
  readSessionMessages,
  readSessionPreviewItemsFromTranscript,
  resolveGatewaySessionStoreTarget,
  resolveSessionModelRef,
  resolveSessionStoreKey,
  resolveSessionTranscriptCandidates
};
