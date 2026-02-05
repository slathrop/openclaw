const LOG_BUFFER_LIMIT = 2e3;
const LEVELS = /* @__PURE__ */ new Set(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
function parseMaybeJsonString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function normalizeLevel(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const lowered = value.toLowerCase();
  return LEVELS.has(lowered) ? lowered : null;
}
function parseLogLine(line) {
  if (!line.trim()) {
    return { raw: line, message: line };
  }
  try {
    const obj = JSON.parse(line);
    const meta = obj && typeof obj._meta === 'object' && obj._meta !== null ? obj._meta : null;
    const time = typeof obj.time === 'string' ? obj.time : typeof meta?.date === 'string' ? meta?.date : null;
    const level = normalizeLevel(meta?.logLevelName ?? meta?.level);
    const contextCandidate = typeof obj['0'] === 'string' ? obj['0'] : typeof meta?.name === 'string' ? meta?.name : null;
    const contextObj = parseMaybeJsonString(contextCandidate);
    let subsystem = null;
    if (contextObj) {
      if (typeof contextObj.subsystem === 'string') {
        subsystem = contextObj.subsystem;
      } else if (typeof contextObj.module === 'string') {
        subsystem = contextObj.module;
      }
    }
    if (!subsystem && contextCandidate && contextCandidate.length < 120) {
      subsystem = contextCandidate;
    }
    let message = null;
    if (typeof obj['1'] === 'string') {
      message = obj['1'];
    } else if (!contextObj && typeof obj['0'] === 'string') {
      message = obj['0'];
    } else if (typeof obj.message === 'string') {
      message = obj.message;
    }
    return {
      raw: line,
      time,
      level,
      subsystem,
      message: message ?? line,
      meta: meta ?? void 0
    };
  } catch {
    return { raw: line, message: line };
  }
}
async function loadLogs(state, opts) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.logsLoading && !opts?.quiet) {
    return;
  }
  if (!opts?.quiet) {
    state.logsLoading = true;
  }
  state.logsError = null;
  try {
    const res = await state.client.request('logs.tail', {
      cursor: opts?.reset ? void 0 : state.logsCursor ?? void 0,
      limit: state.logsLimit,
      maxBytes: state.logsMaxBytes
    });
    const payload = res;
    const lines = Array.isArray(payload.lines) ? payload.lines.filter((line) => typeof line === 'string') : [];
    const entries = lines.map(parseLogLine);
    const shouldReset = Boolean(opts?.reset || payload.reset || state.logsCursor === null || state.logsCursor === undefined);
    state.logsEntries = shouldReset ? entries : [...state.logsEntries, ...entries].slice(-LOG_BUFFER_LIMIT);
    if (typeof payload.cursor === 'number') {
      state.logsCursor = payload.cursor;
    }
    if (typeof payload.file === 'string') {
      state.logsFile = payload.file;
    }
    state.logsTruncated = Boolean(payload.truncated);
    state.logsLastFetchAt = Date.now();
  } catch (err) {
    state.logsError = String(err);
  } finally {
    if (!opts?.quiet) {
      state.logsLoading = false;
    }
  }
}
export {
  loadLogs,
  parseLogLine
};
