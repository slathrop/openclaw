import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from 'openclaw/plugin-sdk';
import { normalizeMattermostBaseUrl } from './client.js';
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.mattermost?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return [];
  }
  return Object.keys(accounts).filter(Boolean);
}
function listMattermostAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultMattermostAccountId(cfg) {
  const ids = listMattermostAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.mattermost?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return void 0;
  }
  return accounts[accountId];
}
function mergeMattermostAccountConfig(cfg, accountId) {
  const { accounts: _ignored, ...base } = cfg.channels?.mattermost ?? {};
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}
function resolveMattermostRequireMention(config) {
  if (config.chatmode === 'oncall') {
    return true;
  }
  if (config.chatmode === 'onmessage') {
    return false;
  }
  if (config.chatmode === 'onchar') {
    return true;
  }
  return config.requireMention;
}
function resolveMattermostAccount(params) {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = params.cfg.channels?.mattermost?.enabled !== false;
  const merged = mergeMattermostAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const allowEnv = accountId === DEFAULT_ACCOUNT_ID;
  const envToken = allowEnv ? process.env.MATTERMOST_BOT_TOKEN?.trim() : void 0;
  const envUrl = allowEnv ? process.env.MATTERMOST_URL?.trim() : void 0;
  const configToken = merged.botToken?.trim();
  const configUrl = merged.baseUrl?.trim();
  const botToken = configToken || envToken;
  const baseUrl = normalizeMattermostBaseUrl(configUrl || envUrl);
  const requireMention = resolveMattermostRequireMention(merged);
  const botTokenSource = configToken ? 'config' : envToken ? 'env' : 'none';
  const baseUrlSource = configUrl ? 'config' : envUrl ? 'env' : 'none';
  return {
    accountId,
    enabled,
    name: merged.name?.trim() || void 0,
    botToken,
    baseUrl,
    botTokenSource,
    baseUrlSource,
    config: merged,
    chatmode: merged.chatmode,
    oncharPrefixes: merged.oncharPrefixes,
    requireMention,
    textChunkLimit: merged.textChunkLimit,
    blockStreaming: merged.blockStreaming,
    blockStreamingCoalesce: merged.blockStreamingCoalesce
  };
}
function listEnabledMattermostAccounts(cfg) {
  return listMattermostAccountIds(cfg).map((accountId) => resolveMattermostAccount({ cfg, accountId })).filter((account) => account.enabled);
}
export {
  listEnabledMattermostAccounts,
  listMattermostAccountIds,
  resolveDefaultMattermostAccountId,
  resolveMattermostAccount
};
