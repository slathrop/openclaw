import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from 'openclaw/plugin-sdk';
import { runZca, parseJsonOutput } from './zca.js';
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.zalouser?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return [];
  }
  return Object.keys(accounts).filter(Boolean);
}
function listZalouserAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultZalouserAccountId(cfg) {
  const zalouserConfig = cfg.channels?.zalouser;
  if (zalouserConfig?.defaultAccount?.trim()) {
    return zalouserConfig.defaultAccount.trim();
  }
  const ids = listZalouserAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.zalouser?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return void 0;
  }
  return accounts[accountId];
}
function mergeZalouserAccountConfig(cfg, accountId) {
  const raw = cfg.channels?.zalouser ?? {};
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}
function resolveZcaProfile(config, accountId) {
  if (config.profile?.trim()) {
    return config.profile.trim();
  }
  if (process.env.ZCA_PROFILE?.trim()) {
    return process.env.ZCA_PROFILE.trim();
  }
  if (accountId !== DEFAULT_ACCOUNT_ID) {
    return accountId;
  }
  return 'default';
}
async function checkZcaAuthenticated(profile) {
  const result = await runZca(['auth', 'status'], { profile, timeout: 5e3 });
  return result.ok;
}
async function resolveZalouserAccount(params) {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = params.cfg.channels?.zalouser?.enabled !== false;
  const merged = mergeZalouserAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const profile = resolveZcaProfile(merged, accountId);
  const authenticated = await checkZcaAuthenticated(profile);
  return {
    accountId,
    name: merged.name?.trim() || void 0,
    enabled,
    profile,
    authenticated,
    config: merged
  };
}
function resolveZalouserAccountSync(params) {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = params.cfg.channels?.zalouser?.enabled !== false;
  const merged = mergeZalouserAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const profile = resolveZcaProfile(merged, accountId);
  return {
    accountId,
    name: merged.name?.trim() || void 0,
    enabled,
    profile,
    authenticated: false,
    // unknown without async check
    config: merged
  };
}
async function listEnabledZalouserAccounts(cfg) {
  const ids = listZalouserAccountIds(cfg);
  const accounts = await Promise.all(
    ids.map((accountId) => resolveZalouserAccount({ cfg, accountId }))
  );
  return accounts.filter((account) => account.enabled);
}
async function getZcaUserInfo(profile) {
  const result = await runZca(['me', 'info', '-j'], { profile, timeout: 1e4 });
  if (!result.ok) {
    return null;
  }
  return parseJsonOutput(result.stdout);
}
export {
  checkZcaAuthenticated,
  getZcaUserInfo,
  listEnabledZalouserAccounts,
  listZalouserAccountIds,
  resolveDefaultZalouserAccountId,
  resolveZalouserAccount,
  resolveZalouserAccountSync
};
