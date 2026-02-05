import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from '../../routing/session-key.js';
function channelHasAccounts(cfg, channelKey) {
  const channels = cfg.channels;
  const base = channels?.[channelKey];
  return Boolean(base?.accounts && Object.keys(base.accounts).length > 0);
}
function shouldStoreNameInAccounts(params) {
  if (params.alwaysUseAccounts) {
    return true;
  }
  if (params.accountId !== DEFAULT_ACCOUNT_ID) {
    return true;
  }
  return channelHasAccounts(params.cfg, params.channelKey);
}
function applyAccountNameToChannelSection(params) {
  const trimmed = params.name?.trim();
  if (!trimmed) {
    return params.cfg;
  }
  const accountId = normalizeAccountId(params.accountId);
  const channels = params.cfg.channels;
  const baseConfig = channels?.[params.channelKey];
  const base = typeof baseConfig === 'object' && baseConfig ? baseConfig : void 0;
  const useAccounts = shouldStoreNameInAccounts({
    cfg: params.cfg,
    channelKey: params.channelKey,
    accountId,
    alwaysUseAccounts: params.alwaysUseAccounts
  });
  if (!useAccounts && accountId === DEFAULT_ACCOUNT_ID) {
    const safeBase = base ?? {};
    return {
      ...params.cfg,
      channels: {
        ...params.cfg.channels,
        [params.channelKey]: {
          ...safeBase,
          name: trimmed
        }
      }
    };
  }
  const baseAccounts = base?.accounts ?? {};
  const existingAccount = baseAccounts[accountId] ?? {};
  // eslint-disable-next-line no-unused-vars
  const baseWithoutName = accountId === DEFAULT_ACCOUNT_ID ? (({ name: _ignored, ...rest }) => rest)(base ?? {}) : base ?? {};
  return {
    ...params.cfg,
    channels: {
      ...params.cfg.channels,
      [params.channelKey]: {
        ...baseWithoutName,
        accounts: {
          ...baseAccounts,
          [accountId]: {
            ...existingAccount,
            name: trimmed
          }
        }
      }
    }
  };
}
function migrateBaseNameToDefaultAccount(params) {
  if (params.alwaysUseAccounts) {
    return params.cfg;
  }
  const channels = params.cfg.channels;
  const base = channels?.[params.channelKey];
  const baseName = base?.name?.trim();
  if (!baseName) {
    return params.cfg;
  }
  const accounts = {
    ...base?.accounts
  };
  const defaultAccount = accounts[DEFAULT_ACCOUNT_ID] ?? {};
  if (!defaultAccount.name) {
    accounts[DEFAULT_ACCOUNT_ID] = { ...defaultAccount, name: baseName };
  }
  // eslint-disable-next-line no-unused-vars
  const { name: _ignored, ...rest } = base ?? {};
  return {
    ...params.cfg,
    channels: {
      ...params.cfg.channels,
      [params.channelKey]: {
        ...rest,
        accounts
      }
    }
  };
}
export {
  applyAccountNameToChannelSection,
  migrateBaseNameToDefaultAccount
};
