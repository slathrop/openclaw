/**
 * @module markdown-tables
 * Markdown table rendering mode resolution per channel/account.
 */
import {normalizeChannelId} from '../channels/plugins/index.js';
import {normalizeAccountId} from '../routing/session-key.js';

const DEFAULT_TABLE_MODES = new Map([
  ['signal', 'bullets'],
  ['whatsapp', 'bullets']
]);

const isMarkdownTableMode = (value) =>
  value === 'off' || value === 'bullets' || value === 'code';

/**
 * @param {object | undefined} section
 * @param {string | null} [accountId]
 * @returns {string | undefined}
 */
function resolveMarkdownModeFromSection(section, accountId) {
  if (!section) {
    return undefined;
  }
  const normalizedAccountId = normalizeAccountId(accountId);
  const accounts = section.accounts;
  if (accounts && typeof accounts === 'object') {
    const direct = accounts[normalizedAccountId];
    const directMode = direct?.markdown?.tables;
    if (isMarkdownTableMode(directMode)) {
      return directMode;
    }
    const matchKey = Object.keys(accounts).find(
      (key) => key.toLowerCase() === normalizedAccountId.toLowerCase()
    );
    const match = matchKey ? accounts[matchKey] : undefined;
    const matchMode = match?.markdown?.tables;
    if (isMarkdownTableMode(matchMode)) {
      return matchMode;
    }
  }
  const sectionMode = section.markdown?.tables;
  return isMarkdownTableMode(sectionMode) ? sectionMode : undefined;
}

/**
 * Resolves the markdown table rendering mode for a channel/account.
 * @param {{ cfg?: object, channel?: string | null, accountId?: string | null }} params
 * @returns {string}
 */
export function resolveMarkdownTableMode(params) {
  const channel = normalizeChannelId(params.channel);
  const defaultMode = channel ? (DEFAULT_TABLE_MODES.get(channel) ?? 'code') : 'code';
  if (!channel || !params.cfg) {
    return defaultMode;
  }
  const channelsConfig = params.cfg.channels;
  const section = channelsConfig?.[channel] ?? params.cfg?.[channel];
  return resolveMarkdownModeFromSection(section, params.accountId) ?? defaultMode;
}
