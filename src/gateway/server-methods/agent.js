/** @module gateway/server-methods/agent -- Agent RPC method handler (start, stop, message, status). */
import { randomUUID } from 'node:crypto';
import { listAgentIds } from '../../agents/agent-scope.js';
import { agentCommand } from '../../commands/agent.js';
import { loadConfig } from '../../config/config.js';
import {
  resolveAgentIdFromSessionKey,
  resolveExplicitAgentSessionKey,
  resolveAgentMainSessionKey,
  updateSessionStore
} from '../../config/sessions.js';
import { registerAgentRunContext } from '../../infra/agent-events.js';
import {
  resolveAgentDeliveryPlan,
  resolveAgentOutboundTarget
} from '../../infra/outbound/agent-delivery.js';
import { normalizeAgentId } from '../../routing/session-key.js';
import { defaultRuntime } from '../../runtime.js';
import { resolveSendPolicy } from '../../sessions/send-policy.js';
import { normalizeSessionDeliveryFields } from '../../utils/delivery-context.js';
import {
  INTERNAL_MESSAGE_CHANNEL,
  isDeliverableMessageChannel,
  isGatewayMessageChannel,
  normalizeMessageChannel
} from '../../utils/message-channel.js';
import { resolveAssistantIdentity } from '../assistant-identity.js';
import { parseMessageWithAttachments } from '../chat-attachments.js';
import { resolveAssistantAvatarUrl } from '../control-ui-shared.js';
import { GATEWAY_CLIENT_CAPS, hasGatewayClientCap } from '../protocol/client-info.js';
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateAgentIdentityParams,
  validateAgentParams,
  validateAgentWaitParams
} from '../protocol/index.js';
import { loadSessionEntry } from '../session-utils.js';
import { formatForLog } from '../ws-log.js';
import { waitForAgentJob } from './agent-job.js';
import { injectTimestamp, timestampOptsFromConfig } from './agent-timestamp.js';
const agentHandlers = {
  agent: async ({ params, respond, context, client }) => {
    const p = params;
    if (!validateAgentParams(p)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agent params: ${formatValidationErrors(validateAgentParams.errors)}`
        )
      );
      return;
    }
    const request = p;
    const cfg = loadConfig();
    const idem = request.idempotencyKey;
    const groupIdRaw = typeof request.groupId === 'string' ? request.groupId.trim() : '';
    const groupChannelRaw = typeof request.groupChannel === 'string' ? request.groupChannel.trim() : '';
    const groupSpaceRaw = typeof request.groupSpace === 'string' ? request.groupSpace.trim() : '';
    let resolvedGroupId = groupIdRaw || void 0;
    let resolvedGroupChannel = groupChannelRaw || void 0;
    let resolvedGroupSpace = groupSpaceRaw || void 0;
    let spawnedByValue = typeof request.spawnedBy === 'string' ? request.spawnedBy.trim() : void 0;
    const cached = context.dedupe.get(`agent:${idem}`);
    if (cached) {
      respond(cached.ok, cached.payload, cached.error, {
        cached: true
      });
      return;
    }
    const normalizedAttachments = request.attachments?.map((a) => ({
      type: typeof a?.type === 'string' ? a.type : void 0,
      mimeType: typeof a?.mimeType === 'string' ? a.mimeType : void 0,
      fileName: typeof a?.fileName === 'string' ? a.fileName : void 0,
      content: typeof a?.content === 'string' ? a.content : ArrayBuffer.isView(a?.content) ? Buffer.from(
        a.content.buffer,
        a.content.byteOffset,
        a.content.byteLength
      ).toString('base64') : void 0
    })).filter((a) => a.content) ?? [];
    let message = request.message.trim();
    let images = [];
    if (normalizedAttachments.length > 0) {
      try {
        const parsed = await parseMessageWithAttachments(message, normalizedAttachments, {
          maxBytes: 5e6,
          log: context.logGateway
        });
        message = parsed.message.trim();
        images = parsed.images;
      } catch (err) {
        respond(false, void 0, errorShape(ErrorCodes.INVALID_REQUEST, String(err)));
        return;
      }
    }
    message = injectTimestamp(message, timestampOptsFromConfig(cfg));
    const isKnownGatewayChannel = (value) => isGatewayMessageChannel(value);
    const channelHints = [request.channel, request.replyChannel].filter((value) => typeof value === 'string').map((value) => value.trim()).filter(Boolean);
    for (const rawChannel of channelHints) {
      const normalized = normalizeMessageChannel(rawChannel);
      if (normalized && normalized !== 'last' && !isKnownGatewayChannel(normalized)) {
        respond(
          false,
          void 0,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `invalid agent params: unknown channel: ${String(normalized)}`
          )
        );
        return;
      }
    }
    const agentIdRaw = typeof request.agentId === 'string' ? request.agentId.trim() : '';
    const agentId = agentIdRaw ? normalizeAgentId(agentIdRaw) : void 0;
    if (agentId) {
      const knownAgents = listAgentIds(cfg);
      if (!knownAgents.includes(agentId)) {
        respond(
          false,
          void 0,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `invalid agent params: unknown agent id "${request.agentId}"`
          )
        );
        return;
      }
    }
    const requestedSessionKeyRaw = typeof request.sessionKey === 'string' && request.sessionKey.trim() ? request.sessionKey.trim() : void 0;
    const requestedSessionKey = requestedSessionKeyRaw ?? resolveExplicitAgentSessionKey({
      cfg,
      agentId
    });
    if (agentId && requestedSessionKeyRaw) {
      const sessionAgentId = resolveAgentIdFromSessionKey(requestedSessionKeyRaw);
      if (sessionAgentId !== agentId) {
        respond(
          false,
          void 0,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `invalid agent params: agent "${request.agentId}" does not match session key agent "${sessionAgentId}"`
          )
        );
        return;
      }
    }
    let resolvedSessionId = request.sessionId?.trim() || void 0;
    let sessionEntry;
    let bestEffortDeliver = false;
    let cfgForAgent;
    if (requestedSessionKey) {
      const { cfg: cfg2, storePath, entry, canonicalKey } = loadSessionEntry(requestedSessionKey);
      cfgForAgent = cfg2;
      const now = Date.now();
      const sessionId = entry?.sessionId ?? randomUUID();
      const labelValue = request.label?.trim() || entry?.label;
      spawnedByValue = spawnedByValue || entry?.spawnedBy;
      let inheritedGroup;
      if (spawnedByValue && (!resolvedGroupId || !resolvedGroupChannel || !resolvedGroupSpace)) {
        try {
          const parentEntry = loadSessionEntry(spawnedByValue)?.entry;
          inheritedGroup = {
            groupId: parentEntry?.groupId,
            groupChannel: parentEntry?.groupChannel,
            groupSpace: parentEntry?.space
          };
        } catch {
          inheritedGroup = void 0;
        }
      }
      resolvedGroupId = resolvedGroupId || inheritedGroup?.groupId;
      resolvedGroupChannel = resolvedGroupChannel || inheritedGroup?.groupChannel;
      resolvedGroupSpace = resolvedGroupSpace || inheritedGroup?.groupSpace;
      const deliveryFields = normalizeSessionDeliveryFields(entry);
      const nextEntry = {
        sessionId,
        updatedAt: now,
        thinkingLevel: entry?.thinkingLevel,
        verboseLevel: entry?.verboseLevel,
        reasoningLevel: entry?.reasoningLevel,
        systemSent: entry?.systemSent,
        sendPolicy: entry?.sendPolicy,
        skillsSnapshot: entry?.skillsSnapshot,
        deliveryContext: deliveryFields.deliveryContext,
        lastChannel: deliveryFields.lastChannel ?? entry?.lastChannel,
        lastTo: deliveryFields.lastTo ?? entry?.lastTo,
        lastAccountId: deliveryFields.lastAccountId ?? entry?.lastAccountId,
        modelOverride: entry?.modelOverride,
        providerOverride: entry?.providerOverride,
        label: labelValue,
        spawnedBy: spawnedByValue,
        channel: entry?.channel ?? request.channel?.trim(),
        groupId: resolvedGroupId ?? entry?.groupId,
        groupChannel: resolvedGroupChannel ?? entry?.groupChannel,
        space: resolvedGroupSpace ?? entry?.space,
        cliSessionIds: entry?.cliSessionIds,
        claudeCliSessionId: entry?.claudeCliSessionId
      };
      sessionEntry = nextEntry;
      const sendPolicy = resolveSendPolicy({
        cfg: cfg2,
        entry,
        sessionKey: requestedSessionKey,
        channel: entry?.channel,
        chatType: entry?.chatType
      });
      if (sendPolicy === 'deny') {
        respond(
          false,
          void 0,
          errorShape(ErrorCodes.INVALID_REQUEST, 'send blocked by session policy')
        );
        return;
      }
      resolvedSessionId = sessionId;
      const canonicalSessionKey = canonicalKey;
      const agentId2 = resolveAgentIdFromSessionKey(canonicalSessionKey);
      const mainSessionKey = resolveAgentMainSessionKey({ cfg: cfg2, agentId: agentId2 });
      if (storePath) {
        await updateSessionStore(storePath, (store) => {
          store[canonicalSessionKey] = nextEntry;
        });
      }
      if (canonicalSessionKey === mainSessionKey || canonicalSessionKey === 'global') {
        context.addChatRun(idem, {
          sessionKey: requestedSessionKey,
          clientRunId: idem
        });
        bestEffortDeliver = true;
      }
      registerAgentRunContext(idem, { sessionKey: requestedSessionKey });
    }
    const runId = idem;
    const connId = typeof client?.connId === 'string' ? client.connId : void 0;
    const wantsToolEvents = hasGatewayClientCap(
      client?.connect?.caps,
      GATEWAY_CLIENT_CAPS.TOOL_EVENTS
    );
    if (connId && wantsToolEvents) {
      context.registerToolEventRecipient(runId, connId);
    }
    const wantsDelivery = request.deliver === true;
    const explicitTo = typeof request.replyTo === 'string' && request.replyTo.trim() ? request.replyTo.trim() : typeof request.to === 'string' && request.to.trim() ? request.to.trim() : void 0;
    const explicitThreadId = typeof request.threadId === 'string' && request.threadId.trim() ? request.threadId.trim() : void 0;
    const deliveryPlan = resolveAgentDeliveryPlan({
      sessionEntry,
      requestedChannel: request.replyChannel ?? request.channel,
      explicitTo,
      explicitThreadId,
      accountId: request.replyAccountId ?? request.accountId,
      wantsDelivery
    });
    const resolvedChannel = deliveryPlan.resolvedChannel;
    const deliveryTargetMode = deliveryPlan.deliveryTargetMode;
    const resolvedAccountId = deliveryPlan.resolvedAccountId;
    let resolvedTo = deliveryPlan.resolvedTo;
    if (!resolvedTo && isDeliverableMessageChannel(resolvedChannel)) {
      const cfgResolved = cfgForAgent ?? cfg;
      const fallback = resolveAgentOutboundTarget({
        cfg: cfgResolved,
        plan: deliveryPlan,
        targetMode: 'implicit',
        validateExplicitTarget: false
      });
      if (fallback.resolvedTarget?.ok) {
        resolvedTo = fallback.resolvedTo;
      }
    }
    const deliver = request.deliver === true && resolvedChannel !== INTERNAL_MESSAGE_CHANNEL;
    const accepted = {
      runId,
      status: 'accepted',
      acceptedAt: Date.now()
    };
    context.dedupe.set(`agent:${idem}`, {
      ts: Date.now(),
      ok: true,
      payload: accepted
    });
    respond(true, accepted, void 0, { runId });
    const resolvedThreadId = explicitThreadId ?? deliveryPlan.resolvedThreadId;
    void agentCommand(
      {
        message,
        images,
        to: resolvedTo,
        sessionId: resolvedSessionId,
        sessionKey: requestedSessionKey,
        thinking: request.thinking,
        deliver,
        deliveryTargetMode,
        channel: resolvedChannel,
        accountId: resolvedAccountId,
        threadId: resolvedThreadId,
        runContext: {
          messageChannel: resolvedChannel,
          accountId: resolvedAccountId,
          groupId: resolvedGroupId,
          groupChannel: resolvedGroupChannel,
          groupSpace: resolvedGroupSpace,
          currentThreadTs: resolvedThreadId !== null && resolvedThreadId !== undefined ? String(resolvedThreadId) : void 0
        },
        groupId: resolvedGroupId,
        groupChannel: resolvedGroupChannel,
        groupSpace: resolvedGroupSpace,
        spawnedBy: spawnedByValue,
        timeout: request.timeout?.toString(),
        bestEffortDeliver,
        messageChannel: resolvedChannel,
        runId,
        lane: request.lane,
        extraSystemPrompt: request.extraSystemPrompt
      },
      defaultRuntime,
      context.deps
    ).then((result) => {
      const payload = {
        runId,
        status: 'ok',
        summary: 'completed',
        result
      };
      context.dedupe.set(`agent:${idem}`, {
        ts: Date.now(),
        ok: true,
        payload
      });
      respond(true, payload, void 0, { runId });
    }).catch((err) => {
      const error = errorShape(ErrorCodes.UNAVAILABLE, String(err));
      const payload = {
        runId,
        status: 'error',
        summary: String(err)
      };
      context.dedupe.set(`agent:${idem}`, {
        ts: Date.now(),
        ok: false,
        payload,
        error
      });
      respond(false, payload, error, {
        runId,
        error: formatForLog(err)
      });
    });
  },
  'agent.identity.get': ({ params, respond }) => {
    if (!validateAgentIdentityParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agent.identity.get params: ${formatValidationErrors(
            validateAgentIdentityParams.errors
          )}`
        )
      );
      return;
    }
    const p = params;
    const agentIdRaw = typeof p.agentId === 'string' ? p.agentId.trim() : '';
    const sessionKeyRaw = typeof p.sessionKey === 'string' ? p.sessionKey.trim() : '';
    let agentId = agentIdRaw ? normalizeAgentId(agentIdRaw) : void 0;
    if (sessionKeyRaw) {
      const resolved = resolveAgentIdFromSessionKey(sessionKeyRaw);
      if (agentId && resolved !== agentId) {
        respond(
          false,
          void 0,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `invalid agent.identity.get params: agent "${agentIdRaw}" does not match session key agent "${resolved}"`
          )
        );
        return;
      }
      agentId = resolved;
    }
    const cfg = loadConfig();
    const identity = resolveAssistantIdentity({ cfg, agentId });
    const avatarValue = resolveAssistantAvatarUrl({
      avatar: identity.avatar,
      agentId: identity.agentId,
      basePath: cfg.gateway?.controlUi?.basePath
    }) ?? identity.avatar;
    respond(true, { ...identity, avatar: avatarValue }, void 0);
  },
  'agent.wait': async ({ params, respond }) => {
    if (!validateAgentWaitParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agent.wait params: ${formatValidationErrors(validateAgentWaitParams.errors)}`
        )
      );
      return;
    }
    const p = params;
    const runId = p.runId.trim();
    const timeoutMs = typeof p.timeoutMs === 'number' && Number.isFinite(p.timeoutMs) ? Math.max(0, Math.floor(p.timeoutMs)) : 3e4;
    const snapshot = await waitForAgentJob({
      runId,
      timeoutMs
    });
    if (!snapshot) {
      respond(true, {
        runId,
        status: 'timeout'
      });
      return;
    }
    respond(true, {
      runId,
      status: snapshot.status,
      startedAt: snapshot.startedAt,
      endedAt: snapshot.endedAt,
      error: snapshot.error
    });
  }
};
export {
  agentHandlers
};
