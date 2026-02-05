import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from 'openclaw/plugin-sdk';
import { resolveZaloToken } from './token.js';
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.zalo?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return [];
  }
  return Object.keys(accounts).filter(Boolean);
}
function listZaloAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultZaloAccountId(cfg) {
  const zaloConfig = cfg.channels?.zalo;
  if (zaloConfig?.defaultAccount?.trim()) {
    return zaloConfig.defaultAccount.trim();
  }
  const ids = listZaloAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.zalo?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return void 0;
  }
  return accounts[accountId];
}
function mergeZaloAccountConfig(cfg, accountId) {
  const raw = cfg.channels?.zalo ?? {};
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}
function resolveZaloAccount(params) {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = params.cfg.channels?.zalo?.enabled !== false;
  const merged = mergeZaloAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const tokenResolution = resolveZaloToken(
    params.cfg.channels?.zalo,
    accountId
  );
  return {
    accountId,
    name: merged.name?.trim() || void 0,
    enabled,
    token: tokenResolution.token,
    tokenSource: tokenResolution.source,
    config: merged
  };
}
function listEnabledZaloAccounts(cfg) {
  return listZaloAccountIds(cfg).map((accountId) => resolveZaloAccount({ cfg, accountId })).filter((account) => account.enabled);
}
export {
  listEnabledZaloAccounts,
  listZaloAccountIds,
  resolveDefaultZaloAccountId,
  resolveZaloAccount
};
