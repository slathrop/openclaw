import fs from 'node:fs';
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from '../routing/session-key.js';
function readFileIfExists(filePath) {
  if (!filePath) {
    return void 0;
  }
  try {
    return fs.readFileSync(filePath, 'utf-8').trim();
  } catch {
    return void 0;
  }
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.feishu?.accounts;
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
function mergeFeishuAccountConfig(cfg, accountId) {
  // eslint-disable-next-line no-unused-vars
  const { accounts: _ignored, ...base } = cfg.channels?.feishu ?? {};
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}
function resolveAppSecret(config) {
  const direct = config?.appSecret?.trim();
  if (direct) {
    return { value: direct, source: 'config' };
  }
  const fromFile = readFileIfExists(config?.appSecretFile);
  if (fromFile) {
    return { value: fromFile, source: 'file' };
  }
  return {};
}
function listFeishuAccountIds(cfg) {
  const feishuCfg = cfg.channels?.feishu;
  const accounts = feishuCfg?.accounts;
  const ids = /* @__PURE__ */ new Set();
  const baseConfigured = Boolean(
    feishuCfg?.appId?.trim() && (feishuCfg?.appSecret?.trim() || Boolean(feishuCfg?.appSecretFile))
  );
  const envConfigured = Boolean(
    process.env.FEISHU_APP_ID?.trim() && process.env.FEISHU_APP_SECRET?.trim()
  );
  if (baseConfigured || envConfigured) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }
  if (accounts) {
    for (const id of Object.keys(accounts)) {
      ids.add(normalizeAccountId(id));
    }
  }
  return Array.from(ids);
}
function resolveDefaultFeishuAccountId(cfg) {
  const ids = listFeishuAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveFeishuAccount(params) {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = params.cfg.channels?.feishu?.enabled !== false;
  const merged = mergeFeishuAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const allowEnv = accountId === DEFAULT_ACCOUNT_ID;
  const envAppId = allowEnv ? process.env.FEISHU_APP_ID?.trim() : void 0;
  const envAppSecret = allowEnv ? process.env.FEISHU_APP_SECRET?.trim() : void 0;
  const appId = merged.appId?.trim() || envAppId || '';
  const secretResolution = resolveAppSecret(merged);
  const appSecret = secretResolution.value ?? envAppSecret ?? '';
  let tokenSource = 'none';
  if (secretResolution.value) {
    tokenSource = secretResolution.source ?? 'config';
  } else if (envAppSecret) {
    tokenSource = 'env';
  }
  if (!appId || !appSecret) {
    tokenSource = 'none';
  }
  const config = {
    ...merged,
    appId,
    appSecret
  };
  const name = config.name?.trim() || config.botName?.trim() || void 0;
  return {
    accountId,
    config,
    tokenSource,
    name,
    enabled
  };
}
export {
  listFeishuAccountIds,
  resolveDefaultFeishuAccountId,
  resolveFeishuAccount
};
