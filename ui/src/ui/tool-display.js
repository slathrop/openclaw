import rawConfig from './tool-display.json' with { type: 'json' };
const TOOL_DISPLAY_CONFIG = rawConfig;
const FALLBACK = TOOL_DISPLAY_CONFIG.fallback ?? { icon: 'puzzle' };
const TOOL_MAP = TOOL_DISPLAY_CONFIG.tools ?? {};
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
  if (typeof value === 'number' || typeof value === 'boolean') {
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
function resolveDetailFromKeys(args, keys) {
  for (const key of keys) {
    const value = lookupValueByPath(args, key);
    const display = coerceDisplayValue(value);
    if (display) {
      return display;
    }
  }
  return void 0;
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
  const icon = spec?.icon ?? FALLBACK.icon ?? 'puzzle';
  const title = spec?.title ?? defaultTitle(name);
  const label = spec?.label ?? name;
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
    icon,
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
    parts.push(display.detail);
  }
  if (parts.length === 0) {
    return void 0;
  }
  return parts.join(' \xB7 ');
}
function formatToolSummary(display) {
  const detail = formatToolDetail(display);
  return detail ? `${display.label}: ${detail}` : display.label;
}
function shortenHomeInString(input) {
  if (!input) {
    return input;
  }
  return input.replace(/\/Users\/[^/]+/g, '~').replace(/\/home\/[^/]+/g, '~');
}
export {
  formatToolDetail,
  formatToolSummary,
  resolveToolDisplay
};
