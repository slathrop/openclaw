import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from 'openclaw/plugin-sdk';
import { normalizeBlueBubblesServerUrl } from './types.js';
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.bluebubbles?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return [];
  }
  return Object.keys(accounts).filter(Boolean);
}
function listBlueBubblesAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultBlueBubblesAccountId(cfg) {
  const ids = listBlueBubblesAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.bluebubbles?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return void 0;
  }
  return accounts[accountId];
}
function mergeBlueBubblesAccountConfig(cfg, accountId) {
  const base = cfg.channels?.bluebubbles ?? {};
  const { accounts: _ignored, ...rest } = base;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  const chunkMode = account.chunkMode ?? rest.chunkMode ?? 'length';
  return { ...rest, ...account, chunkMode };
}
function resolveBlueBubblesAccount(params) {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = params.cfg.channels?.bluebubbles?.enabled;
  const merged = mergeBlueBubblesAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const serverUrl = merged.serverUrl?.trim();
  const password = merged.password?.trim();
  const configured = Boolean(serverUrl && password);
  const baseUrl = serverUrl ? normalizeBlueBubblesServerUrl(serverUrl) : void 0;
  return {
    accountId,
    enabled: baseEnabled !== false && accountEnabled,
    name: merged.name?.trim() || void 0,
    config: merged,
    configured,
    baseUrl
  };
}
function listEnabledBlueBubblesAccounts(cfg) {
  return listBlueBubblesAccountIds(cfg).map((accountId) => resolveBlueBubblesAccount({ cfg, accountId })).filter((account) => account.enabled);
}
export {
  listBlueBubblesAccountIds,
  listEnabledBlueBubblesAccounts,
  resolveBlueBubblesAccount,
  resolveDefaultBlueBubblesAccountId
};
