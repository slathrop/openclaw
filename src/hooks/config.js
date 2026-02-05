import fs from 'node:fs';
import path from 'node:path';
import { resolveHookKey } from './frontmatter.js';
const DEFAULT_CONFIG_VALUES = {
  'browser.enabled': true,
  'browser.evaluateEnabled': true,
  'workspace.dir': true
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
function resolveHookConfig(config, hookKey) {
  const hooks = config?.hooks?.internal?.entries;
  if (!hooks || typeof hooks !== 'object') {
    return void 0;
  }
  const entry = hooks[hookKey];
  if (!entry || typeof entry !== 'object') {
    return void 0;
  }
  return entry;
}
function resolveRuntimePlatform() {
  return process.platform;
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
      // Intentionally ignored
    }
  }
  return false;
}
function shouldIncludeHook(params) {
  const { entry, config, eligibility } = params;
  const hookKey = resolveHookKey(entry.hook.name, entry);
  const hookConfig = resolveHookConfig(config, hookKey);
  const pluginManaged = entry.hook.source === 'openclaw-plugin';
  const osList = entry.metadata?.os ?? [];
  const remotePlatforms = eligibility?.remote?.platforms ?? [];
  if (!pluginManaged && hookConfig?.enabled === false) {
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
      if (hookConfig?.env?.[envName]) {
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
  isConfigPathTruthy,
  resolveConfigPath,
  resolveHookConfig,
  resolveRuntimePlatform,
  shouldIncludeHook
};
