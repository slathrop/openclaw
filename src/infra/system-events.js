/**
 * Lightweight in-memory queue for session-scoped system events.
 *
 * Provides an ephemeral event queue that prefixes human-readable system
 * events to the next prompt. Events are session-scoped, require an
 * explicit key, and are not persisted.
 */

/**
 * @typedef {object} SystemEvent
 * @property {string} text
 * @property {number} ts
 */

const MAX_EVENTS = 20;

/**
 * @typedef {object} SessionQueue
 * @property {SystemEvent[]} queue
 * @property {string | null} lastText
 * @property {string | null} lastContextKey
 */

/** @type {Map<string, SessionQueue>} */
const queues = new Map();

/**
 * @param {string | null} [key]
 * @returns {string}
 */
function requireSessionKey(key) {
  const trimmed = typeof key === 'string' ? key.trim() : '';
  if (!trimmed) {
    throw new Error('system events require a sessionKey');
  }
  return trimmed;
}

/**
 * @param {string | null} [key]
 * @returns {string | null}
 */
function normalizeContextKey(key) {
  if (!key) {
    return null;
  }
  const trimmed = key.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.toLowerCase();
}

/**
 * Checks if the context key has changed for a session.
 * @param {string} sessionKey
 * @param {string | null} [contextKey]
 * @returns {boolean}
 */
export function isSystemEventContextChanged(sessionKey, contextKey) {
  const key = requireSessionKey(sessionKey);
  const existing = queues.get(key);
  const normalized = normalizeContextKey(contextKey);
  return normalized !== (existing?.lastContextKey ?? null);
}

/**
 * Enqueues a system event for a session.
 * @param {string} text
 * @param {object} options
 * @param {string} options.sessionKey
 * @param {string | null} [options.contextKey]
 */
export function enqueueSystemEvent(text, options) {
  const key = requireSessionKey(options?.sessionKey);
  const entry =
    queues.get(key) ??
    (() => {
      /** @type {SessionQueue} */
      const created = {
        queue: [],
        lastText: null,
        lastContextKey: null
      };
      queues.set(key, created);
      return created;
    })();
  const cleaned = text.trim();
  if (!cleaned) {
    return;
  }
  entry.lastContextKey = normalizeContextKey(options?.contextKey);
  if (entry.lastText === cleaned) {
    return;
  } // skip consecutive duplicates
  entry.lastText = cleaned;
  entry.queue.push({text: cleaned, ts: Date.now()});
  if (entry.queue.length > MAX_EVENTS) {
    entry.queue.shift();
  }
}

/**
 * Drains all system event entries for a session.
 * @param {string} sessionKey
 * @returns {SystemEvent[]}
 */
export function drainSystemEventEntries(sessionKey) {
  const key = requireSessionKey(sessionKey);
  const entry = queues.get(key);
  if (!entry || entry.queue.length === 0) {
    return [];
  }
  const out = entry.queue.slice();
  entry.queue.length = 0;
  entry.lastText = null;
  entry.lastContextKey = null;
  queues.delete(key);
  return out;
}

/**
 * Drains system event texts for a session.
 * @param {string} sessionKey
 * @returns {string[]}
 */
export function drainSystemEvents(sessionKey) {
  return drainSystemEventEntries(sessionKey).map((event) => event.text);
}

/**
 * Peeks at system event texts without draining.
 * @param {string} sessionKey
 * @returns {string[]}
 */
export function peekSystemEvents(sessionKey) {
  const key = requireSessionKey(sessionKey);
  return queues.get(key)?.queue.map((e) => e.text) ?? [];
}

/**
 * Returns whether there are pending system events for a session.
 * @param {string} sessionKey
 * @returns {boolean}
 */
export function hasSystemEvents(sessionKey) {
  const key = requireSessionKey(sessionKey);
  return (queues.get(key)?.queue.length ?? 0) > 0;
}

/**
 * Clears all system event queues (for testing).
 */
export function resetSystemEventsForTest() {
  queues.clear();
}
