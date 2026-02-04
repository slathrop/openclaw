/**
 * Device authentication token storage.
 *
 * Persists per-device auth tokens to disk with role-based scoping.
 * SECURITY: Token file written with mode 0o600 to prevent unauthorized reads.
 * SECURITY: chmod applied as best-effort fallback for platform compatibility.
 */
import fs from 'node:fs';
import path from 'node:path';
import {resolveStateDir} from '../config/paths.js';

/**
 * @typedef {{
 *   token: string,
 *   role: string,
 *   scopes: string[],
 *   updatedAtMs: number
 * }} DeviceAuthEntry
 */

const DEVICE_AUTH_FILE = 'device-auth.json';

/**
 * Resolves the path to the device auth store file.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
function resolveDeviceAuthPath(env = process.env) {
  return path.join(resolveStateDir(env), 'identity', DEVICE_AUTH_FILE);
}

/**
 * @param {string} role
 * @returns {string}
 */
function normalizeRole(role) {
  return role.trim();
}

/**
 * @param {string[] | undefined} scopes
 * @returns {string[]}
 */
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
 * Reads and validates the device auth store from disk.
 * SECURITY: Validates store structure before returning to prevent deserialization attacks.
 * @param {string} filePath
 * @returns {object | null}
 */
function readStore(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || typeof parsed.deviceId !== 'string') {
      return null;
    }
    if (!parsed.tokens || typeof parsed.tokens !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Writes the device auth store to disk atomically.
 * SECURITY: File permissions set to 0o600 (owner read/write only).
 * @param {string} filePath
 * @param {object} store
 */
function writeStore(filePath, store) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, {mode: 0o600});
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // best-effort
  }
}

/**
 * Loads a device auth token for a given device and role.
 * @param {{ deviceId: string, role: string, env?: NodeJS.ProcessEnv }} params
 * @returns {DeviceAuthEntry | null}
 */
export function loadDeviceAuthToken(params) {
  const filePath = resolveDeviceAuthPath(params.env);
  const store = readStore(filePath);
  if (!store) {
    return null;
  }
  if (store.deviceId !== params.deviceId) {
    return null;
  }
  const role = normalizeRole(params.role);
  const entry = store.tokens[role];
  if (!entry || typeof entry.token !== 'string') {
    return null;
  }
  return entry;
}

/**
 * Stores a device auth token, creating or updating the store file.
 * SECURITY: Overwrites existing token for the role; file permissions enforced on write.
 * @param {{ deviceId: string, role: string, token: string, scopes?: string[], env?: NodeJS.ProcessEnv }} params
 * @returns {DeviceAuthEntry}
 */
export function storeDeviceAuthToken(params) {
  const filePath = resolveDeviceAuthPath(params.env);
  const existing = readStore(filePath);
  const role = normalizeRole(params.role);
  const next = {
    version: 1,
    deviceId: params.deviceId,
    tokens:
      existing && existing.deviceId === params.deviceId && existing.tokens
        ? {...existing.tokens}
        : {}
  };
  const entry = {
    token: params.token,
    role,
    scopes: normalizeScopes(params.scopes),
    updatedAtMs: Date.now()
  };
  next.tokens[role] = entry;
  writeStore(filePath, next);
  return entry;
}

/**
 * Clears a device auth token for a given device and role.
 * @param {{ deviceId: string, role: string, env?: NodeJS.ProcessEnv }} params
 */
export function clearDeviceAuthToken(params) {
  const filePath = resolveDeviceAuthPath(params.env);
  const store = readStore(filePath);
  if (!store || store.deviceId !== params.deviceId) {
    return;
  }
  const role = normalizeRole(params.role);
  if (!store.tokens[role]) {
    return;
  }
  const next = {
    version: 1,
    deviceId: store.deviceId,
    tokens: {...store.tokens}
  };
  delete next.tokens[role];
  writeStore(filePath, next);
}
