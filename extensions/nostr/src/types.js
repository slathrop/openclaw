import { getPublicKeyFromPrivate } from './nostr-bus.js';
import { DEFAULT_RELAYS } from './nostr-bus.js';
const DEFAULT_ACCOUNT_ID = 'default';
function listNostrAccountIds(cfg) {
  const nostrCfg = cfg.channels?.nostr;
  if (nostrCfg?.privateKey) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return [];
}
function resolveDefaultNostrAccountId(cfg) {
  const ids = listNostrAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveNostrAccount(opts) {
  const accountId = opts.accountId ?? DEFAULT_ACCOUNT_ID;
  const nostrCfg = opts.cfg.channels?.nostr;
  const baseEnabled = nostrCfg?.enabled !== false;
  const privateKey = nostrCfg?.privateKey ?? '';
  const configured = Boolean(privateKey.trim());
  let publicKey = '';
  if (configured) {
    try {
      publicKey = getPublicKeyFromPrivate(privateKey);
    } catch { /* intentionally empty */ }
  }
  return {
    accountId,
    name: nostrCfg?.name?.trim() || void 0,
    enabled: baseEnabled,
    configured,
    privateKey,
    publicKey,
    relays: nostrCfg?.relays ?? DEFAULT_RELAYS,
    profile: nostrCfg?.profile,
    config: {
      enabled: nostrCfg?.enabled,
      name: nostrCfg?.name,
      privateKey: nostrCfg?.privateKey,
      relays: nostrCfg?.relays,
      dmPolicy: nostrCfg?.dmPolicy,
      allowFrom: nostrCfg?.allowFrom,
      profile: nostrCfg?.profile
    }
  };
}
export {
  listNostrAccountIds,
  resolveDefaultNostrAccountId,
  resolveNostrAccount
};
