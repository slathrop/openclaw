const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import fs from 'node:fs';
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from '../routing/session-key.js';
function resolveTelegramToken(cfg, opts = {}) {
  const accountId = normalizeAccountId(opts.accountId);
  const telegramCfg = cfg?.channels?.telegram;
  const resolveAccountCfg = /* @__PURE__ */ __name((id) => {
    const accounts = telegramCfg?.accounts;
    if (!accounts || typeof accounts !== 'object' || Array.isArray(accounts)) {
      return void 0;
    }
    const direct = accounts[id];
    if (direct) {
      return direct;
    }
    const matchKey = Object.keys(accounts).find((key) => normalizeAccountId(key) === id);
    return matchKey ? accounts[matchKey] : void 0;
  }, 'resolveAccountCfg');
  const accountCfg = resolveAccountCfg(
    accountId !== DEFAULT_ACCOUNT_ID ? accountId : DEFAULT_ACCOUNT_ID
  );
  const accountTokenFile = accountCfg?.tokenFile?.trim();
  if (accountTokenFile) {
    if (!fs.existsSync(accountTokenFile)) {
      opts.logMissingFile?.(
        `channels.telegram.accounts.${accountId}.tokenFile not found: ${accountTokenFile}`
      );
      return { token: '', source: 'none' };
    }
    try {
      const token = fs.readFileSync(accountTokenFile, 'utf-8').trim();
      if (token) {
        return { token, source: 'tokenFile' };
      }
    } catch (err) {
      opts.logMissingFile?.(
        `channels.telegram.accounts.${accountId}.tokenFile read failed: ${String(err)}`
      );
      return { token: '', source: 'none' };
    }
    return { token: '', source: 'none' };
  }
  const accountToken = accountCfg?.botToken?.trim();
  if (accountToken) {
    return { token: accountToken, source: 'config' };
  }
  const allowEnv = accountId === DEFAULT_ACCOUNT_ID;
  const tokenFile = telegramCfg?.tokenFile?.trim();
  if (tokenFile && allowEnv) {
    if (!fs.existsSync(tokenFile)) {
      opts.logMissingFile?.(`channels.telegram.tokenFile not found: ${tokenFile}`);
      return { token: '', source: 'none' };
    }
    try {
      const token = fs.readFileSync(tokenFile, 'utf-8').trim();
      if (token) {
        return { token, source: 'tokenFile' };
      }
    } catch (err) {
      opts.logMissingFile?.(`channels.telegram.tokenFile read failed: ${String(err)}`);
      return { token: '', source: 'none' };
    }
  }
  const configToken = telegramCfg?.botToken?.trim();
  if (configToken && allowEnv) {
    return { token: configToken, source: 'config' };
  }
  const envToken = allowEnv ? (opts.envToken ?? process.env.TELEGRAM_BOT_TOKEN)?.trim() : '';
  if (envToken) {
    return { token: envToken, source: 'env' };
  }
  return { token: '', source: 'none' };
}
__name(resolveTelegramToken, 'resolveTelegramToken');
export {
  resolveTelegramToken
};
