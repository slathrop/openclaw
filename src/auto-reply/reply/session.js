/* eslint-disable no-undef */
import { CURRENT_SESSION_VERSION, SessionManager } from '@mariozechner/pi-coding-agent';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveSessionAgentId } from '../../agents/agent-scope.js';
import { normalizeChatType } from '../../channels/chat-type.js';
import {

  // SECURITY: This module handles security-sensitive operations.
  // Changes should be reviewed carefully for security implications.

  DEFAULT_RESET_TRIGGERS,
  deriveSessionMetaPatch,
  evaluateSessionFreshness,
  loadSessionStore,
  resolveChannelResetConfig,
  resolveThreadFlag,
  resolveSessionResetPolicy,
  resolveSessionResetType,
  resolveGroupSessionKey,
  resolveSessionFilePath,
  resolveSessionKey,
  resolveSessionTranscriptPath,
  resolveStorePath,
  updateSessionStore
} from '../../config/sessions.js';
import { normalizeMainKey } from '../../routing/session-key.js';
import { normalizeSessionDeliveryFields } from '../../utils/delivery-context.js';
import { resolveCommandAuthorization } from '../command-auth.js';
import { formatInboundBodyWithSenderMeta } from './inbound-sender-meta.js';
import { normalizeInboundTextNewlines } from './inbound-text.js';
import { stripMentions, stripStructuralPrefixes } from './mentions.js';
function forkSessionFromParent(params) {
  const parentSessionFile = resolveSessionFilePath(
    params.parentEntry.sessionId,
    params.parentEntry
  );
  if (!parentSessionFile || !fs.existsSync(parentSessionFile)) {
    return null;
  }
  try {
    const manager = SessionManager.open(parentSessionFile);
    const leafId = manager.getLeafId();
    if (leafId) {
      const sessionFile2 = manager.createBranchedSession(leafId) ?? manager.getSessionFile();
      const sessionId2 = manager.getSessionId();
      if (sessionFile2 && sessionId2) {
        return { sessionId: sessionId2, sessionFile: sessionFile2 };
      }
    }
    const sessionId = crypto.randomUUID();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const fileTimestamp = timestamp.replace(/[:.]/g, '-');
    const sessionFile = path.join(manager.getSessionDir(), `${fileTimestamp}_${sessionId}.jsonl`);
    const header = {
      type: 'session',
      version: CURRENT_SESSION_VERSION,
      id: sessionId,
      timestamp,
      cwd: manager.getCwd(),
      parentSession: parentSessionFile
    };
    fs.writeFileSync(sessionFile, `${JSON.stringify(header)}
`, 'utf-8');
    return { sessionId, sessionFile };
  } catch {
    return null;
  }
}
async function initSessionState(params) {
  const { ctx, cfg, commandAuthorized } = params;
  const targetSessionKey = ctx.CommandSource === 'native' ? ctx.CommandTargetSessionKey?.trim() : void 0;
  const sessionCtxForState = targetSessionKey && targetSessionKey !== ctx.SessionKey ? { ...ctx, SessionKey: targetSessionKey } : ctx;
  const sessionCfg = cfg.session;
  const mainKey = normalizeMainKey(sessionCfg?.mainKey);
  const agentId = resolveSessionAgentId({
    sessionKey: sessionCtxForState.SessionKey,
    config: cfg
  });
  const groupResolution = resolveGroupSessionKey(sessionCtxForState) ?? void 0;
  const resetTriggers = sessionCfg?.resetTriggers?.length ? sessionCfg.resetTriggers : DEFAULT_RESET_TRIGGERS;
  const sessionScope = sessionCfg?.scope ?? 'per-sender';
  const storePath = resolveStorePath(sessionCfg?.store, { agentId });
  const sessionStore = loadSessionStore(storePath);
   
  let sessionEntry;
  let sessionId;
  let isNewSession = false;
  let bodyStripped;
  let systemSent = false;
  let abortedLastRun = false;
  let resetTriggered = false;
  let persistedThinking;
  let persistedVerbose;
  let persistedReasoning;
  let persistedTtsAuto;
  let persistedModelOverride;
  let persistedProviderOverride;
  const normalizedChatType = normalizeChatType(ctx.ChatType);
  const isGroup = normalizedChatType !== null && e !== undefined && normalizedChatType !== 'direct' ? true : Boolean(groupResolution);
  const commandSource = ctx.BodyForCommands ?? ctx.CommandBody ?? ctx.RawBody ?? ctx.Body ?? '';
  const triggerBodyNormalized = stripStructuralPrefixes(commandSource).trim();
  const rawBody = commandSource;
  const trimmedBody = rawBody.trim();
  const resetAuthorized = resolveCommandAuthorization({
    ctx,
    cfg,
    commandAuthorized
  }).isAuthorizedSender;
  const strippedForReset = isGroup ? stripMentions(triggerBodyNormalized, ctx, cfg, agentId) : triggerBodyNormalized;
  const trimmedBodyLower = trimmedBody.toLowerCase();
  const strippedForResetLower = strippedForReset.toLowerCase();
  for (const trigger of resetTriggers) {
    if (!trigger) {
      continue;
    }
    if (!resetAuthorized) {
      break;
    }
    const triggerLower = trigger.toLowerCase();
    if (trimmedBodyLower === triggerLower || strippedForResetLower === triggerLower) {
      isNewSession = true;
      bodyStripped = '';
      resetTriggered = true;
      break;
    }
    const triggerPrefixLower = `${triggerLower} `;
    if (trimmedBodyLower.startsWith(triggerPrefixLower) || strippedForResetLower.startsWith(triggerPrefixLower)) {
      isNewSession = true;
      bodyStripped = strippedForReset.slice(trigger.length).trimStart();
      resetTriggered = true;
      break;
    }
  }
  const sessionKey = resolveSessionKey(sessionScope, sessionCtxForState, mainKey);
  const entry = sessionStore[sessionKey];
  const previousSessionEntry = resetTriggered && entry ? { ...entry } : void 0;
  const now = Date.now();
  const isThread = resolveThreadFlag({
    sessionKey,
    messageThreadId: ctx.MessageThreadId,
    threadLabel: ctx.ThreadLabel,
    threadStarterBody: ctx.ThreadStarterBody,
    parentSessionKey: ctx.ParentSessionKey
  });
  const resetType = resolveSessionResetType({ sessionKey, isGroup, isThread });
  const channelReset = resolveChannelResetConfig({
    sessionCfg,
    channel: groupResolution?.channel ?? ctx.OriginatingChannel ?? ctx.Surface ?? ctx.Provider
  });
  const resetPolicy = resolveSessionResetPolicy({
    sessionCfg,
    resetType,
    resetOverride: channelReset
  });
  const freshEntry = entry ? evaluateSessionFreshness({ updatedAt: entry.updatedAt, now, policy: resetPolicy }).fresh : false;
  if (!isNewSession && freshEntry) {
    sessionId = entry.sessionId;
    systemSent = entry.systemSent ?? false;
    abortedLastRun = entry.abortedLastRun ?? false;
    persistedThinking = entry.thinkingLevel;
    persistedVerbose = entry.verboseLevel;
    persistedReasoning = entry.reasoningLevel;
    persistedTtsAuto = entry.ttsAuto;
    persistedModelOverride = entry.modelOverride;
    persistedProviderOverride = entry.providerOverride;
  } else {
    sessionId = crypto.randomUUID();
    isNewSession = true;
    systemSent = false;
    abortedLastRun = false;
  }
  const baseEntry = !isNewSession && freshEntry ? entry : void 0;
  const lastChannelRaw = ctx.OriginatingChannel || baseEntry?.lastChannel;
  const lastToRaw = ctx.OriginatingTo || ctx.To || baseEntry?.lastTo;
  const lastAccountIdRaw = ctx.AccountId || baseEntry?.lastAccountId;
  const lastThreadIdRaw = ctx.MessageThreadId || baseEntry?.lastThreadId;
  const deliveryFields = normalizeSessionDeliveryFields({
    deliveryContext: {
      channel: lastChannelRaw,
      to: lastToRaw,
      accountId: lastAccountIdRaw,
      threadId: lastThreadIdRaw
    }
  });
  const lastChannel = deliveryFields.lastChannel ?? lastChannelRaw;
  const lastTo = deliveryFields.lastTo ?? lastToRaw;
  const lastAccountId = deliveryFields.lastAccountId ?? lastAccountIdRaw;
  const lastThreadId = deliveryFields.lastThreadId ?? lastThreadIdRaw;
  sessionEntry = {
    ...baseEntry,
    sessionId,
    updatedAt: Date.now(),
    systemSent,
    abortedLastRun,
    // Persist previously stored thinking/verbose levels when present.
    thinkingLevel: persistedThinking ?? baseEntry?.thinkingLevel,
    verboseLevel: persistedVerbose ?? baseEntry?.verboseLevel,
    reasoningLevel: persistedReasoning ?? baseEntry?.reasoningLevel,
    ttsAuto: persistedTtsAuto ?? baseEntry?.ttsAuto,
    responseUsage: baseEntry?.responseUsage,
    modelOverride: persistedModelOverride ?? baseEntry?.modelOverride,
    providerOverride: persistedProviderOverride ?? baseEntry?.providerOverride,
    sendPolicy: baseEntry?.sendPolicy,
    queueMode: baseEntry?.queueMode,
    queueDebounceMs: baseEntry?.queueDebounceMs,
    queueCap: baseEntry?.queueCap,
    queueDrop: baseEntry?.queueDrop,
    displayName: baseEntry?.displayName,
    chatType: baseEntry?.chatType,
    channel: baseEntry?.channel,
    groupId: baseEntry?.groupId,
    subject: baseEntry?.subject,
    groupChannel: baseEntry?.groupChannel,
    space: baseEntry?.space,
    deliveryContext: deliveryFields.deliveryContext,
    // Track originating channel for subagent announce routing.
    lastChannel,
    lastTo,
    lastAccountId,
    lastThreadId
  };
  const metaPatch = deriveSessionMetaPatch({
    ctx: sessionCtxForState,
    sessionKey,
    existing: sessionEntry,
    groupResolution
  });
  if (metaPatch) {
    sessionEntry = { ...sessionEntry, ...metaPatch };
  }
  if (!sessionEntry.chatType) {
    sessionEntry.chatType = 'direct';
  }
  const threadLabel = ctx.ThreadLabel?.trim();
  if (threadLabel) {
    sessionEntry.displayName = threadLabel;
  }
  const parentSessionKey = ctx.ParentSessionKey?.trim();
  if (isNewSession && parentSessionKey && parentSessionKey !== sessionKey && sessionStore[parentSessionKey]) {
    const forked = forkSessionFromParent({
      parentEntry: sessionStore[parentSessionKey]
    });
    if (forked) {
      sessionId = forked.sessionId;
      sessionEntry.sessionId = forked.sessionId;
      sessionEntry.sessionFile = forked.sessionFile;
    }
  }
  if (!sessionEntry.sessionFile) {
    sessionEntry.sessionFile = resolveSessionTranscriptPath(
      sessionEntry.sessionId,
      agentId,
      ctx.MessageThreadId
    );
  }
  if (isNewSession) {
    sessionEntry.compactionCount = 0;
    sessionEntry.memoryFlushCompactionCount = void 0;
    sessionEntry.memoryFlushAt = void 0;
  }
  sessionStore[sessionKey] = { ...sessionStore[sessionKey], ...sessionEntry };
  await updateSessionStore(storePath, (store) => {
    store[sessionKey] = { ...store[sessionKey], ...sessionEntry };
  });
  const sessionCtx = {
    ...ctx,
    // Keep BodyStripped aligned with Body (best default for agent prompts).
    // RawBody is reserved for command/directive parsing and may omit context.
    BodyStripped: formatInboundBodyWithSenderMeta({
      ctx,
      body: normalizeInboundTextNewlines(
        bodyStripped ?? ctx.BodyForAgent ?? ctx.Body ?? ctx.CommandBody ?? ctx.RawBody ?? ctx.BodyForCommands ?? ''
      )
    }),
    SessionId: sessionId,
    IsNewSession: isNewSession ? 'true' : 'false'
  };
  return {
    sessionCtx,
    sessionEntry,
    previousSessionEntry,
    sessionStore,
    sessionKey,
    sessionId: sessionId ?? crypto.randomUUID(),
    isNewSession,
    resetTriggered,
    systemSent,
    abortedLastRun,
    storePath,
    sessionScope,
    groupResolution,
    isGroup,
    bodyStripped,
    triggerBodyNormalized
  };
}
export {
  initSessionState
};
