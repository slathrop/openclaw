/**
 * Skill frontmatter parsing and metadata extraction.
 * @module agents/skills/frontmatter
 */
import JSON5 from 'json5';
import { LEGACY_MANIFEST_KEYS, MANIFEST_KEY } from '../../compat/legacy-names.js';
import { parseFrontmatterBlock } from '../../markdown/frontmatter.js';
import { parseBooleanValue } from '../../utils/boolean.js';
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
  if (kind !== 'brew' && kind !== 'node' && kind !== 'go' && kind !== 'uv' && kind !== 'download') {
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
  const osList = normalizeStringList(raw.os);
  if (osList.length > 0) {
    spec.os = osList;
  }
  if (typeof raw.formula === 'string') {
    spec.formula = raw.formula;
  }
  if (typeof raw.package === 'string') {
    spec.package = raw.package;
  }
  if (typeof raw.module === 'string') {
    spec.module = raw.module;
  }
  if (typeof raw.url === 'string') {
    spec.url = raw.url;
  }
  if (typeof raw.archive === 'string') {
    spec.archive = raw.archive;
  }
  if (typeof raw.extract === 'boolean') {
    spec.extract = raw.extract;
  }
  if (typeof raw.stripComponents === 'number') {
    spec.stripComponents = raw.stripComponents;
  }
  if (typeof raw.targetDir === 'string') {
    spec.targetDir = raw.targetDir;
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
    return {
      always: typeof metadataObj.always === 'boolean' ? metadataObj.always : void 0,
      emoji: typeof metadataObj.emoji === 'string' ? metadataObj.emoji : void 0,
      homepage: typeof metadataObj.homepage === 'string' ? metadataObj.homepage : void 0,
      skillKey: typeof metadataObj.skillKey === 'string' ? metadataObj.skillKey : void 0,
      primaryEnv: typeof metadataObj.primaryEnv === 'string' ? metadataObj.primaryEnv : void 0,
      os: osRaw.length > 0 ? osRaw : void 0,
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
function resolveSkillInvocationPolicy(frontmatter) {
  return {
    userInvocable: parseFrontmatterBool(getFrontmatterValue(frontmatter, 'user-invocable'), true),
    disableModelInvocation: parseFrontmatterBool(
      getFrontmatterValue(frontmatter, 'disable-model-invocation'),
      false
    )
  };
}
function resolveSkillKey(skill, entry) {
  return entry?.metadata?.skillKey ?? skill.name;
}
export {
  parseFrontmatter,
  resolveOpenClawMetadata,
  resolveSkillInvocationPolicy,
  resolveSkillKey
};
