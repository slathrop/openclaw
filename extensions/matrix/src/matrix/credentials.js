import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getMatrixRuntime } from '../runtime.js';
const CREDENTIALS_FILENAME = 'credentials.json';
function resolveMatrixCredentialsDir(env = process.env, stateDir) {
  const resolvedStateDir = stateDir ?? getMatrixRuntime().state.resolveStateDir(env, os.homedir);
  return path.join(resolvedStateDir, 'credentials', 'matrix');
}
function resolveMatrixCredentialsPath(env = process.env) {
  const dir = resolveMatrixCredentialsDir(env);
  return path.join(dir, CREDENTIALS_FILENAME);
}
function loadMatrixCredentials(env = process.env) {
  const credPath = resolveMatrixCredentialsPath(env);
  try {
    if (!fs.existsSync(credPath)) {
      return null;
    }
    const raw = fs.readFileSync(credPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.homeserver !== 'string' || typeof parsed.userId !== 'string' || typeof parsed.accessToken !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function saveMatrixCredentials(credentials, env = process.env) {
  const dir = resolveMatrixCredentialsDir(env);
  fs.mkdirSync(dir, { recursive: true });
  const credPath = resolveMatrixCredentialsPath(env);
  const existing = loadMatrixCredentials(env);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const toSave = {
    ...credentials,
    createdAt: existing?.createdAt ?? now,
    lastUsedAt: now
  };
  fs.writeFileSync(credPath, JSON.stringify(toSave, null, 2), 'utf-8');
}
function touchMatrixCredentials(env = process.env) {
  const existing = loadMatrixCredentials(env);
  if (!existing) {
    return;
  }
  existing.lastUsedAt = (/* @__PURE__ */ new Date()).toISOString();
  const credPath = resolveMatrixCredentialsPath(env);
  fs.writeFileSync(credPath, JSON.stringify(existing, null, 2), 'utf-8');
}
function clearMatrixCredentials(env = process.env) {
  const credPath = resolveMatrixCredentialsPath(env);
  try {
    if (fs.existsSync(credPath)) {
      fs.unlinkSync(credPath);
    }
  } catch { /* intentionally empty */ }
}
function credentialsMatchConfig(stored, config) {
  if (!config.userId) {
    return stored.homeserver === config.homeserver;
  }
  return stored.homeserver === config.homeserver && stored.userId === config.userId;
}
export {
  clearMatrixCredentials,
  credentialsMatchConfig,
  loadMatrixCredentials,
  resolveMatrixCredentialsDir,
  resolveMatrixCredentialsPath,
  saveMatrixCredentials,
  touchMatrixCredentials
};
