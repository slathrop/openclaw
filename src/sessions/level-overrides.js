/**
 * Session verbose level override parsing and application.
 *
 * Validates and applies user-specified verbose level overrides
 * to session entries, supporting on/off toggling and reset.
 */
import { normalizeVerboseLevel } from '../auto-reply/thinking.js';

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: string | null | undefined } | { ok: false, error: string }}
 */
export const parseVerboseOverride = (raw) => {
  if (raw === null) {
    return { ok: true, value: null };
  }
  if (raw === undefined) {
    return { ok: true, value: undefined };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: 'invalid verboseLevel (use "on"|"off")' };
  }
  const normalized = normalizeVerboseLevel(raw);
  if (!normalized) {
    return { ok: false, error: 'invalid verboseLevel (use "on"|"off")' };
  }
  return { ok: true, value: normalized };
};

/**
 * @param {object} entry
 * @param {string | null | undefined} level
 */
export const applyVerboseOverride = (entry, level) => {
  if (level === undefined) {
    return;
  }
  if (level === null) {
    delete entry.verboseLevel;
    return;
  }
  entry.verboseLevel = level;
};
