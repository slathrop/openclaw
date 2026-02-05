/**
 * Log line parser for structured JSON log output.
 *
 * Parses JSON-formatted log lines produced by the file logger,
 * extracting timestamp, level, subsystem, module, and message fields.
 */

/**
 * @typedef {object} ParsedLogLine
 * @property {string} [time]
 * @property {string} [level]
 * @property {string} [subsystem]
 * @property {string} [module]
 * @property {string} message
 * @property {string} raw
 */

const extractMessage = (value) => {
  const parts = [];
  for (const key of Object.keys(value)) {
    if (!/^\d+$/.test(key)) {
      continue;
    }
    const item = value[key];
    if (typeof item === 'string') {
      parts.push(item);
    } else if (item !== null && item !== undefined) {
      parts.push(JSON.stringify(item));
    }
  }
  return parts.join(' ');
};

const parseMetaName = (raw) => {
  if (typeof raw !== 'string') {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      subsystem: typeof parsed.subsystem === 'string' ? parsed.subsystem : undefined,
      module: typeof parsed.module === 'string' ? parsed.module : undefined
    };
  } catch {
    return {};
  }
};

/**
 * @param {string} raw
 * @returns {ParsedLogLine | null}
 */
export const parseLogLine = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    const meta = parsed._meta;
    const nameMeta = parseMetaName(meta?.name);
    const levelRaw = typeof meta?.logLevelName === 'string' ? meta.logLevelName : undefined;
    return {
      time:
        typeof parsed.time === 'string'
          ? parsed.time
          : typeof meta?.date === 'string'
            ? meta.date
            : undefined,
      level: levelRaw ? levelRaw.toLowerCase() : undefined,
      subsystem: nameMeta.subsystem,
      module: nameMeta.module,
      message: extractMessage(parsed),
      raw
    };
  } catch {
    return null;
  }
};
