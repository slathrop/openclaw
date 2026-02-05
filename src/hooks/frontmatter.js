import JSON5 from 'json5';
import { LEGACY_MANIFEST_KEYS, MANIFEST_KEY } from '../compat/legacy-names.js';
import { parseFrontmatterBlock } from '../markdown/frontmatter.js';
import { parseBooleanValue } from '../utils/boolean.js';
function parseFrontmatter(content) {
  return parseFrontmatterBlock(content);
}
function normalizeStringList(input) {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input.map((value) => String(value).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input.split(',').map((value) => value.trim()).filter(Boolean);
  }
  return [];
}
function parseInstallSpec(input) {
  if (!input || typeof input !== 'object') {
    return void 0;
  }
  const raw = input;
  const kindRaw = typeof raw.kind === 'string' ? raw.kind : typeof raw.type === 'string' ? raw.type : '';
  const kind = kindRaw.trim().toLowerCase();
  if (kind !== 'bundled' && kind !== 'npm' && kind !== 'git') {
    return void 0;
  }
  const spec = {
    kind
  };
  if (typeof raw.id === 'string') {
    spec.id = raw.id;
  }
  if (typeof raw.label === 'string') {
    spec.label = raw.label;
  }
  const bins = normalizeStringList(raw.bins);
  if (bins.length > 0) {
    spec.bins = bins;
  }
  if (typeof raw.package === 'string') {
    spec.package = raw.package;
  }
  if (typeof raw.repository === 'string') {
    spec.repository = raw.repository;
  }
  return spec;
}
function getFrontmatterValue(frontmatter, key) {
  const raw = frontmatter[key];
  return typeof raw === 'string' ? raw : void 0;
}
function parseFrontmatterBool(value, fallback) {
  const parsed = parseBooleanValue(value);
  return parsed === void 0 ? fallback : parsed;
}
function resolveOpenClawMetadata(frontmatter) {
  const raw = getFrontmatterValue(frontmatter, 'metadata');
  if (!raw) {
    return void 0;
  }
  try {
    const parsed = JSON5.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return void 0;
    }
    const metadataRawCandidates = [MANIFEST_KEY, ...LEGACY_MANIFEST_KEYS];
    let metadataRaw;
    for (const key of metadataRawCandidates) {
      const candidate = parsed[key];
      if (candidate && typeof candidate === 'object') {
        metadataRaw = candidate;
        break;
      }
    }
    if (!metadataRaw || typeof metadataRaw !== 'object') {
      return void 0;
    }
    const metadataObj = metadataRaw;
    const requiresRaw = typeof metadataObj.requires === 'object' && metadataObj.requires !== null ? metadataObj.requires : void 0;
    const installRaw = Array.isArray(metadataObj.install) ? metadataObj.install : [];
    const install = installRaw.map((entry) => parseInstallSpec(entry)).filter((entry) => Boolean(entry));
    const osRaw = normalizeStringList(metadataObj.os);
    const eventsRaw = normalizeStringList(metadataObj.events);
    return {
      always: typeof metadataObj.always === 'boolean' ? metadataObj.always : void 0,
      emoji: typeof metadataObj.emoji === 'string' ? metadataObj.emoji : void 0,
      homepage: typeof metadataObj.homepage === 'string' ? metadataObj.homepage : void 0,
      hookKey: typeof metadataObj.hookKey === 'string' ? metadataObj.hookKey : void 0,
      export: typeof metadataObj.export === 'string' ? metadataObj.export : void 0,
      os: osRaw.length > 0 ? osRaw : void 0,
      events: eventsRaw.length > 0 ? eventsRaw : [],
      requires: requiresRaw ? {
        bins: normalizeStringList(requiresRaw.bins),
        anyBins: normalizeStringList(requiresRaw.anyBins),
        env: normalizeStringList(requiresRaw.env),
        config: normalizeStringList(requiresRaw.config)
      } : void 0,
      install: install.length > 0 ? install : void 0
    };
  } catch {
    return void 0;
  }
}
function resolveHookInvocationPolicy(frontmatter) {
  return {
    enabled: parseFrontmatterBool(getFrontmatterValue(frontmatter, 'enabled'), true)
  };
}
function resolveHookKey(hookName, entry) {
  return entry?.metadata?.hookKey ?? hookName;
}
export {
  parseFrontmatter,
  resolveHookInvocationPolicy,
  resolveHookKey,
  resolveOpenClawMetadata
};
