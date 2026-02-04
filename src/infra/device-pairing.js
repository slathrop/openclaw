/**
 * Device pairing protocol and paired-device storage.
 *
 * Manages the lifecycle of device pairing: pending requests, approval,
 * rejection, token issuance, rotation, and revocation. Uses file-based
 * storage with atomic writes and in-process locking.
 * SECURITY: Pairing state files written with 0o600 permissions.
 * SECURITY: Pending requests expire after PENDING_TTL_MS (5 minutes).
 * SECURITY: Token operations use randomUUID for unpredictable values.
 */
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {resolveStateDir} from '../config/paths.js';

/**
 * @typedef {{
 *   requestId: string,
 *   deviceId: string,
 *   publicKey: string,
 *   displayName?: string,
 *   platform?: string,
 *   clientId?: string,
 *   clientMode?: string,
 *   role?: string,
 *   roles?: string[],
 *   scopes?: string[],
 *   remoteIp?: string,
 *   silent?: boolean,
 *   isRepair?: boolean,
 *   ts: number
 * }} DevicePairingPendingRequest
 */

/**
 * @typedef {{
 *   token: string,
 *   role: string,
 *   scopes: string[],
 *   createdAtMs: number,
 *   rotatedAtMs?: number,
 *   revokedAtMs?: number,
 *   lastUsedAtMs?: number
 * }} DeviceAuthToken
 */

/**
 * @typedef {{
 *   role: string,
 *   scopes: string[],
 *   createdAtMs: number,
 *   rotatedAtMs?: number,
 *   revokedAtMs?: number,
 *   lastUsedAtMs?: number
 * }} DeviceAuthTokenSummary
 */

/**
 * @typedef {{
 *   deviceId: string,
 *   publicKey: string,
 *   displayName?: string,
 *   platform?: string,
 *   clientId?: string,
 *   clientMode?: string,
 *   role?: string,
 *   roles?: string[],
 *   scopes?: string[],
 *   remoteIp?: string,
 *   tokens?: Record<string, DeviceAuthToken>,
 *   createdAtMs: number,
 *   approvedAtMs: number
 * }} PairedDevice
 */

/**
 * @typedef {{
 *   pending: DevicePairingPendingRequest[],
 *   paired: PairedDevice[]
 * }} DevicePairingList
 */

const PENDING_TTL_MS = 5 * 60 * 1000;

function resolvePaths(baseDir) {
  const root = baseDir ?? resolveStateDir();
  const dir = path.join(root, 'devices');
  return {
    dir,
    pendingPath: path.join(dir, 'pending.json'),
    pairedPath: path.join(dir, 'paired.json')
  };
}

/**
 * @param {string} filePath
 * @returns {Promise<object | null>}
 */
async function readJSON(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * SECURITY: Atomic write via temp file + rename; permissions set to 0o600.
 * @param {string} filePath
 * @param {unknown} value
 */
async function writeJSONAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, {recursive: true});
  const tmp = `${filePath}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  try {
    await fs.chmod(tmp, 0o600);
  } catch {
    // best-effort
  }
  await fs.rename(tmp, filePath);
  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    // best-effort
  }
}

function pruneExpiredPending(pendingById, nowMs) {
  for (const [id, req] of Object.entries(pendingById)) {
    if (nowMs - req.ts > PENDING_TTL_MS) {
      delete pendingById[id];
    }
  }
}

// In-process sequential lock to prevent concurrent file mutations
let lock = Promise.resolve();
async function withLock(fn) {
  const prev = lock;
  let release;
  lock = new Promise((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    return await fn();
  } finally {
    release?.();
  }
}

async function loadState(baseDir) {
  const {pendingPath, pairedPath} = resolvePaths(baseDir);
  const [pending, paired] = await Promise.all([
    readJSON(pendingPath),
    readJSON(pairedPath)
  ]);
  const state = {
    pendingById: pending ?? {},
    pairedByDeviceId: paired ?? {}
  };
  pruneExpiredPending(state.pendingById, Date.now());
  return state;
}

async function persistState(state, baseDir) {
  const {pendingPath, pairedPath} = resolvePaths(baseDir);
  await Promise.all([
    writeJSONAtomic(pendingPath, state.pendingById),
    writeJSONAtomic(pairedPath, state.pairedByDeviceId)
  ]);
}

function normalizeDeviceId(deviceId) {
  return deviceId.trim();
}

/**
 * @param {string | undefined} role
 * @returns {string | null}
 */
function normalizeRole(role) {
  const trimmed = role?.trim();
  return trimmed ? trimmed : null;
}

function mergeRoles(...items) {
  const roles = new Set();
  for (const item of items) {
    if (!item) {
      continue;
    }
    if (Array.isArray(item)) {
      for (const role of item) {
        const trimmed = role.trim();
        if (trimmed) {
          roles.add(trimmed);
        }
      }
    } else {
      const trimmed = item.trim();
      if (trimmed) {
        roles.add(trimmed);
      }
    }
  }
  if (roles.size === 0) {
    return undefined;
  }
  return [...roles];
}

function mergeScopes(...items) {
  const scopes = new Set();
  for (const item of items) {
    if (!item) {
      continue;
    }
    for (const scope of item) {
      const trimmed = scope.trim();
      if (trimmed) {
        scopes.add(trimmed);
      }
    }
  }
  if (scopes.size === 0) {
    return undefined;
  }
  return [...scopes];
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes)) {
    return [];
  }
  const out = new Set();
  for (const scope of scopes) {
    const trimmed = scope.trim();
    if (trimmed) {
      out.add(trimmed);
    }
  }
  return [...out].toSorted();
}

/**
 * SECURITY: Validates that all requested scopes exist in allowed set.
 * @param {string[]} requested
 * @param {string[]} allowed
 * @returns {boolean}
 */
function scopesAllow(requested, allowed) {
  if (requested.length === 0) {
    return true;
  }
  if (allowed.length === 0) {
    return false;
  }
  const allowedSet = new Set(allowed);
  return requested.every((scope) => allowedSet.has(scope));
}

function newToken() {
  return randomUUID().replaceAll('-', '');
}

/**
 * @param {string} [baseDir]
 * @returns {Promise<DevicePairingList>}
 */
export async function listDevicePairing(baseDir) {
  const state = await loadState(baseDir);
  const pending = Object.values(state.pendingById).toSorted((a, b) => b.ts - a.ts);
  const paired = Object.values(state.pairedByDeviceId).toSorted(
    (a, b) => b.approvedAtMs - a.approvedAtMs
  );
  return {pending, paired};
}

/**
 * @param {string} deviceId
 * @param {string} [baseDir]
 * @returns {Promise<PairedDevice | null>}
 */
export async function getPairedDevice(deviceId, baseDir) {
  const state = await loadState(baseDir);
  return state.pairedByDeviceId[normalizeDeviceId(deviceId)] ?? null;
}

/**
 * Creates or retrieves a pending pairing request for a device.
 * SECURITY: Duplicate requests for same deviceId return existing pending entry.
 * @param {Omit<DevicePairingPendingRequest, 'requestId' | 'ts' | 'isRepair'>} req
 * @param {string} [baseDir]
 * @returns {Promise<{ status: 'pending', request: DevicePairingPendingRequest, created: boolean }>}
 */
export async function requestDevicePairing(req, baseDir) {
  return await withLock(async () => {
    const state = await loadState(baseDir);
    const deviceId = normalizeDeviceId(req.deviceId);
    if (!deviceId) {
      throw new Error('deviceId required');
    }
    const existing = Object.values(state.pendingById).find((p) => p.deviceId === deviceId);
    if (existing) {
      return {status: 'pending', request: existing, created: false};
    }
    const isRepair = Boolean(state.pairedByDeviceId[deviceId]);
    const request = {
      requestId: randomUUID(),
      deviceId,
      publicKey: req.publicKey,
      displayName: req.displayName,
      platform: req.platform,
      clientId: req.clientId,
      clientMode: req.clientMode,
      role: req.role,
      roles: req.role ? [req.role] : undefined,
      scopes: req.scopes,
      remoteIp: req.remoteIp,
      silent: req.silent,
      isRepair,
      ts: Date.now()
    };
    state.pendingById[request.requestId] = request;
    await persistState(state, baseDir);
    return {status: 'pending', request, created: true};
  });
}

/**
 * Approves a pending device pairing request and issues a token.
 * SECURITY: Merges roles/scopes from existing paired device if re-pairing.
 * @param {string} requestId
 * @param {string} [baseDir]
 * @returns {Promise<{ requestId: string, device: PairedDevice } | null>}
 */
export async function approveDevicePairing(requestId, baseDir) {
  return await withLock(async () => {
    const state = await loadState(baseDir);
    const pending = state.pendingById[requestId];
    if (!pending) {
      return null;
    }
    const now = Date.now();
    const existing = state.pairedByDeviceId[pending.deviceId];
    const roles = mergeRoles(existing?.roles, existing?.role, pending.roles, pending.role);
    const scopes = mergeScopes(existing?.scopes, pending.scopes);
    const tokens = existing?.tokens ? {...existing.tokens} : {};
    const roleForToken = normalizeRole(pending.role);
    if (roleForToken) {
      const nextScopes = normalizeScopes(pending.scopes);
      const existingToken = tokens[roleForToken];
      const now = Date.now();
      tokens[roleForToken] = {
        token: newToken(),
        role: roleForToken,
        scopes: nextScopes,
        createdAtMs: existingToken?.createdAtMs ?? now,
        rotatedAtMs: existingToken ? now : undefined,
        revokedAtMs: undefined,
        lastUsedAtMs: existingToken?.lastUsedAtMs
      };
    }
    const device = {
      deviceId: pending.deviceId,
      publicKey: pending.publicKey,
      displayName: pending.displayName,
      platform: pending.platform,
      clientId: pending.clientId,
      clientMode: pending.clientMode,
      role: pending.role,
      roles,
      scopes,
      remoteIp: pending.remoteIp,
      tokens,
      createdAtMs: existing?.createdAtMs ?? now,
      approvedAtMs: now
    };
    delete state.pendingById[requestId];
    state.pairedByDeviceId[device.deviceId] = device;
    await persistState(state, baseDir);
    return {requestId, device};
  });
}

/**
 * @param {string} requestId
 * @param {string} [baseDir]
 * @returns {Promise<{ requestId: string, deviceId: string } | null>}
 */
export async function rejectDevicePairing(requestId, baseDir) {
  return await withLock(async () => {
    const state = await loadState(baseDir);
    const pending = state.pendingById[requestId];
    if (!pending) {
      return null;
    }
    delete state.pendingById[requestId];
    await persistState(state, baseDir);
    return {requestId, deviceId: pending.deviceId};
  });
}

/**
 * @param {string} deviceId
 * @param {object} patch
 * @param {string} [baseDir]
 */
export async function updatePairedDeviceMetadata(deviceId, patch, baseDir) {
  return await withLock(async () => {
    const state = await loadState(baseDir);
    const existing = state.pairedByDeviceId[normalizeDeviceId(deviceId)];
    if (!existing) {
      return;
    }
    const roles = mergeRoles(existing.roles, existing.role, patch.role);
    const scopes = mergeScopes(existing.scopes, patch.scopes);
    state.pairedByDeviceId[deviceId] = {
      ...existing,
      ...patch,
      deviceId: existing.deviceId,
      createdAtMs: existing.createdAtMs,
      approvedAtMs: existing.approvedAtMs,
      role: patch.role ?? existing.role,
      roles,
      scopes
    };
    await persistState(state, baseDir);
  });
}

/**
 * @param {Record<string, DeviceAuthToken> | undefined} tokens
 * @returns {DeviceAuthTokenSummary[] | undefined}
 */
export function summarizeDeviceTokens(tokens) {
  if (!tokens) {
    return undefined;
  }
  const summaries = Object.values(tokens)
    .map((token) => ({
      role: token.role,
      scopes: token.scopes,
      createdAtMs: token.createdAtMs,
      rotatedAtMs: token.rotatedAtMs,
      revokedAtMs: token.revokedAtMs,
      lastUsedAtMs: token.lastUsedAtMs
    }))
    .toSorted((a, b) => a.role.localeCompare(b.role));
  return summaries.length > 0 ? summaries : undefined;
}

/**
 * Verifies a device auth token and updates last-used timestamp.
 * SECURITY: Validates device pairing, role, revocation status, token match, and scope coverage.
 * @param {{ deviceId: string, token: string, role: string, scopes: string[], baseDir?: string }} params
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function verifyDeviceToken(params) {
  return await withLock(async () => {
    const state = await loadState(params.baseDir);
    const device = state.pairedByDeviceId[normalizeDeviceId(params.deviceId)];
    if (!device) {
      return {ok: false, reason: 'device-not-paired'};
    }
    const role = normalizeRole(params.role);
    if (!role) {
      return {ok: false, reason: 'role-missing'};
    }
    const entry = device.tokens?.[role];
    if (!entry) {
      return {ok: false, reason: 'token-missing'};
    }
    if (entry.revokedAtMs) {
      return {ok: false, reason: 'token-revoked'};
    }
    if (entry.token !== params.token) {
      return {ok: false, reason: 'token-mismatch'};
    }
    const requestedScopes = normalizeScopes(params.scopes);
    if (!scopesAllow(requestedScopes, entry.scopes)) {
      return {ok: false, reason: 'scope-mismatch'};
    }
    entry.lastUsedAtMs = Date.now();
    device.tokens ??= {};
    device.tokens[role] = entry;
    state.pairedByDeviceId[device.deviceId] = device;
    await persistState(state, params.baseDir);
    return {ok: true};
  });
}

/**
 * Ensures a valid token exists for a device/role, creating one if needed.
 * @param {{ deviceId: string, role: string, scopes: string[], baseDir?: string }} params
 * @returns {Promise<DeviceAuthToken | null>}
 */
export async function ensureDeviceToken(params) {
  return await withLock(async () => {
    const state = await loadState(params.baseDir);
    const device = state.pairedByDeviceId[normalizeDeviceId(params.deviceId)];
    if (!device) {
      return null;
    }
    const role = normalizeRole(params.role);
    if (!role) {
      return null;
    }
    const requestedScopes = normalizeScopes(params.scopes);
    const tokens = device.tokens ? {...device.tokens} : {};
    const existing = tokens[role];
    if (existing && !existing.revokedAtMs) {
      if (scopesAllow(requestedScopes, existing.scopes)) {
        return existing;
      }
    }
    const now = Date.now();
    const next = {
      token: newToken(),
      role,
      scopes: requestedScopes,
      createdAtMs: existing?.createdAtMs ?? now,
      rotatedAtMs: existing ? now : undefined,
      revokedAtMs: undefined,
      lastUsedAtMs: existing?.lastUsedAtMs
    };
    tokens[role] = next;
    device.tokens = tokens;
    state.pairedByDeviceId[device.deviceId] = device;
    await persistState(state, params.baseDir);
    return next;
  });
}

/**
 * Rotates a device auth token, issuing a new token value.
 * SECURITY: Old token is immediately invalidated; new token generated via randomUUID.
 * @param {{ deviceId: string, role: string, scopes?: string[], baseDir?: string }} params
 * @returns {Promise<DeviceAuthToken | null>}
 */
export async function rotateDeviceToken(params) {
  return await withLock(async () => {
    const state = await loadState(params.baseDir);
    const device = state.pairedByDeviceId[normalizeDeviceId(params.deviceId)];
    if (!device) {
      return null;
    }
    const role = normalizeRole(params.role);
    if (!role) {
      return null;
    }
    const tokens = device.tokens ? {...device.tokens} : {};
    const existing = tokens[role];
    const requestedScopes = normalizeScopes(params.scopes ?? existing?.scopes ?? device.scopes);
    const now = Date.now();
    const next = {
      token: newToken(),
      role,
      scopes: requestedScopes,
      createdAtMs: existing?.createdAtMs ?? now,
      rotatedAtMs: now,
      revokedAtMs: undefined,
      lastUsedAtMs: existing?.lastUsedAtMs
    };
    tokens[role] = next;
    device.tokens = tokens;
    if (params.scopes !== undefined) {
      device.scopes = requestedScopes;
    }
    state.pairedByDeviceId[device.deviceId] = device;
    await persistState(state, params.baseDir);
    return next;
  });
}

/**
 * Revokes a device auth token by marking it with a revokedAtMs timestamp.
 * SECURITY: Revoked tokens remain in storage for audit trail but fail verification.
 * @param {{ deviceId: string, role: string, baseDir?: string }} params
 * @returns {Promise<DeviceAuthToken | null>}
 */
export async function revokeDeviceToken(params) {
  return await withLock(async () => {
    const state = await loadState(params.baseDir);
    const device = state.pairedByDeviceId[normalizeDeviceId(params.deviceId)];
    if (!device) {
      return null;
    }
    const role = normalizeRole(params.role);
    if (!role) {
      return null;
    }
    if (!device.tokens?.[role]) {
      return null;
    }
    const tokens = {...device.tokens};
    const entry = {...tokens[role], revokedAtMs: Date.now()};
    tokens[role] = entry;
    device.tokens = tokens;
    state.pairedByDeviceId[device.deviceId] = device;
    await persistState(state, params.baseDir);
    return entry;
  });
}
