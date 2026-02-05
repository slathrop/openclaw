import { parseDurationMs } from '../../../cli/parse-duration.js';
import { normalizeQueueDropPolicy, normalizeQueueMode } from './normalize.js';
function parseQueueDebounce(raw) {
  if (!raw) {
    return void 0;
  }
  try {
    const parsed = parseDurationMs(raw.trim(), { defaultUnit: 'ms' });
    if (!parsed || parsed < 0) {
      return void 0;
    }
    return Math.round(parsed);
  } catch {
    return void 0;
  }
}
function parseQueueCap(raw) {
  if (!raw) {
    return void 0;
  }
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return void 0;
  }
  const cap = Math.floor(num);
  if (cap < 1) {
    return void 0;
  }
  return cap;
}
function parseQueueDirectiveArgs(raw) {
  let i = 0;
  const len = raw.length;
  while (i < len && /\s/.test(raw[i])) {
    i += 1;
  }
  if (raw[i] === ':') {
    i += 1;
    while (i < len && /\s/.test(raw[i])) {
      i += 1;
    }
  }
  let consumed = i;
  let queueMode;
  let queueReset = false;
  let rawMode;
  let debounceMs;
  let cap;
  let dropPolicy;
  let rawDebounce;
  let rawCap;
  let rawDrop;
  let hasOptions = false;
  const takeToken = () => {
    if (i >= len) {
      return null;
    }
    const start = i;
    while (i < len && !/\s/.test(raw[i])) {
      i += 1;
    }
    if (start === i) {
      return null;
    }
    const token = raw.slice(start, i);
    while (i < len && /\s/.test(raw[i])) {
      i += 1;
    }
    return token;
  };
  while (i < len) {
    const token = takeToken();
    if (!token) {
      break;
    }
    const lowered = token.trim().toLowerCase();
    if (lowered === 'default' || lowered === 'reset' || lowered === 'clear') {
      queueReset = true;
      consumed = i;
      break;
    }
    if (lowered.startsWith('debounce:') || lowered.startsWith('debounce=')) {
      rawDebounce = token.split(/[:=]/)[1] ?? '';
      debounceMs = parseQueueDebounce(rawDebounce);
      hasOptions = true;
      consumed = i;
      continue;
    }
    if (lowered.startsWith('cap:') || lowered.startsWith('cap=')) {
      rawCap = token.split(/[:=]/)[1] ?? '';
      cap = parseQueueCap(rawCap);
      hasOptions = true;
      consumed = i;
      continue;
    }
    if (lowered.startsWith('drop:') || lowered.startsWith('drop=')) {
      rawDrop = token.split(/[:=]/)[1] ?? '';
      dropPolicy = normalizeQueueDropPolicy(rawDrop);
      hasOptions = true;
      consumed = i;
      continue;
    }
    const mode = normalizeQueueMode(token);
    if (mode) {
      queueMode = mode;
      rawMode = token;
      consumed = i;
      continue;
    }
    break;
  }
  return {
    consumed,
    queueMode,
    queueReset,
    rawMode,
    debounceMs,
    cap,
    dropPolicy,
    rawDebounce,
    rawCap,
    rawDrop,
    hasOptions
  };
}
function extractQueueDirective(body) {
  if (!body) {
    return {
      cleaned: '',
      hasDirective: false,
      queueReset: false,
      hasOptions: false
    };
  }
  const re = /(?:^|\s)\/queue(?=$|\s|:)/i;
  const match = re.exec(body);
  if (!match) {
    return {
      cleaned: body.trim(),
      hasDirective: false,
      queueReset: false,
      hasOptions: false
    };
  }
  const start = match.index + match[0].indexOf('/queue');
  const argsStart = start + '/queue'.length;
  const args = body.slice(argsStart);
  const parsed = parseQueueDirectiveArgs(args);
  const cleanedRaw = `${body.slice(0, start)} ${body.slice(argsStart + parsed.consumed)}`;
  const cleaned = cleanedRaw.replace(/\s+/g, ' ').trim();
  return {
    cleaned,
    queueMode: parsed.queueMode,
    queueReset: parsed.queueReset,
    rawMode: parsed.rawMode,
    debounceMs: parsed.debounceMs,
    cap: parsed.cap,
    dropPolicy: parsed.dropPolicy,
    rawDebounce: parsed.rawDebounce,
    rawCap: parsed.rawCap,
    rawDrop: parsed.rawDrop,
    hasDirective: true,
    hasOptions: parsed.hasOptions
  };
}
export {
  extractQueueDirective
};
