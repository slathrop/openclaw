import { normalizeChatType } from '../channels/chat-type.js';
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from '../routing/session-key.js';
import { resolveSlackAppToken, resolveSlackBotToken } from './token.js';
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.slack?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return [];
  }
  return Object.keys(accounts).filter(Boolean);
}
function listSlackAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultSlackAccountId(cfg) {
  const ids = listSlackAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.slack?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return void 0;
  }
  return accounts[accountId];
}
function mergeSlackAccountConfig(cfg, accountId) {
  // eslint-disable-next-line no-unused-vars
  const { accounts: _ignored, ...base } = cfg.channels?.slack ?? {};
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}
function resolveSlackAccount(params) {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = params.cfg.channels?.slack?.enabled !== false;
  const merged = mergeSlackAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const allowEnv = accountId === DEFAULT_ACCOUNT_ID;
  const envBot = allowEnv ? resolveSlackBotToken(process.env.SLACK_BOT_TOKEN) : void 0;
  const envApp = allowEnv ? resolveSlackAppToken(process.env.SLACK_APP_TOKEN) : void 0;
  const configBot = resolveSlackBotToken(merged.botToken);
  const configApp = resolveSlackAppToken(merged.appToken);
  const botToken = configBot ?? envBot;
  const appToken = configApp ?? envApp;
  const botTokenSource = configBot ? 'config' : envBot ? 'env' : 'none';
  const appTokenSource = configApp ? 'config' : envApp ? 'env' : 'none';
  return {
    accountId,
    enabled,
    name: merged.name?.trim() || void 0,
    botToken,
    appToken,
    botTokenSource,
    appTokenSource,
    config: merged,
    groupPolicy: merged.groupPolicy,
    textChunkLimit: merged.textChunkLimit,
    mediaMaxMb: merged.mediaMaxMb,
    reactionNotifications: merged.reactionNotifications,
    reactionAllowlist: merged.reactionAllowlist,
    replyToMode: merged.replyToMode,
    replyToModeByChatType: merged.replyToModeByChatType,
    actions: merged.actions,
    slashCommand: merged.slashCommand,
    dm: merged.dm,
    channels: merged.channels
  };
}
function listEnabledSlackAccounts(cfg) {
  return listSlackAccountIds(cfg).map((accountId) => resolveSlackAccount({ cfg, accountId })).filter((account) => account.enabled);
}
function resolveSlackReplyToMode(account, chatType) {
  const normalized = normalizeChatType(chatType ?? void 0);
  if (normalized && account.replyToModeByChatType?.[normalized] !== void 0) {
    return account.replyToModeByChatType[normalized] ?? 'off';
  }
  if (normalized === 'direct' && account.dm?.replyToMode !== void 0) {
    return account.dm.replyToMode;
  }
  return account.replyToMode ?? 'off';
}
export {
  listEnabledSlackAccounts,
  listSlackAccountIds,
  resolveDefaultSlackAccountId,
  resolveSlackAccount,
  resolveSlackReplyToMode
};
