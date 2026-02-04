/**
 * Root utility module for path resolution, WhatsApp JID handling,
 * string formatting, and configuration directory management.
 *
 * Provides sleep, path normalization, E.164 phone number handling,
 * UTF-16-safe string slicing, terminal link formatting, and the
 * global CONFIG_DIR constant.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {resolveOAuthDir} from './config/paths.js';
import {logVerbose, shouldLogVerbose} from './globals.js';

/**
 * Ensures a directory exists, creating it recursively if needed.
 * @param {string} dir
 * @returns {Promise<void>}
 */
export async function ensureDir(dir) {
  await fs.promises.mkdir(dir, {recursive: true});
}

/**
 * Clamps a number to the given range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamps a number to the given range, flooring to an integer first.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clampInt(value, min, max) {
  return clampNumber(Math.floor(value), min, max);
}

/**
 * @typedef {'web'} WebChannel
 */

/**
 * Asserts that the input string is exactly 'web'.
 * @param {string} input
 */
export function assertWebChannel(input) {
  if (input !== 'web') {
    throw new Error('Web channel must be \'web\'');
  }
}

/**
 * Ensures a path starts with a leading slash.
 * @param {string} p
 * @returns {string}
 */
export function normalizePath(p) {
  if (!p.startsWith('/')) {
    return `/${p}`;
  }
  return p;
}

/**
 * Adds the 'whatsapp:' prefix if not already present.
 * @param {string} number
 * @returns {string}
 */
export function withWhatsAppPrefix(number) {
  return number.startsWith('whatsapp:') ? number : `whatsapp:${number}`;
}

/**
 * Normalizes a phone number to E.164 format.
 * @param {string} number
 * @returns {string}
 */
export function normalizeE164(number) {
  const withoutPrefix = number.replace(/^whatsapp:/, '').trim();
  const digits = withoutPrefix.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    return `+${digits.slice(1)}`;
  }
  return `+${digits}`;
}

/**
 * "Self-chat mode" heuristic (single phone): the gateway is logged in as the owner's own WhatsApp account,
 * and `channels.whatsapp.allowFrom` includes that same number. Used to avoid side-effects that make no sense when the
 * "bot" and the human are the same WhatsApp identity (e.g. auto read receipts, @mention JID triggers).
 * @param {string | null | undefined} selfE164
 * @param {Array<string | number> | null} [allowFrom]
 * @returns {boolean}
 */
export function isSelfChatMode(selfE164, allowFrom) {
  if (!selfE164) {
    return false;
  }
  if (!Array.isArray(allowFrom) || allowFrom.length === 0) {
    return false;
  }
  const normalizedSelf = normalizeE164(selfE164);
  return allowFrom.some((n) => {
    if (n === '*') {
      return false;
    }
    try {
      return normalizeE164(String(n)) === normalizedSelf;
    } catch {
      return false;
    }
  });
}

/**
 * Converts a phone number to a WhatsApp JID.
 * @param {string} number
 * @returns {string}
 */
export function toWhatsappJid(number) {
  const withoutPrefix = number.replace(/^whatsapp:/, '').trim();
  if (withoutPrefix.includes('@')) {
    return withoutPrefix;
  }
  const e164 = normalizeE164(withoutPrefix);
  const digits = e164.replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}

/**
 * @typedef {object} JidToE164Options
 * @property {string} [authDir]
 * @property {string[]} [lidMappingDirs]
 * @property {boolean} [logMissing]
 */

/**
 * Resolves LID mapping directories from options, OAuth dir, and CONFIG_DIR.
 * @param {JidToE164Options} [opts]
 * @returns {string[]}
 */
function resolveLidMappingDirs(opts) {
  const dirs = new Set();
  const addDir = (dir) => {
    if (!dir) {
      return;
    }
    dirs.add(resolveUserPath(dir));
  };
  addDir(opts?.authDir);
  for (const dir of opts?.lidMappingDirs ?? []) {
    addDir(dir);
  }
  addDir(resolveOAuthDir());
  addDir(path.join(CONFIG_DIR, 'credentials'));
  return [...dirs];
}

/**
 * Reads a LID reverse mapping file from the configured directories.
 * @param {string} lid
 * @param {JidToE164Options} [opts]
 * @returns {string | null}
 */
function readLidReverseMapping(lid, opts) {
  const mappingFilename = `lid-mapping-${lid}_reverse.json`;
  const mappingDirs = resolveLidMappingDirs(opts);
  for (const dir of mappingDirs) {
    const mappingPath = path.join(dir, mappingFilename);
    try {
      const data = fs.readFileSync(mappingPath, 'utf8');
      const phone = JSON.parse(data);
      if (phone === null || phone === undefined) {
        continue;
      }
      return normalizeE164(String(phone));
    } catch {
      // Try the next location.
    }
  }
  return null;
}

/**
 * Converts a WhatsApp JID back to E.164 format.
 * Supports standard JIDs, hosted JIDs, and LID reverse lookups.
 * @param {string} jid
 * @param {JidToE164Options} [opts]
 * @returns {string | null}
 */
export function jidToE164(jid, opts) {
  // Convert a WhatsApp JID (with optional device suffix, e.g. 1234:1@s.whatsapp.net) back to +1234.
  const match = jid.match(/^(\d+)(?::\d+)?@(s\.whatsapp\.net|hosted)$/);
  if (match) {
    const digits = match[1];
    return `+${digits}`;
  }

  // Support @lid format (WhatsApp Linked ID) - look up reverse mapping
  const lidMatch = jid.match(/^(\d+)(?::\d+)?@(lid|hosted\.lid)$/);
  if (lidMatch) {
    const lid = lidMatch[1];
    const phone = readLidReverseMapping(lid, opts);
    if (phone) {
      return phone;
    }
    const shouldLog = opts?.logMissing ?? shouldLogVerbose();
    if (shouldLog) {
      logVerbose(`LID mapping not found for ${lid}; skipping inbound message`);
    }
  }

  return null;
}

/**
 * Async version of jidToE164 with optional LID lookup fallback.
 * @param {string | null | undefined} jid
 * @param {JidToE164Options & {lidLookup?: {getPNForLID?: (jid: string) => Promise<string | null>}}} [opts]
 * @returns {Promise<string | null>}
 */
export async function resolveJidToE164(jid, opts) {
  if (!jid) {
    return null;
  }
  const direct = jidToE164(jid, opts);
  if (direct) {
    return direct;
  }
  if (!/(@lid|@hosted\.lid)$/.test(jid)) {
    return null;
  }
  if (!opts?.lidLookup?.getPNForLID) {
    return null;
  }
  try {
    const pnJid = await opts.lidLookup.getPNForLID(jid);
    if (!pnJid) {
      return null;
    }
    return jidToE164(pnJid, opts);
  } catch (err) {
    if (shouldLogVerbose()) {
      logVerbose(`LID mapping lookup failed for ${jid}: ${String(err)}`);
    }
    return null;
  }
}

/**
 * Returns a promise that resolves after the given delay in milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {number} codeUnit
 * @returns {boolean}
 */
function isHighSurrogate(codeUnit) {
  return codeUnit >= 0xd800 && codeUnit <= 0xdbff;
}

/**
 * @param {number} codeUnit
 * @returns {boolean}
 */
function isLowSurrogate(codeUnit) {
  return codeUnit >= 0xdc00 && codeUnit <= 0xdfff;
}

/**
 * UTF-16-safe string slice that avoids splitting surrogate pairs.
 * @param {string} input
 * @param {number} start
 * @param {number} [end]
 * @returns {string}
 */
export function sliceUtf16Safe(input, start, end) {
  const len = input.length;

  let from = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
  let to = end === undefined ? len : end < 0 ? Math.max(len + end, 0) : Math.min(end, len);

  if (to < from) {
    const tmp = from;
    from = to;
    to = tmp;
  }

  if (from > 0 && from < len) {
    const codeUnit = input.charCodeAt(from);
    if (isLowSurrogate(codeUnit) && isHighSurrogate(input.charCodeAt(from - 1))) {
      from += 1;
    }
  }

  if (to > 0 && to < len) {
    const codeUnit = input.charCodeAt(to - 1);
    if (isHighSurrogate(codeUnit) && isLowSurrogate(input.charCodeAt(to))) {
      to -= 1;
    }
  }

  return input.slice(from, to);
}

/**
 * Truncates a string to the given UTF-16 length without splitting surrogate pairs.
 * @param {string} input
 * @param {number} maxLen
 * @returns {string}
 */
export function truncateUtf16Safe(input, maxLen) {
  const limit = Math.max(0, Math.floor(maxLen));
  if (input.length <= limit) {
    return input;
  }
  return sliceUtf16Safe(input, 0, limit);
}

/**
 * Resolves a user-provided path, expanding ~ to the home directory.
 * @param {string} input
 * @returns {string}
 */
export function resolveUserPath(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith('~')) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
}

/**
 * Resolves the OpenClaw configuration directory.
 * @param {object} [env] - Environment variables (defaults to process.env).
 * @param {() => string} [homedir] - Home directory resolver.
 * @returns {string}
 */
export function resolveConfigDir(env = process.env, homedir = os.homedir) {
  const override = env.OPENCLAW_STATE_DIR?.trim() || env.CLAWDBOT_STATE_DIR?.trim();
  if (override) {
    return resolveUserPath(override);
  }
  const newDir = path.join(homedir(), '.openclaw');
  try {
    const hasNew = fs.existsSync(newDir);
    if (hasNew) {
      return newDir;
    }
  } catch {
    // best-effort
  }
  return newDir;
}

/**
 * Resolves the user's home directory from env or os.homedir().
 * @returns {string | undefined}
 */
export function resolveHomeDir() {
  const envHome = process.env.HOME?.trim();
  if (envHome) {
    return envHome;
  }
  const envProfile = process.env.USERPROFILE?.trim();
  if (envProfile) {
    return envProfile;
  }
  try {
    const home = os.homedir();
    return home?.trim() ? home : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Shortens a path by replacing the home directory with ~.
 * @param {string} input
 * @returns {string}
 */
export function shortenHomePath(input) {
  if (!input) {
    return input;
  }
  const home = resolveHomeDir();
  if (!home) {
    return input;
  }
  if (input === home) {
    return '~';
  }
  if (input.startsWith(`${home}/`)) {
    return `~${input.slice(home.length)}`;
  }
  return input;
}

/**
 * Replaces all occurrences of the home directory path with ~ in a string.
 * @param {string} input
 * @returns {string}
 */
export function shortenHomeInString(input) {
  if (!input) {
    return input;
  }
  const home = resolveHomeDir();
  if (!home) {
    return input;
  }
  return input.split(home).join('~');
}

/**
 * Shortens a file path for display (alias for shortenHomePath).
 * @param {string} input
 * @returns {string}
 */
export function displayPath(input) {
  return shortenHomePath(input);
}

/**
 * Shortens home directory occurrences in a display string.
 * @param {string} input
 * @returns {string}
 */
export function displayString(input) {
  return shortenHomeInString(input);
}

/**
 * Formats a clickable terminal hyperlink using OSC 8 escape sequences.
 * @param {string} label
 * @param {string} url
 * @param {object} [opts]
 * @param {string} [opts.fallback]
 * @param {boolean} [opts.force]
 * @returns {string}
 */
export function formatTerminalLink(label, url, opts) {
  const esc = '\u001b';
  const safeLabel = label.replaceAll(esc, '');
  const safeUrl = url.replaceAll(esc, '');
  const allow =
    opts?.force === true ? true : opts?.force === false ? false : Boolean(process.stdout.isTTY);
  if (!allow) {
    return opts?.fallback ?? `${safeLabel} (${safeUrl})`;
  }
  return `\u001b]8;;${safeUrl}\u0007${safeLabel}\u001b]8;;\u0007`;
}

// Configuration root; can be overridden via OPENCLAW_STATE_DIR.
export const CONFIG_DIR = resolveConfigDir();
