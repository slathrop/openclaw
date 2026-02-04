/**
 * Voice wake trigger word configuration store.
 *
 * Persists and loads wake word triggers for voice activation.
 * Uses atomic file writes and a serialized lock to prevent
 * concurrent write corruption.
 */
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {resolveStateDir} from '../config/paths.js';

/**
 * @typedef {{
 *   triggers: string[],
 *   updatedAtMs: number
 * }} VoiceWakeConfig
 */

const DEFAULT_TRIGGERS = ['openclaw', 'claude', 'computer'];

/**
 * @param {string} [baseDir]
 * @returns {string}
 */
function resolvePath(baseDir) {
  const root = baseDir ?? resolveStateDir();
  return path.join(root, 'settings', 'voicewake.json');
}

/**
 * @param {string[] | undefined | null} triggers
 * @returns {string[]}
 */
function sanitizeTriggers(triggers) {
  const cleaned = (triggers ?? [])
    .map((w) => (typeof w === 'string' ? w.trim() : ''))
    .filter((w) => w.length > 0);
  return cleaned.length > 0 ? cleaned : DEFAULT_TRIGGERS;
}

/**
 * @param {string} filePath
 * @returns {Promise<* | null>}
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
 * @param {string} filePath
 * @param {unknown} value
 * @returns {Promise<void>}
 */
async function writeJSONAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, {recursive: true});
  const tmp = `${filePath}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, filePath);
}

let lock = Promise.resolve();

/**
 * Serializes async operations to prevent concurrent writes.
 * @param {() => Promise<*>} fn
 * @returns {Promise<*>}
 */
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

/**
 * Returns the default voice wake trigger words.
 * @returns {string[]}
 */
export function defaultVoiceWakeTriggers() {
  return [...DEFAULT_TRIGGERS];
}

/**
 * Loads the voice wake configuration from disk.
 * @param {string} [baseDir]
 * @returns {Promise<VoiceWakeConfig>}
 */
export async function loadVoiceWakeConfig(baseDir) {
  const filePath = resolvePath(baseDir);
  const existing = await readJSON(filePath);
  if (!existing) {
    return {triggers: defaultVoiceWakeTriggers(), updatedAtMs: 0};
  }
  return {
    triggers: sanitizeTriggers(existing.triggers),
    updatedAtMs:
      typeof existing.updatedAtMs === 'number' && existing.updatedAtMs > 0
        ? existing.updatedAtMs
        : 0
  };
}

/**
 * Saves new voice wake trigger words to disk.
 * @param {string[]} triggers
 * @param {string} [baseDir]
 * @returns {Promise<VoiceWakeConfig>}
 */
export async function setVoiceWakeTriggers(triggers, baseDir) {
  const sanitized = sanitizeTriggers(triggers);
  const filePath = resolvePath(baseDir);
  return await withLock(async () => {
    const next = {
      triggers: sanitized,
      updatedAtMs: Date.now()
    };
    await writeJSONAtomic(filePath, next);
    return next;
  });
}
