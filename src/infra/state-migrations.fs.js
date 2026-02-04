/**
 * Filesystem helpers for state migration operations.
 *
 * Provides synchronous directory/file existence checks, JSON5 session store
 * reading, and WhatsApp auth file detection for the migration subsystem.
 */
import JSON5 from 'json5';
import fs from 'node:fs';

/**
 * @typedef {{
 *   sessionId?: string,
 *   updatedAt?: number
 * } & Record<string, unknown>} SessionEntryLike
 */

/**
 * @param {string} dir
 * @returns {fs.Dirent[]}
 */
export function safeReadDir(dir) {
  try {
    return fs.readdirSync(dir, {withFileTypes: true});
  } catch {
    return [];
  }
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
export function existsDir(dir) {
  try {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * @param {string} dir
 */
export function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true});
}

/**
 * @param {string} p
 * @returns {boolean}
 */
export function fileExists(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isLegacyWhatsAppAuthFile(name) {
  if (name === 'creds.json' || name === 'creds.json.bak') {
    return true;
  }
  if (!name.endsWith('.json')) {
    return false;
  }
  return /^(app-state-sync|session|sender-key|pre-key)-/.test(name);
}

/**
 * Read and parse a JSON5 session store file.
 * @param {string} storePath
 * @returns {{ store: Record<string, SessionEntryLike>, ok: boolean }}
 */
export function readSessionStoreJson5(storePath) {
  try {
    const raw = fs.readFileSync(storePath, 'utf-8');
    const parsed = JSON5.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {store: parsed, ok: true};
    }
  } catch {
    // ignore
  }
  return {store: {}, ok: false};
}
