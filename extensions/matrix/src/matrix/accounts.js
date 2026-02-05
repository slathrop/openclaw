import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from 'openclaw/plugin-sdk';
import { resolveMatrixConfig } from './client.js';
import { credentialsMatchConfig, loadMatrixCredentials } from './credentials.js';
function listMatrixAccountIds(_cfg) {
  return [DEFAULT_ACCOUNT_ID];
}
function resolveDefaultMatrixAccountId(cfg) {
  const ids = listMatrixAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveMatrixAccount(params) {
  const accountId = normalizeAccountId(params.accountId);
  const base = params.cfg.channels?.matrix ?? {};
  const enabled = base.enabled !== false;
  const resolved = resolveMatrixConfig(params.cfg, process.env);
  const hasHomeserver = Boolean(resolved.homeserver);
  const hasUserId = Boolean(resolved.userId);
  const hasAccessToken = Boolean(resolved.accessToken);
  const hasPassword = Boolean(resolved.password);
  const hasPasswordAuth = hasUserId && hasPassword;
  const stored = loadMatrixCredentials(process.env);
  const hasStored = stored && resolved.homeserver ? credentialsMatchConfig(stored, {
    homeserver: resolved.homeserver,
    userId: resolved.userId || ''
  }) : false;
  const configured = hasHomeserver && (hasAccessToken || hasPasswordAuth || Boolean(hasStored));
  return {
    accountId,
    enabled,
    name: base.name?.trim() || void 0,
    configured,
    homeserver: resolved.homeserver || void 0,
    userId: resolved.userId || void 0,
    config: base
  };
}
function listEnabledMatrixAccounts(cfg) {
  return listMatrixAccountIds(cfg).map((accountId) => resolveMatrixAccount({ cfg, accountId })).filter((account) => account.enabled);
}
export {
  listEnabledMatrixAccounts,
  listMatrixAccountIds,
  resolveDefaultMatrixAccountId,
  resolveMatrixAccount
};
