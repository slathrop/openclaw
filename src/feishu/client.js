import * as Lark from '@larksuiteoapi/node-sdk';
import fs from 'node:fs';
import { loadConfig } from '../config/config.js';
import { getChildLogger } from '../logging.js';
import { DEFAULT_ACCOUNT_ID } from '../routing/session-key.js';
import { normalizeFeishuDomain } from './domain.js';
const logger = getChildLogger({ module: 'feishu-client' });
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
function resolveAppSecret(config) {
  const direct = config?.appSecret?.trim();
  if (direct) {
    return direct;
  }
  return readFileIfExists(config?.appSecretFile);
}
function getFeishuClient(accountIdOrAppId, explicitAppSecret) {
  const cfg = loadConfig();
  const feishuCfg = cfg.channels?.feishu;
  let appId;
  let appSecret = explicitAppSecret?.trim() || void 0;
  let domain;
  const isAppId = accountIdOrAppId?.startsWith('cli_');
  const accountId = isAppId ? void 0 : accountIdOrAppId || DEFAULT_ACCOUNT_ID;
  if (!appSecret && feishuCfg?.accounts) {
    if (isAppId) {
      for (const [, acc] of Object.entries(feishuCfg.accounts)) {
        if (acc.appId === accountIdOrAppId) {
          appId = acc.appId;
          appSecret = resolveAppSecret(acc);
          domain = acc.domain ?? feishuCfg?.domain;
          break;
        }
      }
      if (!appSecret) {
        appId = accountIdOrAppId;
        const firstKey = Object.keys(feishuCfg.accounts)[0];
        if (firstKey) {
          const acc = feishuCfg.accounts[firstKey];
          appSecret = resolveAppSecret(acc);
          domain = acc.domain ?? feishuCfg?.domain;
        }
      }
    } else if (accountId && feishuCfg.accounts[accountId]) {
      const acc = feishuCfg.accounts[accountId];
      appId = acc.appId;
      appSecret = resolveAppSecret(acc);
      domain = acc.domain ?? feishuCfg?.domain;
    } else if (!accountId) {
      const firstKey = Object.keys(feishuCfg.accounts)[0];
      if (firstKey) {
        const acc = feishuCfg.accounts[firstKey];
        appId = acc.appId;
        appSecret = resolveAppSecret(acc);
        domain = acc.domain ?? feishuCfg?.domain;
      }
    }
  }
  if (!appId && feishuCfg?.appId) {
    appId = feishuCfg.appId.trim();
  }
  if (!appSecret) {
    appSecret = resolveAppSecret(feishuCfg);
  }
  if (!domain) {
    domain = feishuCfg?.domain;
  }
  if (!appId) {
    appId = process.env.FEISHU_APP_ID?.trim();
  }
  if (!appSecret) {
    appSecret = process.env.FEISHU_APP_SECRET?.trim();
  }
  if (!appId || !appSecret) {
    throw new Error(
      'Feishu app ID/secret not configured. Set channels.feishu.accounts.<id>.appId/appSecret (or appSecretFile) or FEISHU_APP_ID/FEISHU_APP_SECRET.'
    );
  }
  const resolvedDomain = normalizeFeishuDomain(domain);
  const client = new Lark.Client({
    appId,
    appSecret,
    ...resolvedDomain ? { domain: resolvedDomain } : {},
    logger: {
      debug: (msg) => {
        logger.debug(msg);
      },
      info: (msg) => {
        logger.info(msg);
      },
      warn: (msg) => {
        logger.warn(msg);
      },
      error: (msg) => {
        logger.error(msg);
      },
      trace: (msg) => {
        logger.silly(msg);
      }
    }
  });
  return client;
}
export {
  getFeishuClient
};
