import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  collectBlueBubblesStatusIssues,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId,
  PAIRING_APPROVED_MESSAGE,
  resolveBlueBubblesGroupRequireMention,
  resolveBlueBubblesGroupToolPolicy,
  setAccountEnabledInConfigSection
} from 'openclaw/plugin-sdk';
import {
  listBlueBubblesAccountIds,
  resolveBlueBubblesAccount,
  resolveDefaultBlueBubblesAccountId
} from './accounts.js';
import { bluebubblesMessageActions } from './actions.js';
import { BlueBubblesConfigSchema } from './config-schema.js';
import { sendBlueBubblesMedia } from './media-send.js';
import { resolveBlueBubblesMessageId } from './monitor.js';
import { monitorBlueBubblesProvider, resolveWebhookPathFromConfig } from './monitor.js';
import { blueBubblesOnboardingAdapter } from './onboarding.js';
import { probeBlueBubbles } from './probe.js';
import { sendMessageBlueBubbles } from './send.js';
import {
  extractHandleFromChatGuid,
  looksLikeBlueBubblesTargetId,
  normalizeBlueBubblesHandle,
  normalizeBlueBubblesMessagingTarget,
  parseBlueBubblesTarget
} from './targets.js';
const meta = {
  id: 'bluebubbles',
  label: 'BlueBubbles',
  selectionLabel: 'BlueBubbles (macOS app)',
  detailLabel: 'BlueBubbles',
  docsPath: '/channels/bluebubbles',
  docsLabel: 'bluebubbles',
  blurb: 'iMessage via the BlueBubbles mac app + REST API.',
  systemImage: 'bubble.left.and.text.bubble.right',
  aliases: ['bb'],
  order: 75,
  preferOver: ['imessage']
};
const bluebubblesPlugin = {
  id: 'bluebubbles',
  meta,
  capabilities: {
    chatTypes: ['direct', 'group'],
    media: true,
    reactions: true,
    edit: true,
    unsend: true,
    reply: true,
    effects: true,
    groupManagement: true
  },
  groups: {
    resolveRequireMention: resolveBlueBubblesGroupRequireMention,
    resolveToolPolicy: resolveBlueBubblesGroupToolPolicy
  },
  threading: {
    buildToolContext: ({ context, hasRepliedRef }) => ({
      currentChannelId: context.To?.trim() || void 0,
      currentThreadTs: context.ReplyToIdFull ?? context.ReplyToId,
      hasRepliedRef
    })
  },
  reload: { configPrefixes: ['channels.bluebubbles'] },
  configSchema: buildChannelConfigSchema(BlueBubblesConfigSchema),
  onboarding: blueBubblesOnboardingAdapter,
  config: {
    listAccountIds: (cfg) => listBlueBubblesAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveBlueBubblesAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultBlueBubblesAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => setAccountEnabledInConfigSection({
      cfg,
      sectionKey: 'bluebubbles',
      accountId,
      enabled,
      allowTopLevel: true
    }),
    deleteAccount: ({ cfg, accountId }) => deleteAccountFromConfigSection({
      cfg,
      sectionKey: 'bluebubbles',
      accountId,
      clearBaseFields: ['serverUrl', 'password', 'name', 'webhookPath']
    }),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      baseUrl: account.baseUrl
    }),
    resolveAllowFrom: ({ cfg, accountId }) => (resolveBlueBubblesAccount({ cfg, accountId }).config.allowFrom ?? []).map(
      (entry) => String(entry)
    ),
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => entry.replace(/^bluebubbles:/i, '')).map((entry) => normalizeBlueBubblesHandle(entry))
  },
  actions: bluebubblesMessageActions,
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(cfg.channels?.bluebubbles?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath ? `channels.bluebubbles.accounts.${resolvedAccountId}.` : 'channels.bluebubbles.';
      return {
        policy: account.config.dmPolicy ?? 'pairing',
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint('bluebubbles'),
        normalizeEntry: (raw) => normalizeBlueBubblesHandle(raw.replace(/^bluebubbles:/i, ''))
      };
    },
    collectWarnings: ({ account }) => {
      const groupPolicy = account.config.groupPolicy ?? 'allowlist';
      if (groupPolicy !== 'open') {
        return [];
      }
      return [
        '- BlueBubbles groups: groupPolicy="open" allows any member to trigger the bot. Set channels.bluebubbles.groupPolicy="allowlist" + channels.bluebubbles.groupAllowFrom to restrict senders.'
      ];
    }
  },
  messaging: {
    normalizeTarget: normalizeBlueBubblesMessagingTarget,
    targetResolver: {
      looksLikeId: looksLikeBlueBubblesTargetId,
      hint: '<handle|chat_guid:GUID|chat_id:ID|chat_identifier:ID>'
    },
    formatTargetDisplay: ({ target, display }) => {
      const shouldParseDisplay = (value) => {
        if (looksLikeBlueBubblesTargetId(value)) {
          return true;
        }
        return /^(bluebubbles:|chat_guid:|chat_id:|chat_identifier:)/i.test(value);
      };
      const extractCleanDisplay = (value) => {
        const trimmed = value?.trim();
        if (!trimmed) {
          return null;
        }
        try {
          const parsed = parseBlueBubblesTarget(trimmed);
          if (parsed.kind === 'chat_guid') {
            const handle2 = extractHandleFromChatGuid(parsed.chatGuid);
            if (handle2) {
              return handle2;
            }
          }
          if (parsed.kind === 'handle') {
            return normalizeBlueBubblesHandle(parsed.to);
          }
        } catch { /* intentionally empty */ }
        const stripped = trimmed.replace(/^bluebubbles:/i, '').replace(/^chat_guid:/i, '').replace(/^chat_id:/i, '').replace(/^chat_identifier:/i, '');
        const handle = extractHandleFromChatGuid(stripped);
        if (handle) {
          return handle;
        }
        if (stripped.includes(';-;') || stripped.includes(';+;')) {
          return null;
        }
        return stripped;
      };
      const trimmedDisplay = display?.trim();
      if (trimmedDisplay) {
        if (!shouldParseDisplay(trimmedDisplay)) {
          return trimmedDisplay;
        }
        const cleanDisplay = extractCleanDisplay(trimmedDisplay);
        if (cleanDisplay) {
          return cleanDisplay;
        }
      }
      const cleanTarget = extractCleanDisplay(target);
      if (cleanTarget) {
        return cleanTarget;
      }
      return display?.trim() || target?.trim() || '';
    }
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) => applyAccountNameToChannelSection({
      cfg,
      channelKey: 'bluebubbles',
      accountId,
      name
    }),
    validateInput: ({ input }) => {
      if (!input.httpUrl && !input.password) {
        return 'BlueBubbles requires --http-url and --password.';
      }
      if (!input.httpUrl) {
        return 'BlueBubbles requires --http-url.';
      }
      if (!input.password) {
        return 'BlueBubbles requires --password.';
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: 'bluebubbles',
        accountId,
        name: input.name
      });
      const next = accountId !== DEFAULT_ACCOUNT_ID ? migrateBaseNameToDefaultAccount({
        cfg: namedConfig,
        channelKey: 'bluebubbles'
      }) : namedConfig;
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...next,
          channels: {
            ...next.channels,
            bluebubbles: {
              ...next.channels?.bluebubbles,
              enabled: true,
              ...input.httpUrl ? { serverUrl: input.httpUrl } : {},
              ...input.password ? { password: input.password } : {},
              ...input.webhookPath ? { webhookPath: input.webhookPath } : {}
            }
          }
        };
      }
      return {
        ...next,
        channels: {
          ...next.channels,
          bluebubbles: {
            ...next.channels?.bluebubbles,
            enabled: true,
            accounts: {
              ...next.channels?.bluebubbles?.accounts,
              [accountId]: {
                ...next.channels?.bluebubbles?.accounts?.[accountId],
                enabled: true,
                ...input.httpUrl ? { serverUrl: input.httpUrl } : {},
                ...input.password ? { password: input.password } : {},
                ...input.webhookPath ? { webhookPath: input.webhookPath } : {}
              }
            }
          }
        }
      };
    }
  },
  pairing: {
    idLabel: 'bluebubblesSenderId',
    normalizeAllowEntry: (entry) => normalizeBlueBubblesHandle(entry.replace(/^bluebubbles:/i, '')),
    notifyApproval: async ({ cfg, id }) => {
      await sendMessageBlueBubbles(id, PAIRING_APPROVED_MESSAGE, {
        cfg
      });
    }
  },
  outbound: {
    deliveryMode: 'direct',
    textChunkLimit: 4e3,
    resolveTarget: ({ to }) => {
      const trimmed = to?.trim();
      if (!trimmed) {
        return {
          ok: false,
          error: new Error('Delivering to BlueBubbles requires --to <handle|chat_guid:GUID>')
        };
      }
      return { ok: true, to: trimmed };
    },
    sendText: async ({ cfg, to, text, accountId, replyToId }) => {
      const rawReplyToId = typeof replyToId === 'string' ? replyToId.trim() : '';
      const replyToMessageGuid = rawReplyToId ? resolveBlueBubblesMessageId(rawReplyToId, { requireKnownShortId: true }) : '';
      const result = await sendMessageBlueBubbles(to, text, {
        cfg,
        accountId: accountId ?? void 0,
        replyToMessageGuid: replyToMessageGuid || void 0
      });
      return { channel: 'bluebubbles', ...result };
    },
    sendMedia: async (ctx) => {
      const { cfg, to, text, mediaUrl, accountId, replyToId } = ctx;
      const { mediaPath, mediaBuffer, contentType, filename, caption } = ctx;
      const resolvedCaption = caption ?? text;
      const result = await sendBlueBubblesMedia({
        cfg,
        to,
        mediaUrl,
        mediaPath,
        mediaBuffer,
        contentType,
        filename,
        caption: resolvedCaption ?? void 0,
        replyToId: replyToId ?? null,
        accountId: accountId ?? void 0
      });
      return { channel: 'bluebubbles', ...result };
    }
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null
    },
    collectStatusIssues: collectBlueBubblesStatusIssues,
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      baseUrl: snapshot.baseUrl ?? null,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null
    }),
    probeAccount: async ({ account, timeoutMs }) => probeBlueBubbles({
      baseUrl: account.baseUrl,
      password: account.config.password ?? null,
      timeoutMs
    }),
    buildAccountSnapshot: ({ account, runtime, probe }) => {
      const running = runtime?.running ?? false;
      const probeOk = probe?.ok;
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured: account.configured,
        baseUrl: account.baseUrl,
        running,
        connected: probeOk ?? running,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
        probe,
        lastInboundAt: runtime?.lastInboundAt ?? null,
        lastOutboundAt: runtime?.lastOutboundAt ?? null
      };
    }
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const webhookPath = resolveWebhookPathFromConfig(account.config);
      ctx.setStatus({
        accountId: account.accountId,
        baseUrl: account.baseUrl
      });
      ctx.log?.info(`[${account.accountId}] starting provider (webhook=${webhookPath})`);
      return monitorBlueBubblesProvider({
        account,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        statusSink: (patch) => ctx.setStatus({ accountId: ctx.accountId, ...patch }),
        webhookPath
      });
    }
  }
};
export {
  bluebubblesPlugin
};
