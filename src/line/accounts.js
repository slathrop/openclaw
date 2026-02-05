import fs from 'node:fs';
const DEFAULT_ACCOUNT_ID = 'default';
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
function resolveToken(params) {
  const { accountId, baseConfig, accountConfig } = params;
  if (accountConfig?.channelAccessToken?.trim()) {
    return { token: accountConfig.channelAccessToken.trim(), tokenSource: 'config' };
  }
  const accountFileToken = readFileIfExists(accountConfig?.tokenFile);
  if (accountFileToken) {
    return { token: accountFileToken, tokenSource: 'file' };
  }
  if (accountId === DEFAULT_ACCOUNT_ID) {
    if (baseConfig?.channelAccessToken?.trim()) {
      return { token: baseConfig.channelAccessToken.trim(), tokenSource: 'config' };
    }
    const baseFileToken = readFileIfExists(baseConfig?.tokenFile);
    if (baseFileToken) {
      return { token: baseFileToken, tokenSource: 'file' };
    }
    const envToken = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
    if (envToken) {
      return { token: envToken, tokenSource: 'env' };
    }
  }
  return { token: '', tokenSource: 'none' };
}
function resolveSecret(params) {
  const { accountId, baseConfig, accountConfig } = params;
  if (accountConfig?.channelSecret?.trim()) {
    return accountConfig.channelSecret.trim();
  }
  const accountFileSecret = readFileIfExists(accountConfig?.secretFile);
  if (accountFileSecret) {
    return accountFileSecret;
  }
  if (accountId === DEFAULT_ACCOUNT_ID) {
    if (baseConfig?.channelSecret?.trim()) {
      return baseConfig.channelSecret.trim();
    }
    const baseFileSecret = readFileIfExists(baseConfig?.secretFile);
    if (baseFileSecret) {
      return baseFileSecret;
    }
    const envSecret = process.env.LINE_CHANNEL_SECRET?.trim();
    if (envSecret) {
      return envSecret;
    }
  }
  return '';
}
function resolveLineAccount(params) {
  const { cfg, accountId = DEFAULT_ACCOUNT_ID } = params;
  const lineConfig = cfg.channels?.line;
  const accounts = lineConfig?.accounts;
  const accountConfig = accountId !== DEFAULT_ACCOUNT_ID ? accounts?.[accountId] : void 0;
  const { token, tokenSource } = resolveToken({
    accountId,
    baseConfig: lineConfig,
    accountConfig
  });
  const secret = resolveSecret({
    accountId,
    baseConfig: lineConfig,
    accountConfig
  });
  const mergedConfig = {
    ...lineConfig,
    ...accountConfig
  };
  const enabled = accountConfig?.enabled ?? (accountId === DEFAULT_ACCOUNT_ID ? lineConfig?.enabled ?? true : false);
  const name = accountConfig?.name ?? (accountId === DEFAULT_ACCOUNT_ID ? lineConfig?.name : void 0);
  return {
    accountId,
    name,
    enabled,
    channelAccessToken: token,
    channelSecret: secret,
    tokenSource,
    config: mergedConfig
  };
}
function listLineAccountIds(cfg) {
  const lineConfig = cfg.channels?.line;
  const accounts = lineConfig?.accounts;
  const ids = /* @__PURE__ */ new Set();
  if (lineConfig?.channelAccessToken?.trim() || lineConfig?.tokenFile || process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim()) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }
  if (accounts) {
    for (const id of Object.keys(accounts)) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}
function resolveDefaultLineAccountId(cfg) {
  const ids = listLineAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function normalizeAccountId(accountId) {
  const trimmed = accountId?.trim().toLowerCase();
  if (!trimmed || trimmed === 'default') {
    return DEFAULT_ACCOUNT_ID;
  }
  return trimmed;
}
export {
  DEFAULT_ACCOUNT_ID,
  listLineAccountIds,
  normalizeAccountId,
  resolveDefaultLineAccountId,
  resolveLineAccount
};
