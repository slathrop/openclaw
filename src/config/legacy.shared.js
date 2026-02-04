/**
 * Legacy config migration shared helpers.
 *
 * Provides common utilities used across all migration parts:
 * record type checking, nested record creation, missing-key merging,
 * audio transcription mapping, agent list resolution, and agent entry creation.
 * These helpers enable the ordered, rule-based migration pipeline in
 * legacy.migrations.part-1 through part-3.
 */

/**
 * @typedef {{ path: string[], message: string, match?: (value: unknown, root: Record<string, unknown>) => boolean }} LegacyConfigRule
 */

/**
 * @typedef {{ id: string, describe: string, apply: (raw: Record<string, unknown>, changes: string[]) => void }} LegacyConfigMigration
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export const isRecord = (value) =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
export const getRecord = (value) =>
  isRecord(value) ? value : null;

/**
 * Ensures a record exists at root[key], creating one if necessary.
 * @param {Record<string, unknown>} root
 * @param {string} key
 * @returns {Record<string, unknown>}
 */
export const ensureRecord = (root, key) => {
  const existing = root[key];
  if (isRecord(existing)) {
    return existing;
  }
  const next = {};
  root[key] = next;
  return next;
};

/**
 * Recursively merges source into target, only filling in missing keys.
 * @param {Record<string, unknown>} target
 * @param {Record<string, unknown>} source
 */
export const mergeMissing = (target, source) => {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }
    const existing = target[key];
    if (existing === undefined) {
      target[key] = value;
      continue;
    }
    if (isRecord(existing) && isRecord(value)) {
      mergeMissing(existing, value);
    }
  }
};

const AUDIO_TRANSCRIPTION_CLI_ALLOWLIST = new Set(['whisper']);

/**
 * Maps legacy audio transcription config to the new CLI model format.
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
export const mapLegacyAudioTranscription = (value) => {
  const transcriber = getRecord(value);
  const command = Array.isArray(transcriber?.command) ? transcriber?.command : null;
  if (!command || command.length === 0) {
    return null;
  }
  const rawExecutable = String(command[0] ?? '').trim();
  if (!rawExecutable) {
    return null;
  }
  const executableName = rawExecutable.split(/[\\/]/).pop() ?? rawExecutable;
  if (!AUDIO_TRANSCRIPTION_CLI_ALLOWLIST.has(executableName)) {
    return null;
  }

  const args = command.slice(1).map((part) => String(part));
  const timeoutSeconds =
    typeof transcriber?.timeoutSeconds === 'number' ? transcriber?.timeoutSeconds : undefined;

  const result = { command: rawExecutable, type: 'cli' };
  if (args.length > 0) {
    result.args = args;
  }
  if (timeoutSeconds !== undefined) {
    result.timeoutSeconds = timeoutSeconds;
  }
  return result;
};

/**
 * @param {Record<string, unknown> | null} agents
 * @returns {unknown[]}
 */
export const getAgentsList = (agents) => {
  const list = agents?.list;
  return Array.isArray(list) ? list : [];
};

/**
 * Resolves the default agent ID from a raw config object.
 * @param {Record<string, unknown>} raw
 * @returns {string}
 */
export const resolveDefaultAgentIdFromRaw = (raw) => {
  const agents = getRecord(raw.agents);
  const list = getAgentsList(agents);
  const defaultEntry = list.find(
    (entry) =>
      isRecord(entry) &&
      entry.default === true &&
      typeof entry.id === 'string' &&
      entry.id.trim() !== ''
  );
  if (defaultEntry) {
    return defaultEntry.id.trim();
  }
  const routing = getRecord(raw.routing);
  const routingDefault =
    typeof routing?.defaultAgentId === 'string' ? routing.defaultAgentId.trim() : '';
  if (routingDefault) {
    return routingDefault;
  }
  const firstEntry = list.find(
    (entry) =>
      isRecord(entry) && typeof entry.id === 'string' && entry.id.trim() !== ''
  );
  if (firstEntry) {
    return firstEntry.id.trim();
  }
  return 'main';
};

/**
 * Ensures an agent entry with the given ID exists in the list.
 * @param {unknown[]} list
 * @param {string} id
 * @returns {Record<string, unknown>}
 */
export const ensureAgentEntry = (list, id) => {
  const normalized = id.trim();
  const existing = list.find(
    (entry) =>
      isRecord(entry) && typeof entry.id === 'string' && entry.id.trim() === normalized
  );
  if (existing) {
    return existing;
  }
  const created = { id: normalized };
  list.push(created);
  return created;
};
