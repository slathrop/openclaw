/**
 * System presence tracking and device registration.
 *
 * Tracks connected gateway nodes and devices with TTL-based expiry,
 * LRU eviction, and structured presence updates. Provides self-presence
 * initialization from local system info.
 */
import {spawnSync} from 'node:child_process';
import os from 'node:os';

/**
 * @typedef {object} SystemPresence
 * @property {string} [host]
 * @property {string} [ip]
 * @property {string} [version]
 * @property {string} [platform]
 * @property {string} [deviceFamily]
 * @property {string} [modelIdentifier]
 * @property {number} [lastInputSeconds]
 * @property {string} [mode]
 * @property {string} [reason]
 * @property {string} [deviceId]
 * @property {string[]} [roles]
 * @property {string[]} [scopes]
 * @property {string} [instanceId]
 * @property {string} text
 * @property {number} ts
 */

/**
 * @typedef {object} SystemPresenceUpdate
 * @property {string} key
 * @property {SystemPresence} [previous]
 * @property {SystemPresence} next
 * @property {Partial<SystemPresence>} changes
 * @property {Array<keyof SystemPresence>} changedKeys
 */

/** @type {Map<string, SystemPresence>} */
const entries = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 200;

/**
 * @param {string | undefined} key
 * @returns {string | undefined}
 */
function normalizePresenceKey(key) {
  if (!key) {
    return undefined;
  }
  const trimmed = key.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.toLowerCase();
}

/**
 * @returns {string | undefined}
 */
function resolvePrimaryIPv4() {
  const nets = os.networkInterfaces();
  const prefer = ['en0', 'eth0'];
  const pick = (names) => {
    for (const name of names) {
      const list = nets[name];
      const entry = list?.find((n) => n.family === 'IPv4' && !n.internal);
      if (entry?.address) {
        return entry.address;
      }
    }
    for (const list of Object.values(nets)) {
      const entry = list?.find((n) => n.family === 'IPv4' && !n.internal);
      if (entry?.address) {
        return entry.address;
      }
    }
    return undefined;
  };
  return pick(prefer) ?? os.hostname();
}

function initSelfPresence() {
  const host = os.hostname();
  const ip = resolvePrimaryIPv4() ?? undefined;
  const version = process.env.OPENCLAW_VERSION ?? process.env.npm_package_version ?? 'unknown';
  const modelIdentifier = (() => {
    const p = os.platform();
    if (p === 'darwin') {
      const res = spawnSync('sysctl', ['-n', 'hw.model'], {
        encoding: 'utf-8'
      });
      const out = typeof res.stdout === 'string' ? res.stdout.trim() : '';
      return out.length > 0 ? out : undefined;
    }
    return os.arch();
  })();
  const macOSVersion = () => {
    const res = spawnSync('sw_vers', ['-productVersion'], {
      encoding: 'utf-8'
    });
    const out = typeof res.stdout === 'string' ? res.stdout.trim() : '';
    return out.length > 0 ? out : os.release();
  };
  const platform = (() => {
    const p = os.platform();
    const rel = os.release();
    if (p === 'darwin') {
      return `macos ${macOSVersion()}`;
    }
    if (p === 'win32') {
      return `windows ${rel}`;
    }
    return `${p} ${rel}`;
  })();
  const deviceFamily = (() => {
    const p = os.platform();
    if (p === 'darwin') {
      return 'Mac';
    }
    if (p === 'win32') {
      return 'Windows';
    }
    if (p === 'linux') {
      return 'Linux';
    }
    return p;
  })();
  const text = `Gateway: ${host}${ip ? ` (${ip})` : ''} \u00B7 app ${version} \u00B7 mode gateway \u00B7 reason self`;
  /** @type {SystemPresence} */
  const selfEntry = {
    host,
    ip,
    version,
    platform,
    deviceFamily,
    modelIdentifier,
    mode: 'gateway',
    reason: 'self',
    text,
    ts: Date.now()
  };
  const key = host.toLowerCase();
  entries.set(key, selfEntry);
}

function ensureSelfPresence() {
  // If the map was somehow cleared (e.g., hot reload or a new worker spawn that
  // skipped module evaluation), re-seed with a local entry so UIs always show
  // at least the current gateway.
  if (entries.size === 0) {
    initSelfPresence();
  }
}

function touchSelfPresence() {
  const host = os.hostname();
  const key = host.toLowerCase();
  const existing = entries.get(key);
  if (existing) {
    entries.set(key, {...existing, ts: Date.now()});
  } else {
    initSelfPresence();
  }
}

initSelfPresence();

/**
 * @param {string} text
 * @returns {SystemPresence}
 */
function parsePresence(text) {
  const trimmed = text.trim();
  const pattern =
    /Node:\s*([^ (]+)\s*\(([^)]+)\)\s*\u00B7\s*app\s*([^\u00B7]+?)\s*\u00B7\s*last input\s*([0-9]+)s ago\s*\u00B7\s*mode\s*([^\u00B7]+?)\s*\u00B7\s*reason\s*(.+)$/i;
  const match = trimmed.match(pattern);
  if (!match) {
    return {text: trimmed, ts: Date.now()};
  }
  const [, host, ip, version, lastInputStr, mode, reasonRaw] = match;
  const lastInputSeconds = Number.parseInt(lastInputStr, 10);
  const reason = reasonRaw.trim();
  return {
    host: host.trim(),
    ip: ip.trim(),
    version: version.trim(),
    lastInputSeconds: Number.isFinite(lastInputSeconds) ? lastInputSeconds : undefined,
    mode: mode.trim(),
    reason,
    text: trimmed,
    ts: Date.now()
  };
}

/**
 * @param {...(string[] | undefined)} values
 * @returns {string[] | undefined}
 */
function mergeStringList(...values) {
  const out = new Set();
  for (const list of values) {
    if (!Array.isArray(list)) {
      continue;
    }
    for (const item of list) {
      const trimmed = String(item).trim();
      if (trimmed) {
        out.add(trimmed);
      }
    }
  }
  return out.size > 0 ? [...out] : undefined;
}

/**
 * Updates system presence from a presence payload.
 * @param {object} payload
 * @param {string} payload.text
 * @param {string} [payload.deviceId]
 * @param {string} [payload.instanceId]
 * @param {string} [payload.host]
 * @param {string} [payload.ip]
 * @param {string} [payload.version]
 * @param {string} [payload.platform]
 * @param {string} [payload.deviceFamily]
 * @param {string} [payload.modelIdentifier]
 * @param {number} [payload.lastInputSeconds]
 * @param {string} [payload.mode]
 * @param {string} [payload.reason]
 * @param {string[]} [payload.roles]
 * @param {string[]} [payload.scopes]
 * @param {string[]} [payload.tags]
 * @returns {SystemPresenceUpdate}
 */
export function updateSystemPresence(payload) {
  ensureSelfPresence();
  const parsed = parsePresence(payload.text);
  const key =
    normalizePresenceKey(payload.deviceId) ||
    normalizePresenceKey(payload.instanceId) ||
    normalizePresenceKey(parsed.instanceId) ||
    normalizePresenceKey(parsed.host) ||
    parsed.ip ||
    parsed.text.slice(0, 64) ||
    os.hostname().toLowerCase();
  const hadExisting = entries.has(key);
  const existing = entries.get(key) ?? /** @type {SystemPresence} */ ({});
  /** @type {SystemPresence} */
  const merged = {
    ...existing,
    ...parsed,
    host: payload.host ?? parsed.host ?? existing.host,
    ip: payload.ip ?? parsed.ip ?? existing.ip,
    version: payload.version ?? parsed.version ?? existing.version,
    platform: payload.platform ?? existing.platform,
    deviceFamily: payload.deviceFamily ?? existing.deviceFamily,
    modelIdentifier: payload.modelIdentifier ?? existing.modelIdentifier,
    mode: payload.mode ?? parsed.mode ?? existing.mode,
    lastInputSeconds:
      payload.lastInputSeconds ?? parsed.lastInputSeconds ?? existing.lastInputSeconds,
    reason: payload.reason ?? parsed.reason ?? existing.reason,
    deviceId: payload.deviceId ?? existing.deviceId,
    roles: mergeStringList(existing.roles, payload.roles),
    scopes: mergeStringList(existing.scopes, payload.scopes),
    instanceId: payload.instanceId ?? parsed.instanceId ?? existing.instanceId,
    text: payload.text || parsed.text || existing.text,
    ts: Date.now()
  };
  entries.set(key, merged);
  const trackKeys = ['host', 'ip', 'version', 'mode', 'reason'];
  /** @type {Partial<SystemPresence>} */
  const changes = {};
  /** @type {string[]} */
  const changedKeys = [];
  for (const k of trackKeys) {
    const prev = existing[k];
    const next = merged[k];
    if (prev !== next) {
      changes[k] = next;
      changedKeys.push(k);
    }
  }
  return {
    key,
    previous: hadExisting ? existing : undefined,
    next: merged,
    changes,
    changedKeys
  };
}

/**
 * Upserts a presence entry by key.
 * @param {string} key
 * @param {Partial<SystemPresence>} presence
 */
export function upsertPresence(key, presence) {
  ensureSelfPresence();
  const normalizedKey = normalizePresenceKey(key) ?? os.hostname().toLowerCase();
  const existing = entries.get(normalizedKey) ?? /** @type {SystemPresence} */ ({});
  const roles = mergeStringList(existing.roles, presence.roles);
  const scopes = mergeStringList(existing.scopes, presence.scopes);
  /** @type {SystemPresence} */
  const merged = {
    ...existing,
    ...presence,
    roles,
    scopes,
    ts: Date.now(),
    text:
      presence.text ||
      existing.text ||
      `Node: ${presence.host ?? existing.host ?? 'unknown'} \u00B7 mode ${
        presence.mode ?? existing.mode ?? 'unknown'
      }`
  };
  entries.set(normalizedKey, merged);
}

/**
 * Lists all active system presence entries, pruning expired ones.
 * @returns {SystemPresence[]}
 */
export function listSystemPresence() {
  ensureSelfPresence();
  // prune expired
  const now = Date.now();
  for (const [k, v] of entries) {
    if (now - v.ts > TTL_MS) {
      entries.delete(k);
    }
  }
  // enforce max size (LRU by ts)
  if (entries.size > MAX_ENTRIES) {
    const sorted = [...entries.entries()].toSorted((a, b) => a[1].ts - b[1].ts);
    const toDrop = entries.size - MAX_ENTRIES;
    for (let i = 0; i < toDrop; i++) {
      entries.delete(sorted[i][0]);
    }
  }
  touchSelfPresence();
  return [...entries.values()].toSorted((a, b) => b.ts - a.ts);
}
