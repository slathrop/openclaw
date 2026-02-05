import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from '../routing/session-key.js';
import { resolveDiscordToken } from './token.js';
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.discord?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return [];
  }
  return Object.keys(accounts).filter(Boolean);
}
function listDiscordAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultDiscordAccountId(cfg) {
  const ids = listDiscordAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.discord?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return void 0;
  }
  return accounts[accountId];
}
function mergeDiscordAccountConfig(cfg, accountId) {
  // eslint-disable-next-line no-unused-vars
  const { accounts: _ignored, ...base } = cfg.channels?.discord ?? {};
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}
function resolveDiscordAccount(params) {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = params.cfg.channels?.discord?.enabled !== false;
  const merged = mergeDiscordAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const tokenResolution = resolveDiscordToken(params.cfg, { accountId });
  return {
    accountId,
    enabled,
    name: merged.name?.trim() || void 0,
    token: tokenResolution.token,
    tokenSource: tokenResolution.source,
    config: merged
  };
}
function listEnabledDiscordAccounts(cfg) {
  return listDiscordAccountIds(cfg).map((accountId) => resolveDiscordAccount({ cfg, accountId })).filter((account) => account.enabled);
}
export {
  listDiscordAccountIds,
  listEnabledDiscordAccounts,
  resolveDefaultDiscordAccountId,
  resolveDiscordAccount
};
