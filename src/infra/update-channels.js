/**
 * Update channel definitions and resolution logic.
 *
 * Maps release channels (stable, beta, dev) to npm dist-tags and resolves
 * the effective channel based on install kind, config, and git state.
 */

/** @typedef {'stable' | 'beta' | 'dev'} UpdateChannel */
/** @typedef {'config' | 'git-tag' | 'git-branch' | 'default'} UpdateChannelSource */

export const DEFAULT_PACKAGE_CHANNEL = /** @type {UpdateChannel} */ ('stable');
export const DEFAULT_GIT_CHANNEL = /** @type {UpdateChannel} */ ('dev');
export const DEV_BRANCH = 'main';

/**
 * Normalize a raw string to a valid update channel.
 * @param {string | null | undefined} value
 * @returns {UpdateChannel | null}
 */
export function normalizeUpdateChannel(value) {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'stable' || normalized === 'beta' || normalized === 'dev') {
    return normalized;
  }
  return null;
}

/**
 * Map an update channel to its npm dist-tag.
 * @param {UpdateChannel} channel
 * @returns {string}
 */
export function channelToNpmTag(channel) {
  if (channel === 'beta') {
    return 'beta';
  }
  if (channel === 'dev') {
    return 'dev';
  }
  return 'latest';
}

/**
 * @param {string} tag
 * @returns {boolean}
 */
export function isBetaTag(tag) {
  return tag.toLowerCase().includes('-beta');
}

/**
 * @param {string} tag
 * @returns {boolean}
 */
export function isStableTag(tag) {
  return !isBetaTag(tag);
}

/**
 * Resolve the effective update channel from config, git tag, or git branch.
 * @param {{
 *   configChannel?: UpdateChannel | null,
 *   installKind: 'git' | 'package' | 'unknown',
 *   git?: { tag?: string | null, branch?: string | null }
 * }} params
 * @returns {{ channel: UpdateChannel, source: UpdateChannelSource }}
 */
export function resolveEffectiveUpdateChannel(params) {
  if (params.configChannel) {
    return {channel: params.configChannel, source: 'config'};
  }

  if (params.installKind === 'git') {
    const tag = params.git?.tag;
    if (tag) {
      return {channel: isBetaTag(tag) ? 'beta' : 'stable', source: 'git-tag'};
    }
    const branch = params.git?.branch;
    if (branch && branch !== 'HEAD') {
      return {channel: 'dev', source: 'git-branch'};
    }
    return {channel: DEFAULT_GIT_CHANNEL, source: 'default'};
  }

  if (params.installKind === 'package') {
    return {channel: DEFAULT_PACKAGE_CHANNEL, source: 'default'};
  }

  return {channel: DEFAULT_PACKAGE_CHANNEL, source: 'default'};
}

/**
 * Format a human-readable label for the update channel.
 * @param {{
 *   channel: UpdateChannel,
 *   source: UpdateChannelSource,
 *   gitTag?: string | null,
 *   gitBranch?: string | null
 * }} params
 * @returns {string}
 */
export function formatUpdateChannelLabel(params) {
  if (params.source === 'config') {
    return `${params.channel} (config)`;
  }
  if (params.source === 'git-tag') {
    return params.gitTag ? `${params.channel} (${params.gitTag})` : `${params.channel} (tag)`;
  }
  if (params.source === 'git-branch') {
    return params.gitBranch
      ? `${params.channel} (${params.gitBranch})`
      : `${params.channel} (branch)`;
  }
  return `${params.channel} (default)`;
}
