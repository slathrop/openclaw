/**
 * @module tool-display
 * Tool display metadata (emoji, label) resolution from config.
 */
import { redactToolDetail } from '../logging/redact.js';
import { shortenHomeInString } from '../utils.js';
import TOOL_DISPLAY_JSON from './tool-display.json' with { type: 'json' };
const TOOL_DISPLAY_CONFIG = TOOL_DISPLAY_JSON;
const FALLBACK = TOOL_DISPLAY_CONFIG.fallback ?? { emoji: '\u{1F9E9}' };
const TOOL_MAP = TOOL_DISPLAY_CONFIG.tools ?? {};
const DETAIL_LABEL_OVERRIDES = {
  agentId: 'agent',
  sessionKey: 'session',
  targetId: 'target',
  targetUrl: 'url',
  nodeId: 'node',
  requestId: 'request',
  messageId: 'message',
  threadId: 'thread',
  channelId: 'channel',
  guildId: 'guild',
  userId: 'user',
  runTimeoutSeconds: 'timeout',
  timeoutSeconds: 'timeout',
  includeTools: 'tools',
  pollQuestion: 'poll',
  maxChars: 'max chars'
};
const MAX_DETAIL_ENTRIES = 8;
function normalizeToolName(name) {
  return (name ?? 'tool').trim();
}
function defaultTitle(name) {
  const cleaned = name.replace(/_/g, ' ').trim();
  if (!cleaned) {
    return 'Tool';
  }
  return cleaned.split(/\s+/).map(
    (part) => part.length <= 2 && part.toUpperCase() === part ? part : `${part.at(0)?.toUpperCase() ?? ''}${part.slice(1)}`
  ).join(' ');
}
function normalizeVerb(value) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return void 0;
  }
  return trimmed.replace(/_/g, ' ');
}
function coerceDisplayValue(value) {
  if (value === null || value === void 0) {
    return void 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return void 0;
    }
    const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? '';
    if (!firstLine) {
      return void 0;
    }
    return firstLine.length > 160 ? `${firstLine.slice(0, 157)}\u2026` : firstLine;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : void 0;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value === 0) {
      return void 0;
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    const values = value.map((item) => coerceDisplayValue(item)).filter((item) => Boolean(item));
    if (values.length === 0) {
      return void 0;
    }
    const preview = values.slice(0, 3).join(', ');
    return values.length > 3 ? `${preview}\u2026` : preview;
  }
  return void 0;
}
function lookupValueByPath(args, path) {
  if (!args || typeof args !== 'object') {
    return void 0;
  }
  let current = args;
  for (const segment of path.split('.')) {
    if (!segment) {
      return void 0;
    }
    if (!current || typeof current !== 'object') {
      return void 0;
    }
    const record = current;
    current = record[segment];
  }
  return current;
}
function formatDetailKey(raw) {
  const segments = raw.split('.').filter(Boolean);
  const last = segments.at(-1) ?? raw;
  const override = DETAIL_LABEL_OVERRIDES[last];
  if (override) {
    return override;
  }
  const cleaned = last.replace(/_/g, ' ').replace(/-/g, ' ');
  const spaced = cleaned.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.trim().toLowerCase() || last.toLowerCase();
}
function resolveDetailFromKeys(args, keys) {
  const entries = [];
  for (const key of keys) {
    const value = lookupValueByPath(args, key);
    const display = coerceDisplayValue(value);
    if (!display) {
      continue;
    }
    entries.push({ label: formatDetailKey(key), value: display });
  }
  if (entries.length === 0) {
    return void 0;
  }
  if (entries.length === 1) {
    return entries[0].value;
  }
  const seen = /* @__PURE__ */ new Set();
  const unique = [];
  for (const entry of entries) {
    const token = `${entry.label}:${entry.value}`;
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    unique.push(entry);
  }
  if (unique.length === 0) {
    return void 0;
  }
  return unique.slice(0, MAX_DETAIL_ENTRIES).map((entry) => `${entry.label} ${entry.value}`).join(' \xB7 ');
}
function resolveReadDetail(args) {
  if (!args || typeof args !== 'object') {
    return void 0;
  }
  const record = args;
  const path = typeof record.path === 'string' ? record.path : void 0;
  if (!path) {
    return void 0;
  }
  const offset = typeof record.offset === 'number' ? record.offset : void 0;
  const limit = typeof record.limit === 'number' ? record.limit : void 0;
  if (offset !== void 0 && limit !== void 0) {
    return `${path}:${offset}-${offset + limit}`;
  }
  return path;
}
function resolveWriteDetail(args) {
  if (!args || typeof args !== 'object') {
    return void 0;
  }
  const record = args;
  const path = typeof record.path === 'string' ? record.path : void 0;
  return path;
}
function resolveActionSpec(spec, action) {
  if (!spec || !action) {
    return void 0;
  }
  return spec.actions?.[action] ?? void 0;
}
function resolveToolDisplay(params) {
  const name = normalizeToolName(params.name);
  const key = name.toLowerCase();
  const spec = TOOL_MAP[key];
  const emoji = spec?.emoji ?? FALLBACK.emoji ?? '\u{1F9E9}';
  const title = spec?.title ?? defaultTitle(name);
  const label = spec?.label ?? title;
  const actionRaw = params.args && typeof params.args === 'object' ? params.args.action : void 0;
  const action = typeof actionRaw === 'string' ? actionRaw.trim() : void 0;
  const actionSpec = resolveActionSpec(spec, action);
  const verb = normalizeVerb(actionSpec?.label ?? action);
  let detail;
  if (key === 'read') {
    detail = resolveReadDetail(params.args);
  }
  if (!detail && (key === 'write' || key === 'edit' || key === 'attach')) {
    detail = resolveWriteDetail(params.args);
  }
  const detailKeys = actionSpec?.detailKeys ?? spec?.detailKeys ?? FALLBACK.detailKeys ?? [];
  if (!detail && detailKeys.length > 0) {
    detail = resolveDetailFromKeys(params.args, detailKeys);
  }
  if (!detail && params.meta) {
    detail = params.meta;
  }
  if (detail) {
    detail = shortenHomeInString(detail);
  }
  return {
    name,
    emoji,
    title,
    label,
    verb,
    detail
  };
}
function formatToolDetail(display) {
  const parts = [];
  if (display.verb) {
    parts.push(display.verb);
  }
  if (display.detail) {
    parts.push(redactToolDetail(display.detail));
  }
  if (parts.length === 0) {
    return void 0;
  }
  return parts.join(' \xB7 ');
}
function formatToolSummary(display) {
  const detail = formatToolDetail(display);
  return detail ? `${display.emoji} ${display.label}: ${detail}` : `${display.emoji} ${display.label}`;
}
export {
  formatToolDetail,
  formatToolSummary,
  resolveToolDisplay
};
