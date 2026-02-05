const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { isTruthyEnvValue } from '../infra/env.js';
import { listBoundAccountIds, resolveDefaultAgentBoundAccountId } from '../routing/bindings.js';
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from '../routing/session-key.js';
import { resolveTelegramToken } from './token.js';
const debugAccounts = /* @__PURE__ */ __name((...args) => {
  if (isTruthyEnvValue(process.env.OPENCLAW_DEBUG_TELEGRAM_ACCOUNTS)) {
    console.warn('[telegram:accounts]', ...args);
  }
}, 'debugAccounts');
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.telegram?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return [];
  }
  const ids = /* @__PURE__ */ new Set();
  for (const key of Object.keys(accounts)) {
    if (!key) {
      continue;
    }
    ids.add(normalizeAccountId(key));
  }
  return [...ids];
}
__name(listConfiguredAccountIds, 'listConfiguredAccountIds');
function listTelegramAccountIds(cfg) {
  const ids = Array.from(
    /* @__PURE__ */ new Set([...listConfiguredAccountIds(cfg), ...listBoundAccountIds(cfg, 'telegram')])
  );
  debugAccounts('listTelegramAccountIds', ids);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
__name(listTelegramAccountIds, 'listTelegramAccountIds');
function resolveDefaultTelegramAccountId(cfg) {
  const boundDefault = resolveDefaultAgentBoundAccountId(cfg, 'telegram');
  if (boundDefault) {
    return boundDefault;
  }
  const ids = listTelegramAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
__name(resolveDefaultTelegramAccountId, 'resolveDefaultTelegramAccountId');
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.telegram?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return void 0;
  }
  const direct = accounts[accountId];
  if (direct) {
    return direct;
  }
  const normalized = normalizeAccountId(accountId);
  const matchKey = Object.keys(accounts).find((key) => normalizeAccountId(key) === normalized);
  return matchKey ? accounts[matchKey] : void 0;
}
__name(resolveAccountConfig, 'resolveAccountConfig');
function mergeTelegramAccountConfig(cfg, accountId) {
  // eslint-disable-next-line no-unused-vars
  const { accounts: _ignored, ...base } = cfg.channels?.telegram ?? {};
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}
__name(mergeTelegramAccountConfig, 'mergeTelegramAccountConfig');
function resolveTelegramAccount(params) {
  const hasExplicitAccountId = Boolean(params.accountId?.trim());
  const baseEnabled = params.cfg.channels?.telegram?.enabled !== false;
  const resolve = /* @__PURE__ */ __name((accountId) => {
    const merged = mergeTelegramAccountConfig(params.cfg, accountId);
    const accountEnabled = merged.enabled !== false;
    const enabled = baseEnabled && accountEnabled;
    const tokenResolution = resolveTelegramToken(params.cfg, { accountId });
    debugAccounts('resolve', {
      accountId,
      enabled,
      tokenSource: tokenResolution.source
    });
    return {
      accountId,
      enabled,
      name: merged.name?.trim() || void 0,
      token: tokenResolution.token,
      tokenSource: tokenResolution.source,
      config: merged
    };
  }, 'resolve');
  const normalized = normalizeAccountId(params.accountId);
  const primary = resolve(normalized);
  if (hasExplicitAccountId) {
    return primary;
  }
  if (primary.tokenSource !== 'none') {
    return primary;
  }
  const fallbackId = resolveDefaultTelegramAccountId(params.cfg);
  if (fallbackId === primary.accountId) {
    return primary;
  }
  const fallback = resolve(fallbackId);
  if (fallback.tokenSource === 'none') {
    return primary;
  }
  return fallback;
}
__name(resolveTelegramAccount, 'resolveTelegramAccount');
function listEnabledTelegramAccounts(cfg) {
  return listTelegramAccountIds(cfg).map((accountId) => resolveTelegramAccount({ cfg, accountId })).filter((account) => account.enabled);
}
__name(listEnabledTelegramAccounts, 'listEnabledTelegramAccounts');
export {
  listEnabledTelegramAccounts,
  listTelegramAccountIds,
  resolveDefaultTelegramAccountId,
  resolveTelegramAccount
};
