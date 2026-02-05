import {
  addWildcardAllowFrom,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  promptAccountId
} from 'openclaw/plugin-sdk';
import { listZaloAccountIds, resolveDefaultZaloAccountId, resolveZaloAccount } from './accounts.js';
const channel = 'zalo';
function setZaloDmPolicy(cfg, dmPolicy2) {
  const allowFrom = dmPolicy2 === 'open' ? addWildcardAllowFrom(cfg.channels?.zalo?.allowFrom) : void 0;
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      zalo: {
        ...cfg.channels?.zalo,
        dmPolicy: dmPolicy2,
        ...allowFrom ? { allowFrom } : {}
      }
    }
  };
}
function setZaloUpdateMode(cfg, accountId, mode, webhookUrl, webhookSecret, webhookPath) {
  const isDefault = accountId === DEFAULT_ACCOUNT_ID;
  if (mode === 'polling') {
    if (isDefault) {
      const {
        webhookUrl: _url2,
        webhookSecret: _secret2,
        webhookPath: _path2,
        ...rest2
      } = cfg.channels?.zalo ?? {};
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          zalo: rest2
        }
      };
    }
    const accounts2 = { ...cfg.channels?.zalo?.accounts };
    const existing = accounts2[accountId] ?? {};
    const { webhookUrl: _url, webhookSecret: _secret, webhookPath: _path, ...rest } = existing;
    accounts2[accountId] = rest;
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        zalo: {
          ...cfg.channels?.zalo,
          accounts: accounts2
        }
      }
    };
  }
  if (isDefault) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        zalo: {
          ...cfg.channels?.zalo,
          webhookUrl,
          webhookSecret,
          webhookPath
        }
      }
    };
  }
  const accounts = { ...cfg.channels?.zalo?.accounts };
  accounts[accountId] = {
    ...accounts[accountId],
    webhookUrl,
    webhookSecret,
    webhookPath
  };
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      zalo: {
        ...cfg.channels?.zalo,
        accounts
      }
    }
  };
}
async function noteZaloTokenHelp(prompter) {
  await prompter.note(
    [
      '1) Open Zalo Bot Platform: https://bot.zaloplatforms.com',
      '2) Create a bot and get the token',
      '3) Token looks like 12345689:abc-xyz',
      'Tip: you can also set ZALO_BOT_TOKEN in your env.',
      'Docs: https://docs.openclaw.ai/channels/zalo'
    ].join('\n'),
    'Zalo bot token'
  );
}
async function promptZaloAllowFrom(params) {
  const { cfg, prompter, accountId } = params;
  const resolved = resolveZaloAccount({ cfg, accountId });
  const existingAllowFrom = resolved.config.allowFrom ?? [];
  const entry = await prompter.text({
    message: 'Zalo allowFrom (user id)',
    placeholder: '123456789',
    initialValue: existingAllowFrom[0] ? String(existingAllowFrom[0]) : void 0,
    validate: (value) => {
      const raw = String(value ?? '').trim();
      if (!raw) {
        return 'Required';
      }
      if (!/^\d+$/.test(raw)) {
        return 'Use a numeric Zalo user id';
      }
      return void 0;
    }
  });
  const normalized = String(entry).trim();
  const merged = [
    ...existingAllowFrom.map((item) => String(item).trim()).filter(Boolean),
    normalized
  ];
  const unique = [...new Set(merged)];
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        zalo: {
          ...cfg.channels?.zalo,
          enabled: true,
          dmPolicy: 'allowlist',
          allowFrom: unique
        }
      }
    };
  }
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      zalo: {
        ...cfg.channels?.zalo,
        enabled: true,
        accounts: {
          ...cfg.channels?.zalo?.accounts,
          [accountId]: {
            ...cfg.channels?.zalo?.accounts?.[accountId],
            enabled: cfg.channels?.zalo?.accounts?.[accountId]?.enabled ?? true,
            dmPolicy: 'allowlist',
            allowFrom: unique
          }
        }
      }
    }
  };
}
const dmPolicy = {
  label: 'Zalo',
  channel,
  policyKey: 'channels.zalo.dmPolicy',
  allowFromKey: 'channels.zalo.allowFrom',
  getCurrent: (cfg) => cfg.channels?.zalo?.dmPolicy ?? 'pairing',
  setPolicy: (cfg, policy) => setZaloDmPolicy(cfg, policy),
  promptAllowFrom: async ({ cfg, prompter, accountId }) => {
    const id = accountId && normalizeAccountId(accountId) ? normalizeAccountId(accountId) ?? DEFAULT_ACCOUNT_ID : resolveDefaultZaloAccountId(cfg);
    return promptZaloAllowFrom({
      cfg,
      prompter,
      accountId: id
    });
  }
};
const zaloOnboardingAdapter = {
  channel,
  dmPolicy,
  getStatus: async ({ cfg }) => {
    const configured = listZaloAccountIds(cfg).some(
      (accountId) => Boolean(resolveZaloAccount({ cfg, accountId }).token)
    );
    return {
      channel,
      configured,
      statusLines: [`Zalo: ${configured ? 'configured' : 'needs token'}`],
      selectionHint: configured ? 'recommended \xB7 configured' : 'recommended \xB7 newcomer-friendly',
      quickstartScore: configured ? 1 : 10
    };
  },
  configure: async ({
    cfg,
    prompter,
    accountOverrides,
    shouldPromptAccountIds,
    forceAllowFrom
  }) => {
    const zaloOverride = accountOverrides.zalo?.trim();
    const defaultZaloAccountId = resolveDefaultZaloAccountId(cfg);
    let zaloAccountId = zaloOverride ? normalizeAccountId(zaloOverride) : defaultZaloAccountId;
    if (shouldPromptAccountIds && !zaloOverride) {
      zaloAccountId = await promptAccountId({
        cfg,
        prompter,
        label: 'Zalo',
        currentId: zaloAccountId,
        listAccountIds: listZaloAccountIds,
        defaultAccountId: defaultZaloAccountId
      });
    }
    let next = cfg;
    const resolvedAccount = resolveZaloAccount({ cfg: next, accountId: zaloAccountId });
    const accountConfigured = Boolean(resolvedAccount.token);
    const allowEnv = zaloAccountId === DEFAULT_ACCOUNT_ID;
    const canUseEnv = allowEnv && Boolean(process.env.ZALO_BOT_TOKEN?.trim());
    const hasConfigToken = Boolean(
      resolvedAccount.config.botToken || resolvedAccount.config.tokenFile
    );
    let token = null;
    if (!accountConfigured) {
      await noteZaloTokenHelp(prompter);
    }
    if (canUseEnv && !resolvedAccount.config.botToken) {
      const keepEnv = await prompter.confirm({
        message: 'ZALO_BOT_TOKEN detected. Use env var?',
        initialValue: true
      });
      if (keepEnv) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            zalo: {
              ...next.channels?.zalo,
              enabled: true
            }
          }
        };
      } else {
        token = String(
          await prompter.text({
            message: 'Enter Zalo bot token',
            validate: (value) => value?.trim() ? void 0 : 'Required'
          })
        ).trim();
      }
    } else if (hasConfigToken) {
      const keep = await prompter.confirm({
        message: 'Zalo token already configured. Keep it?',
        initialValue: true
      });
      if (!keep) {
        token = String(
          await prompter.text({
            message: 'Enter Zalo bot token',
            validate: (value) => value?.trim() ? void 0 : 'Required'
          })
        ).trim();
      }
    } else {
      token = String(
        await prompter.text({
          message: 'Enter Zalo bot token',
          validate: (value) => value?.trim() ? void 0 : 'Required'
        })
      ).trim();
    }
    if (token) {
      if (zaloAccountId === DEFAULT_ACCOUNT_ID) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            zalo: {
              ...next.channels?.zalo,
              enabled: true,
              botToken: token
            }
          }
        };
      } else {
        next = {
          ...next,
          channels: {
            ...next.channels,
            zalo: {
              ...next.channels?.zalo,
              enabled: true,
              accounts: {
                ...next.channels?.zalo?.accounts,
                [zaloAccountId]: {
                  ...next.channels?.zalo?.accounts?.[zaloAccountId],
                  enabled: true,
                  botToken: token
                }
              }
            }
          }
        };
      }
    }
    const wantsWebhook = await prompter.confirm({
      message: 'Use webhook mode for Zalo?',
      initialValue: false
    });
    if (wantsWebhook) {
      const webhookUrl = String(
        await prompter.text({
          message: 'Webhook URL (https://...) ',
          validate: (value) => value?.trim()?.startsWith('https://') ? void 0 : 'HTTPS URL required'
        })
      ).trim();
      const defaultPath = (() => {
        try {
          return new URL(webhookUrl).pathname || '/zalo-webhook';
        } catch {
          return '/zalo-webhook';
        }
      })();
      const webhookSecret = String(
        await prompter.text({
          message: 'Webhook secret (8-256 chars)',
          validate: (value) => {
            const raw = String(value ?? '');
            if (raw.length < 8 || raw.length > 256) {
              return '8-256 chars';
            }
            return void 0;
          }
        })
      ).trim();
      const webhookPath = String(
        await prompter.text({
          message: 'Webhook path (optional)',
          initialValue: defaultPath
        })
      ).trim();
      next = setZaloUpdateMode(
        next,
        zaloAccountId,
        'webhook',
        webhookUrl,
        webhookSecret,
        webhookPath || void 0
      );
    } else {
      next = setZaloUpdateMode(next, zaloAccountId, 'polling');
    }
    if (forceAllowFrom) {
      next = await promptZaloAllowFrom({
        cfg: next,
        prompter,
        accountId: zaloAccountId
      });
    }
    return { cfg: next, accountId: zaloAccountId };
  }
};
export {
  zaloOnboardingAdapter
};
