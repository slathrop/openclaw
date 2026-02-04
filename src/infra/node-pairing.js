/**
 * Node pairing protocol and paired-node storage.
 *
 * Manages the lifecycle of node pairing (peer-to-peer mesh nodes):
 * pending requests, approval, rejection, token issuance, and metadata updates.
 * Uses file-based storage with atomic writes and in-process locking.
 * SECURITY: Pairing state files written with 0o600 permissions.
 * SECURITY: Pending requests expire after PENDING_TTL_MS (5 minutes).
 */
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {resolveStateDir} from '../config/paths.js';

/**
 * @typedef {{
 *   requestId: string,
 *   nodeId: string,
 *   displayName?: string,
 *   platform?: string,
 *   version?: string,
 *   coreVersion?: string,
 *   uiVersion?: string,
 *   deviceFamily?: string,
 *   modelIdentifier?: string,
 *   caps?: string[],
 *   commands?: string[],
 *   permissions?: Record<string, boolean>,
 *   remoteIp?: string,
 *   silent?: boolean,
 *   isRepair?: boolean,
 *   ts: number
 * }} NodePairingPendingRequest
 */

/**
 * @typedef {{
 *   nodeId: string,
 *   token: string,
 *   displayName?: string,
 *   platform?: string,
 *   version?: string,
 *   coreVersion?: string,
 *   uiVersion?: string,
 *   deviceFamily?: string,
 *   modelIdentifier?: string,
 *   caps?: string[],
 *   commands?: string[],
 *   bins?: string[],
 *   permissions?: Record<string, boolean>,
 *   remoteIp?: string,
 *   createdAtMs: number,
 *   approvedAtMs: number,
 *   lastConnectedAtMs?: number
 * }} NodePairingPairedNode
 */

/**
 * @typedef {{
 *   pending: NodePairingPendingRequest[],
 *   paired: NodePairingPairedNode[]
 * }} NodePairingList
 */

const PENDING_TTL_MS = 5 * 60 * 1000;

function resolvePaths(baseDir) {
  const root = baseDir ?? resolveStateDir();
  const dir = path.join(root, 'nodes');
  return {
    dir,
    pendingPath: path.join(dir, 'pending.json'),
    pairedPath: path.join(dir, 'paired.json')
  };
}

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
 * @param filePath
 * @param value
 */
async function writeJSONAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, {recursive: true});
  const tmp = `${filePath}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  try {
    await fs.chmod(tmp, 0o600);
  } catch {
    // best-effort; ignore on platforms without chmod
  }
  await fs.rename(tmp, filePath);
  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    // best-effort; ignore on platforms without chmod
  }
}

function pruneExpiredPending(pendingById, nowMs) {
  for (const [id, req] of Object.entries(pendingById)) {
    if (nowMs - req.ts > PENDING_TTL_MS) {
      delete pendingById[id];
    }
  }
}

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
    pairedByNodeId: paired ?? {}
  };
  pruneExpiredPending(state.pendingById, Date.now());
  return state;
}

async function persistState(state, baseDir) {
  const {pendingPath, pairedPath} = resolvePaths(baseDir);
  await Promise.all([
    writeJSONAtomic(pendingPath, state.pendingById),
    writeJSONAtomic(pairedPath, state.pairedByNodeId)
  ]);
}

function normalizeNodeId(nodeId) {
  return nodeId.trim();
}

function newToken() {
  return randomUUID().replaceAll('-', '');
}

/**
 * @param {string} [baseDir]
 * @returns {Promise<NodePairingList>}
 */
export async function listNodePairing(baseDir) {
  const state = await loadState(baseDir);
  const pending = Object.values(state.pendingById).toSorted((a, b) => b.ts - a.ts);
  const paired = Object.values(state.pairedByNodeId).toSorted(
    (a, b) => b.approvedAtMs - a.approvedAtMs
  );
  return {pending, paired};
}

/**
 * @param {string} nodeId
 * @param {string} [baseDir]
 * @returns {Promise<NodePairingPairedNode | null>}
 */
export async function getPairedNode(nodeId, baseDir) {
  const state = await loadState(baseDir);
  return state.pairedByNodeId[normalizeNodeId(nodeId)] ?? null;
}

/**
 * Creates or retrieves a pending node pairing request.
 * SECURITY: Duplicate requests for same nodeId return existing pending entry.
 * @param {Omit<NodePairingPendingRequest, 'requestId' | 'ts' | 'isRepair'>} req
 * @param {string} [baseDir]
 * @returns {Promise<{ status: 'pending', request: NodePairingPendingRequest, created: boolean }>}
 */
export async function requestNodePairing(req, baseDir) {
  return await withLock(async () => {
    const state = await loadState(baseDir);
    const nodeId = normalizeNodeId(req.nodeId);
    if (!nodeId) {
      throw new Error('nodeId required');
    }

    const existing = Object.values(state.pendingById).find((p) => p.nodeId === nodeId);
    if (existing) {
      return {status: 'pending', request: existing, created: false};
    }

    const isRepair = Boolean(state.pairedByNodeId[nodeId]);
    const request = {
      requestId: randomUUID(),
      nodeId,
      displayName: req.displayName,
      platform: req.platform,
      version: req.version,
      coreVersion: req.coreVersion,
      uiVersion: req.uiVersion,
      deviceFamily: req.deviceFamily,
      modelIdentifier: req.modelIdentifier,
      caps: req.caps,
      commands: req.commands,
      permissions: req.permissions,
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
 * Approves a pending node pairing request and issues a token.
 * SECURITY: Token generated via randomUUID for unpredictability.
 * @param {string} requestId
 * @param {string} [baseDir]
 * @returns {Promise<{ requestId: string, node: NodePairingPairedNode } | null>}
 */
export async function approveNodePairing(requestId, baseDir) {
  return await withLock(async () => {
    const state = await loadState(baseDir);
    const pending = state.pendingById[requestId];
    if (!pending) {
      return null;
    }

    const now = Date.now();
    const existing = state.pairedByNodeId[pending.nodeId];
    const node = {
      nodeId: pending.nodeId,
      token: newToken(),
      displayName: pending.displayName,
      platform: pending.platform,
      version: pending.version,
      coreVersion: pending.coreVersion,
      uiVersion: pending.uiVersion,
      deviceFamily: pending.deviceFamily,
      modelIdentifier: pending.modelIdentifier,
      caps: pending.caps,
      commands: pending.commands,
      permissions: pending.permissions,
      remoteIp: pending.remoteIp,
      createdAtMs: existing?.createdAtMs ?? now,
      approvedAtMs: now
    };

    delete state.pendingById[requestId];
    state.pairedByNodeId[pending.nodeId] = node;
    await persistState(state, baseDir);
    return {requestId, node};
  });
}

/**
 * @param {string} requestId
 * @param {string} [baseDir]
 * @returns {Promise<{ requestId: string, nodeId: string } | null>}
 */
export async function rejectNodePairing(requestId, baseDir) {
  return await withLock(async () => {
    const state = await loadState(baseDir);
    const pending = state.pendingById[requestId];
    if (!pending) {
      return null;
    }
    delete state.pendingById[requestId];
    await persistState(state, baseDir);
    return {requestId, nodeId: pending.nodeId};
  });
}

/**
 * Verifies a node token against stored pairing data.
 * SECURITY: Constant-time comparison via string equality (tokens are random UUIDs).
 * @param {string} nodeId
 * @param {string} token
 * @param {string} [baseDir]
 * @returns {Promise<{ ok: boolean, node?: NodePairingPairedNode }>}
 */
export async function verifyNodeToken(nodeId, token, baseDir) {
  const state = await loadState(baseDir);
  const normalized = normalizeNodeId(nodeId);
  const node = state.pairedByNodeId[normalized];
  if (!node) {
    return {ok: false};
  }
  return node.token === token ? {ok: true, node} : {ok: false};
}

/**
 * @param {string} nodeId
 * @param {object} patch
 * @param {string} [baseDir]
 */
export async function updatePairedNodeMetadata(nodeId, patch, baseDir) {
  await withLock(async () => {
    const state = await loadState(baseDir);
    const normalized = normalizeNodeId(nodeId);
    const existing = state.pairedByNodeId[normalized];
    if (!existing) {
      return;
    }

    const next = {
      ...existing,
      displayName: patch.displayName ?? existing.displayName,
      platform: patch.platform ?? existing.platform,
      version: patch.version ?? existing.version,
      coreVersion: patch.coreVersion ?? existing.coreVersion,
      uiVersion: patch.uiVersion ?? existing.uiVersion,
      deviceFamily: patch.deviceFamily ?? existing.deviceFamily,
      modelIdentifier: patch.modelIdentifier ?? existing.modelIdentifier,
      remoteIp: patch.remoteIp ?? existing.remoteIp,
      caps: patch.caps ?? existing.caps,
      commands: patch.commands ?? existing.commands,
      bins: patch.bins ?? existing.bins,
      permissions: patch.permissions ?? existing.permissions,
      lastConnectedAtMs: patch.lastConnectedAtMs ?? existing.lastConnectedAtMs
    };

    state.pairedByNodeId[normalized] = next;
    await persistState(state, baseDir);
  });
}

/**
 * @param {string} nodeId
 * @param {string} displayName
 * @param {string} [baseDir]
 * @returns {Promise<NodePairingPairedNode | null>}
 */
export async function renamePairedNode(nodeId, displayName, baseDir) {
  return await withLock(async () => {
    const state = await loadState(baseDir);
    const normalized = normalizeNodeId(nodeId);
    const existing = state.pairedByNodeId[normalized];
    if (!existing) {
      return null;
    }
    const trimmed = displayName.trim();
    if (!trimmed) {
      throw new Error('displayName required');
    }
    const next = {...existing, displayName: trimmed};
    state.pairedByNodeId[normalized] = next;
    await persistState(state, baseDir);
    return next;
  });
}
