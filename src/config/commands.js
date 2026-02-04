/**
 * @module commands
 * CLI command registration and native command resolution.
 */
import {normalizeChannelId} from '../channels/plugins/index.js';

/**
 * @param {string} [providerId]
 * @returns {boolean}
 */
function resolveAutoDefault(providerId) {
  const id = normalizeChannelId(providerId);
  if (!id) {
    return false;
  }
  if (id === 'discord' || id === 'telegram') {
    return true;
  }
  if (id === 'slack') {
    return false;
  }
  return false;
}

/**
 * Resolves whether native skills are enabled for a channel.
 * @param {{ providerId: string, providerSetting?: boolean | 'auto', globalSetting?: boolean | 'auto' }} params
 * @returns {boolean}
 */
export function resolveNativeSkillsEnabled(params) {
  const {providerId, providerSetting, globalSetting} = params;
  const setting = providerSetting === undefined ? globalSetting : providerSetting;
  if (setting === true) {
    return true;
  }
  if (setting === false) {
    return false;
  }
  return resolveAutoDefault(providerId);
}

/**
 * Resolves whether native commands are enabled for a channel.
 * @param {{ providerId: string, providerSetting?: boolean | 'auto', globalSetting?: boolean | 'auto' }} params
 * @returns {boolean}
 */
export function resolveNativeCommandsEnabled(params) {
  const {providerId, providerSetting, globalSetting} = params;
  const setting = providerSetting === undefined ? globalSetting : providerSetting;
  if (setting === true) {
    return true;
  }
  if (setting === false) {
    return false;
  }
  // auto or undefined -> heuristic
  return resolveAutoDefault(providerId);
}

/**
 * @param {{ providerSetting?: boolean | 'auto', globalSetting?: boolean | 'auto' }} params
 * @returns {boolean}
 */
export function isNativeCommandsExplicitlyDisabled(params) {
  const {providerSetting, globalSetting} = params;
  if (providerSetting === false) {
    return true;
  }
  if (providerSetting === undefined) {
    return globalSetting === false;
  }
  return false;
}
