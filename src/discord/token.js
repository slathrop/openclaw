import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from '../routing/session-key.js';
function normalizeDiscordToken(raw) {
  if (!raw) {
    return void 0;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return void 0;
  }
  return trimmed.replace(/^Bot\s+/i, '');
}
function resolveDiscordToken(cfg, opts = {}) {
  const accountId = normalizeAccountId(opts.accountId);
  const discordCfg = cfg?.channels?.discord;
  const accountCfg = accountId !== DEFAULT_ACCOUNT_ID ? discordCfg?.accounts?.[accountId] : discordCfg?.accounts?.[DEFAULT_ACCOUNT_ID];
  const accountToken = normalizeDiscordToken(accountCfg?.token ?? void 0);
  if (accountToken) {
    return { token: accountToken, source: 'config' };
  }
  const allowEnv = accountId === DEFAULT_ACCOUNT_ID;
  const configToken = allowEnv ? normalizeDiscordToken(discordCfg?.token ?? void 0) : void 0;
  if (configToken) {
    return { token: configToken, source: 'config' };
  }
  const envToken = allowEnv ? normalizeDiscordToken(opts.envToken ?? process.env.DISCORD_BOT_TOKEN) : void 0;
  if (envToken) {
    return { token: envToken, source: 'env' };
  }
  return { token: '', source: 'none' };
}
export {
  normalizeDiscordToken,
  resolveDiscordToken
};
