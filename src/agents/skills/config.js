/**
 * Skill configuration loading and deep-get utilities.
 * @module agents/skills/config
 */
import fs from 'node:fs';
import path from 'node:path';
import { resolveSkillKey } from './frontmatter.js';
const DEFAULT_CONFIG_VALUES = {
  'browser.enabled': true,
  'browser.evaluateEnabled': true
};
function isTruthy(value) {
  if (value === void 0 || value === null) {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return true;
}
function resolveConfigPath(config, pathStr) {
  const parts = pathStr.split('.').filter(Boolean);
  let current = config;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return void 0;
    }
    current = current[part];
  }
  return current;
}
function isConfigPathTruthy(config, pathStr) {
  const value = resolveConfigPath(config, pathStr);
  if (value === void 0 && pathStr in DEFAULT_CONFIG_VALUES) {
    return DEFAULT_CONFIG_VALUES[pathStr];
  }
  return isTruthy(value);
}
function resolveSkillConfig(config, skillKey) {
  const skills = config?.skills?.entries;
  if (!skills || typeof skills !== 'object') {
    return void 0;
  }
  const entry = skills[skillKey];
  if (!entry || typeof entry !== 'object') {
    return void 0;
  }
  return entry;
}
function resolveRuntimePlatform() {
  return process.platform;
}
function normalizeAllowlist(input) {
  if (!input) {
    return void 0;
  }
  if (!Array.isArray(input)) {
    return void 0;
  }
  const normalized = input.map((entry) => String(entry).trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : void 0;
}
const BUNDLED_SOURCES = /* @__PURE__ */ new Set(['openclaw-bundled']);
function isBundledSkill(entry) {
  return BUNDLED_SOURCES.has(entry.skill.source);
}
function resolveBundledAllowlist(config) {
  return normalizeAllowlist(config?.skills?.allowBundled);
}
function isBundledSkillAllowed(entry, allowlist) {
  if (!allowlist || allowlist.length === 0) {
    return true;
  }
  if (!isBundledSkill(entry)) {
    return true;
  }
  const key = resolveSkillKey(entry.skill, entry);
  return allowlist.includes(key) || allowlist.includes(entry.skill.name);
}
function hasBinary(bin) {
  const pathEnv = process.env.PATH ?? '';
  const parts = pathEnv.split(path.delimiter).filter(Boolean);
  for (const part of parts) {
    const candidate = path.join(part, bin);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      // intentionally ignored
    }
  }
  return false;
}
function shouldIncludeSkill(params) {
  const { entry, config, eligibility } = params;
  const skillKey = resolveSkillKey(entry.skill, entry);
  const skillConfig = resolveSkillConfig(config, skillKey);
  const allowBundled = normalizeAllowlist(config?.skills?.allowBundled);
  const osList = entry.metadata?.os ?? [];
  const remotePlatforms = eligibility?.remote?.platforms ?? [];
  if (skillConfig?.enabled === false) {
    return false;
  }
  if (!isBundledSkillAllowed(entry, allowBundled)) {
    return false;
  }
  if (osList.length > 0 && !osList.includes(resolveRuntimePlatform()) && !remotePlatforms.some((platform) => osList.includes(platform))) {
    return false;
  }
  if (entry.metadata?.always === true) {
    return true;
  }
  const requiredBins = entry.metadata?.requires?.bins ?? [];
  if (requiredBins.length > 0) {
    for (const bin of requiredBins) {
      if (hasBinary(bin)) {
        continue;
      }
      if (eligibility?.remote?.hasBin?.(bin)) {
        continue;
      }
      return false;
    }
  }
  const requiredAnyBins = entry.metadata?.requires?.anyBins ?? [];
  if (requiredAnyBins.length > 0) {
    const anyFound = requiredAnyBins.some((bin) => hasBinary(bin)) || eligibility?.remote?.hasAnyBin?.(requiredAnyBins);
    if (!anyFound) {
      return false;
    }
  }
  const requiredEnv = entry.metadata?.requires?.env ?? [];
  if (requiredEnv.length > 0) {
    for (const envName of requiredEnv) {
      if (process.env[envName]) {
        continue;
      }
      if (skillConfig?.env?.[envName]) {
        continue;
      }
      if (skillConfig?.apiKey && entry.metadata?.primaryEnv === envName) {
        continue;
      }
      return false;
    }
  }
  const requiredConfig = entry.metadata?.requires?.config ?? [];
  if (requiredConfig.length > 0) {
    for (const configPath of requiredConfig) {
      if (!isConfigPathTruthy(config, configPath)) {
        return false;
      }
    }
  }
  return true;
}
export {
  hasBinary,
  isBundledSkillAllowed,
  isConfigPathTruthy,
  resolveBundledAllowlist,
  resolveConfigPath,
  resolveRuntimePlatform,
  resolveSkillConfig,
  shouldIncludeSkill
};
