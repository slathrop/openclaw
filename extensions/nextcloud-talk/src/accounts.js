import { readFileSync } from 'node:fs';
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from 'openclaw/plugin-sdk';
const TRUTHY_ENV = /* @__PURE__ */ new Set(['true', '1', 'yes', 'on']);
function isTruthyEnvValue(value) {
  if (!value) {
    return false;
  }
  return TRUTHY_ENV.has(value.trim().toLowerCase());
}
const debugAccounts = (...args) => {
  if (isTruthyEnvValue(process.env.OPENCLAW_DEBUG_NEXTCLOUD_TALK_ACCOUNTS)) {
    console.warn('[nextcloud-talk:accounts]', ...args);
  }
};
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.['nextcloud-talk']?.accounts;
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
function listNextcloudTalkAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  debugAccounts('listNextcloudTalkAccountIds', ids);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultNextcloudTalkAccountId(cfg) {
  const ids = listNextcloudTalkAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.['nextcloud-talk']?.accounts;
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
function mergeNextcloudTalkAccountConfig(cfg, accountId) {
  const { accounts: _ignored, ...base } = cfg.channels?.['nextcloud-talk'] ?? {};
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}
function resolveNextcloudTalkSecret(cfg, opts) {
  const merged = mergeNextcloudTalkAccountConfig(cfg, opts.accountId ?? DEFAULT_ACCOUNT_ID);
  const envSecret = process.env.NEXTCLOUD_TALK_BOT_SECRET?.trim();
  if (envSecret && (!opts.accountId || opts.accountId === DEFAULT_ACCOUNT_ID)) {
    return { secret: envSecret, source: 'env' };
  }
  if (merged.botSecretFile) {
    try {
      const fileSecret = readFileSync(merged.botSecretFile, 'utf-8').trim();
      if (fileSecret) {
        return { secret: fileSecret, source: 'secretFile' };
      }
    } catch { /* intentionally empty */ }
  }
  if (merged.botSecret?.trim()) {
    return { secret: merged.botSecret.trim(), source: 'config' };
  }
  return { secret: '', source: 'none' };
}
function resolveNextcloudTalkAccount(params) {
  const hasExplicitAccountId = Boolean(params.accountId?.trim());
  const baseEnabled = params.cfg.channels?.['nextcloud-talk']?.enabled !== false;
  const resolve = (accountId) => {
    const merged = mergeNextcloudTalkAccountConfig(params.cfg, accountId);
    const accountEnabled = merged.enabled !== false;
    const enabled = baseEnabled && accountEnabled;
    const secretResolution = resolveNextcloudTalkSecret(params.cfg, { accountId });
    const baseUrl = merged.baseUrl?.trim()?.replace(/\/$/, '') ?? '';
    debugAccounts('resolve', {
      accountId,
      enabled,
      secretSource: secretResolution.source,
      baseUrl: baseUrl ? '[set]' : '[missing]'
    });
    return {
      accountId,
      enabled,
      name: merged.name?.trim() || void 0,
      baseUrl,
      secret: secretResolution.secret,
      secretSource: secretResolution.source,
      config: merged
    };
  };
  const normalized = normalizeAccountId(params.accountId);
  const primary = resolve(normalized);
  if (hasExplicitAccountId) {
    return primary;
  }
  if (primary.secretSource !== 'none') {
    return primary;
  }
  const fallbackId = resolveDefaultNextcloudTalkAccountId(params.cfg);
  if (fallbackId === primary.accountId) {
    return primary;
  }
  const fallback = resolve(fallbackId);
  if (fallback.secretSource === 'none') {
    return primary;
  }
  return fallback;
}
function listEnabledNextcloudTalkAccounts(cfg) {
  return listNextcloudTalkAccountIds(cfg).map((accountId) => resolveNextcloudTalkAccount({ cfg, accountId })).filter((account) => account.enabled);
}
export {
  listEnabledNextcloudTalkAccounts,
  listNextcloudTalkAccountIds,
  resolveDefaultNextcloudTalkAccountId,
  resolveNextcloudTalkAccount
};
