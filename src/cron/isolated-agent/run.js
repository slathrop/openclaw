import {

  // SECURITY: This module handles security-sensitive operations.
  // Changes should be reviewed carefully for security implications.

  resolveAgentConfig,
  resolveAgentDir,
  resolveAgentModelFallbacksOverride,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId
} from '../../agents/agent-scope.js';
import { runCliAgent } from '../../agents/cli-runner.js';
import { getCliSessionId, setCliSessionId } from '../../agents/cli-session.js';
import { lookupContextTokens } from '../../agents/context.js';
import {
  formatUserTime,
  resolveUserTimeFormat,
  resolveUserTimezone
} from '../../agents/date-time.js';
import { DEFAULT_CONTEXT_TOKENS, DEFAULT_MODEL, DEFAULT_PROVIDER } from '../../agents/defaults.js';
import { loadModelCatalog } from '../../agents/model-catalog.js';
import { runWithModelFallback } from '../../agents/model-fallback.js';
import {
  getModelRefStatus,
  isCliProvider,
  resolveAllowedModelRef,
  resolveConfiguredModelRef,
  resolveHooksGmailModel,
  resolveThinkingDefault
} from '../../agents/model-selection.js';
import { runEmbeddedPiAgent } from '../../agents/pi-embedded.js';
import { buildWorkspaceSkillSnapshot } from '../../agents/skills.js';
import { getSkillsSnapshotVersion } from '../../agents/skills/refresh.js';
import { resolveAgentTimeoutMs } from '../../agents/timeout.js';
import { hasNonzeroUsage } from '../../agents/usage.js';
import { ensureAgentWorkspace } from '../../agents/workspace.js';
import {
  normalizeThinkLevel,
  normalizeVerboseLevel,
  supportsXHighThinking
} from '../../auto-reply/thinking.js';
import { createOutboundSendDeps } from '../../cli/outbound-send-deps.js';
import { resolveSessionTranscriptPath, updateSessionStore } from '../../config/sessions.js';
import { registerAgentRunContext } from '../../infra/agent-events.js';
import { deliverOutboundPayloads } from '../../infra/outbound/deliver.js';
import { getRemoteSkillEligibility } from '../../infra/skills-remote.js';
import { logWarn } from '../../logger.js';
import { buildAgentMainSessionKey, normalizeAgentId } from '../../routing/session-key.js';
import {
  buildSafeExternalPrompt,
  detectSuspiciousPatterns,
  getHookType,
  isExternalHookSession
} from '../../security/external-content.js';
import { resolveCronDeliveryPlan } from '../delivery.js';
import { resolveDeliveryTarget } from './delivery-target.js';
import {
  isHeartbeatOnlyResponse,
  pickLastNonEmptyTextFromPayloads,
  pickSummaryFromOutput,
  pickSummaryFromPayloads,
  resolveHeartbeatAckMaxChars
} from './helpers.js';
import { resolveCronSession } from './session.js';
function matchesMessagingToolDeliveryTarget(target, delivery) {
  if (!delivery.to || !target.to) {
    return false;
  }
  const channel = delivery.channel.trim().toLowerCase();
  const provider = target.provider?.trim().toLowerCase();
  if (provider && provider !== 'message' && provider !== channel) {
    return false;
  }
  if (target.accountId && delivery.accountId && target.accountId !== delivery.accountId) {
    return false;
  }
  return target.to === delivery.to;
}
function resolveCronDeliveryBestEffort(job) {
  if (typeof job.delivery?.bestEffort === 'boolean') {
    return job.delivery.bestEffort;
  }
  if (job.payload.kind === 'agentTurn' && typeof job.payload.bestEffortDeliver === 'boolean') {
    return job.payload.bestEffortDeliver;
  }
  return false;
}
async function runCronIsolatedAgentTurn(params) {
  const defaultAgentId = resolveDefaultAgentId(params.cfg);
  const requestedAgentId = typeof params.agentId === 'string' && params.agentId.trim() ? params.agentId : typeof params.job.agentId === 'string' && params.job.agentId.trim() ? params.job.agentId : void 0;
  const normalizedRequested = requestedAgentId ? normalizeAgentId(requestedAgentId) : void 0;
  const agentConfigOverride = normalizedRequested ? resolveAgentConfig(params.cfg, normalizedRequested) : void 0;
  const { model: overrideModel, ...agentOverrideRest } = agentConfigOverride ?? {};
  const agentId = agentConfigOverride ? normalizedRequested ?? defaultAgentId : defaultAgentId;
  const agentCfg = Object.assign(
    {},
    params.cfg.agents?.defaults,
    agentOverrideRest
  );
  if (typeof overrideModel === 'string') {
    agentCfg.model = { primary: overrideModel };
  } else if (overrideModel) {
    agentCfg.model = overrideModel;
  }
  const cfgWithAgentDefaults = {
    ...params.cfg,
    agents: Object.assign({}, params.cfg.agents, { defaults: agentCfg })
  };
  const baseSessionKey = (params.sessionKey?.trim() || `cron:${params.job.id}`).trim();
  const agentSessionKey = buildAgentMainSessionKey({
    agentId,
    mainKey: baseSessionKey
  });
  const workspaceDirRaw = resolveAgentWorkspaceDir(params.cfg, agentId);
  const agentDir = resolveAgentDir(params.cfg, agentId);
  const workspace = await ensureAgentWorkspace({
    dir: workspaceDirRaw,
    ensureBootstrapFiles: !agentCfg?.skipBootstrap
  });
  const workspaceDir = workspace.dir;
  const resolvedDefault = resolveConfiguredModelRef({
    cfg: cfgWithAgentDefaults,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL
  });
  let provider = resolvedDefault.provider;
  let model = resolvedDefault.model;
  let catalog;
  const loadCatalog = async () => {
    if (!catalog) {
      catalog = await loadModelCatalog({ config: cfgWithAgentDefaults });
    }
    return catalog;
  };
  const isGmailHook = baseSessionKey.startsWith('hook:gmail:');
  const hooksGmailModelRef = isGmailHook ? resolveHooksGmailModel({
    cfg: params.cfg,
    defaultProvider: DEFAULT_PROVIDER
  }) : null;
  if (hooksGmailModelRef) {
    const status = getModelRefStatus({
      cfg: params.cfg,
      catalog: await loadCatalog(),
      ref: hooksGmailModelRef,
      defaultProvider: resolvedDefault.provider,
      defaultModel: resolvedDefault.model
    });
    if (status.allowed) {
      provider = hooksGmailModelRef.provider;
      model = hooksGmailModelRef.model;
    }
  }
  const modelOverrideRaw = params.job.payload.kind === 'agentTurn' ? params.job.payload.model : void 0;
  if (modelOverrideRaw !== void 0) {
    if (typeof modelOverrideRaw !== 'string') {
      return { status: 'error', error: 'invalid model: expected string' };
    }
    const resolvedOverride = resolveAllowedModelRef({
      cfg: cfgWithAgentDefaults,
      catalog: await loadCatalog(),
      raw: modelOverrideRaw,
      defaultProvider: resolvedDefault.provider,
      defaultModel: resolvedDefault.model
    });
    if ('error' in resolvedOverride) {
      return { status: 'error', error: resolvedOverride.error };
    }
    provider = resolvedOverride.ref.provider;
    model = resolvedOverride.ref.model;
  }
  const now = Date.now();
  const cronSession = resolveCronSession({
    cfg: params.cfg,
    sessionKey: agentSessionKey,
    agentId,
    nowMs: now
  });
  const hooksGmailThinking = isGmailHook ? normalizeThinkLevel(params.cfg.hooks?.gmail?.thinking) : void 0;
  const thinkOverride = normalizeThinkLevel(agentCfg?.thinkingDefault);
  const jobThink = normalizeThinkLevel(
    (params.job.payload.kind === 'agentTurn' ? params.job.payload.thinking : void 0) ?? void 0
  );
  let thinkLevel = jobThink ?? hooksGmailThinking ?? thinkOverride;
  if (!thinkLevel) {
    thinkLevel = resolveThinkingDefault({
      cfg: cfgWithAgentDefaults,
      provider,
      model,
      catalog: await loadCatalog()
    });
  }
  if (thinkLevel === 'xhigh' && !supportsXHighThinking(provider, model)) {
    logWarn(
      `[cron:${params.job.id}] Thinking level "xhigh" is not supported for ${provider}/${model}; downgrading to "high".`
    );
    thinkLevel = 'high';
  }
  const timeoutMs = resolveAgentTimeoutMs({
    cfg: cfgWithAgentDefaults,
    overrideSeconds: params.job.payload.kind === 'agentTurn' ? params.job.payload.timeoutSeconds : void 0
  });
  const agentPayload = params.job.payload.kind === 'agentTurn' ? params.job.payload : null;
  const deliveryPlan = resolveCronDeliveryPlan(params.job);
  const deliveryRequested = deliveryPlan.requested;
  const resolvedDelivery = await resolveDeliveryTarget(cfgWithAgentDefaults, agentId, {
    channel: deliveryPlan.channel ?? 'last',
    to: deliveryPlan.to
  });
  const userTimezone = resolveUserTimezone(params.cfg.agents?.defaults?.userTimezone);
  const userTimeFormat = resolveUserTimeFormat(params.cfg.agents?.defaults?.timeFormat);
  const formattedTime = formatUserTime(new Date(now), userTimezone, userTimeFormat) ?? new Date(now).toISOString();
  const timeLine = `Current time: ${formattedTime} (${userTimezone})`;
  const base = `[cron:${params.job.id} ${params.job.name}] ${params.message}`.trim();
  const isExternalHook = isExternalHookSession(baseSessionKey);
  const allowUnsafeExternalContent = agentPayload?.allowUnsafeExternalContent === true || isGmailHook && params.cfg.hooks?.gmail?.allowUnsafeExternalContent === true;
  const shouldWrapExternal = isExternalHook && !allowUnsafeExternalContent;
  let commandBody;
  if (isExternalHook) {
    const suspiciousPatterns = detectSuspiciousPatterns(params.message);
    if (suspiciousPatterns.length > 0) {
      logWarn(
        `[security] Suspicious patterns detected in external hook content (session=${baseSessionKey}, patterns=${suspiciousPatterns.length}): ${suspiciousPatterns.slice(0, 3).join(', ')}`
      );
    }
  }
  if (shouldWrapExternal) {
    const hookType = getHookType(baseSessionKey);
    const safeContent = buildSafeExternalPrompt({
      content: params.message,
      source: hookType,
      jobName: params.job.name,
      jobId: params.job.id,
      timestamp: formattedTime
    });
    commandBody = `${safeContent}

${timeLine}`.trim();
  } else {
    commandBody = `${base}
${timeLine}`.trim();
  }
  if (deliveryRequested) {
    commandBody = `${commandBody}

Return your summary as plain text; it will be delivered automatically. If the task explicitly calls for messaging a specific external recipient, note who/where it should go instead of sending it yourself.`.trim();
  }
  const existingSnapshot = cronSession.sessionEntry.skillsSnapshot;
  const skillsSnapshotVersion = getSkillsSnapshotVersion(workspaceDir);
  const needsSkillsSnapshot = !existingSnapshot || existingSnapshot.version !== skillsSnapshotVersion;
  const skillsSnapshot = needsSkillsSnapshot ? buildWorkspaceSkillSnapshot(workspaceDir, {
    config: cfgWithAgentDefaults,
    eligibility: { remote: getRemoteSkillEligibility() },
    snapshotVersion: skillsSnapshotVersion
  }) : cronSession.sessionEntry.skillsSnapshot;
  if (needsSkillsSnapshot && skillsSnapshot) {
    cronSession.sessionEntry = {
      ...cronSession.sessionEntry,
      updatedAt: Date.now(),
      skillsSnapshot
    };
    cronSession.store[agentSessionKey] = cronSession.sessionEntry;
    await updateSessionStore(cronSession.storePath, (store) => {
      store[agentSessionKey] = cronSession.sessionEntry;
    });
  }
  cronSession.sessionEntry.systemSent = true;
  cronSession.store[agentSessionKey] = cronSession.sessionEntry;
  await updateSessionStore(cronSession.storePath, (store) => {
    store[agentSessionKey] = cronSession.sessionEntry;
  });
  let runResult;
  let fallbackProvider = provider;
  let fallbackModel = model;
  try {
    const sessionFile = resolveSessionTranscriptPath(cronSession.sessionEntry.sessionId, agentId);
    const resolvedVerboseLevel = normalizeVerboseLevel(cronSession.sessionEntry.verboseLevel) ?? normalizeVerboseLevel(agentCfg?.verboseDefault) ?? 'off';
    registerAgentRunContext(cronSession.sessionEntry.sessionId, {
      sessionKey: agentSessionKey,
      verboseLevel: resolvedVerboseLevel
    });
    const messageChannel = resolvedDelivery.channel;
    const fallbackResult = await runWithModelFallback({
      cfg: cfgWithAgentDefaults,
      provider,
      model,
      agentDir,
      fallbacksOverride: resolveAgentModelFallbacksOverride(params.cfg, agentId),
      run: (providerOverride, modelOverride) => {
        if (isCliProvider(providerOverride, cfgWithAgentDefaults)) {
          const cliSessionId = getCliSessionId(cronSession.sessionEntry, providerOverride);
          return runCliAgent({
            sessionId: cronSession.sessionEntry.sessionId,
            sessionKey: agentSessionKey,
            sessionFile,
            workspaceDir,
            config: cfgWithAgentDefaults,
            prompt: commandBody,
            provider: providerOverride,
            model: modelOverride,
            thinkLevel,
            timeoutMs,
            runId: cronSession.sessionEntry.sessionId,
            cliSessionId
          });
        }
        return runEmbeddedPiAgent({
          sessionId: cronSession.sessionEntry.sessionId,
          sessionKey: agentSessionKey,
          messageChannel,
          agentAccountId: resolvedDelivery.accountId,
          sessionFile,
          workspaceDir,
          config: cfgWithAgentDefaults,
          skillsSnapshot,
          prompt: commandBody,
          lane: params.lane ?? 'cron',
          provider: providerOverride,
          model: modelOverride,
          thinkLevel,
          verboseLevel: resolvedVerboseLevel,
          timeoutMs,
          runId: cronSession.sessionEntry.sessionId,
          requireExplicitMessageTarget: true,
          disableMessageTool: deliveryRequested
        });
      }
    });
    runResult = fallbackResult.result;
    fallbackProvider = fallbackResult.provider;
    fallbackModel = fallbackResult.model;
  } catch (err) {
    return { status: 'error', error: String(err) };
  }
  const payloads = runResult.payloads ?? [];
  {
    const usage = runResult.meta.agentMeta?.usage;
    const modelUsed = runResult.meta.agentMeta?.model ?? fallbackModel ?? model;
    const providerUsed = runResult.meta.agentMeta?.provider ?? fallbackProvider ?? provider;
    const contextTokens = agentCfg?.contextTokens ?? lookupContextTokens(modelUsed) ?? DEFAULT_CONTEXT_TOKENS;
    cronSession.sessionEntry.modelProvider = providerUsed;
    cronSession.sessionEntry.model = modelUsed;
    cronSession.sessionEntry.contextTokens = contextTokens;
    if (isCliProvider(providerUsed, cfgWithAgentDefaults)) {
      const cliSessionId = runResult.meta.agentMeta?.sessionId?.trim();
      if (cliSessionId) {
        setCliSessionId(cronSession.sessionEntry, providerUsed, cliSessionId);
      }
    }
    if (hasNonzeroUsage(usage)) {
      const input = usage.input ?? 0;
      const output = usage.output ?? 0;
      const promptTokens = input + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
      cronSession.sessionEntry.inputTokens = input;
      cronSession.sessionEntry.outputTokens = output;
      cronSession.sessionEntry.totalTokens = promptTokens > 0 ? promptTokens : usage.total ?? input;
    }
    cronSession.store[agentSessionKey] = cronSession.sessionEntry;
    await updateSessionStore(cronSession.storePath, (store) => {
      store[agentSessionKey] = cronSession.sessionEntry;
    });
  }
  const firstText = payloads[0]?.text ?? '';
  const summary = pickSummaryFromPayloads(payloads) ?? pickSummaryFromOutput(firstText);
  const outputText = pickLastNonEmptyTextFromPayloads(payloads);
  const deliveryBestEffort = resolveCronDeliveryBestEffort(params.job);
  const ackMaxChars = resolveHeartbeatAckMaxChars(agentCfg);
  const skipHeartbeatDelivery = deliveryRequested && isHeartbeatOnlyResponse(payloads, ackMaxChars);
  const skipMessagingToolDelivery = deliveryRequested && runResult.didSendViaMessagingTool === true && (runResult.messagingToolSentTargets ?? []).some(
    (target) => matchesMessagingToolDeliveryTarget(target, {
      channel: resolvedDelivery.channel,
      to: resolvedDelivery.to,
      accountId: resolvedDelivery.accountId
    })
  );
  if (deliveryRequested && !skipHeartbeatDelivery && !skipMessagingToolDelivery) {
    if (resolvedDelivery.error) {
      if (!deliveryBestEffort) {
        return {
          status: 'error',
          error: resolvedDelivery.error.message,
          summary,
          outputText
        };
      }
      logWarn(`[cron:${params.job.id}] ${resolvedDelivery.error.message}`);
      return { status: 'ok', summary, outputText };
    }
    if (!resolvedDelivery.to) {
      const message = 'cron delivery target is missing';
      if (!deliveryBestEffort) {
        return {
          status: 'error',
          error: message,
          summary,
          outputText
        };
      }
      logWarn(`[cron:${params.job.id}] ${message}`);
      return { status: 'ok', summary, outputText };
    }
    try {
      await deliverOutboundPayloads({
        cfg: cfgWithAgentDefaults,
        channel: resolvedDelivery.channel,
        to: resolvedDelivery.to,
        accountId: resolvedDelivery.accountId,
        threadId: resolvedDelivery.threadId,
        payloads,
        bestEffort: deliveryBestEffort,
        deps: createOutboundSendDeps(params.deps)
      });
    } catch (err) {
      if (!deliveryBestEffort) {
        return { status: 'error', summary, outputText, error: String(err) };
      }
    }
  }
  return { status: 'ok', summary, outputText };
}
export {
  runCronIsolatedAgentTurn
};
