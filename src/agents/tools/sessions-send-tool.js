/**
 * Session send tool for dispatching messages to sessions.
 * @module agents/tools/sessions-send-tool
 */
import { Type } from '@sinclair/typebox';
import crypto from 'node:crypto';
import { loadConfig } from '../../config/config.js';
import { callGateway } from '../../gateway/call.js';
import {
  isSubagentSessionKey,
  normalizeAgentId,
  resolveAgentIdFromSessionKey
} from '../../routing/session-key.js';
import { SESSION_LABEL_MAX_LENGTH } from '../../sessions/session-label.js';
import {
  INTERNAL_MESSAGE_CHANNEL
} from '../../utils/message-channel.js';
import { AGENT_LANE_NESTED } from '../lanes.js';
import { jsonResult, readStringParam } from './common.js';
import {
  createAgentToAgentPolicy,
  extractAssistantText,
  resolveInternalSessionKey,
  resolveMainSessionAlias,
  resolveSessionReference,
  stripToolMessages
} from './sessions-helpers.js';
import { buildAgentToAgentMessageContext, resolvePingPongTurns } from './sessions-send-helpers.js';
import { runSessionsSendA2AFlow } from './sessions-send-tool.a2a.js';
const SessionsSendToolSchema = Type.Object({
  sessionKey: Type.Optional(Type.String()),
  label: Type.Optional(Type.String({ minLength: 1, maxLength: SESSION_LABEL_MAX_LENGTH })),
  agentId: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  message: Type.String(),
  timeoutSeconds: Type.Optional(Type.Number({ minimum: 0 }))
});
function createSessionsSendTool(opts) {
  return {
    label: 'Session Send',
    name: 'sessions_send',
    description: 'Send a message into another session. Use sessionKey or label to identify the target.',
    parameters: SessionsSendToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args;
      const message = readStringParam(params, 'message', { required: true });
      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const visibility = cfg.agents?.defaults?.sandbox?.sessionToolsVisibility ?? 'spawned';
      const requesterInternalKey = typeof opts?.agentSessionKey === 'string' && opts.agentSessionKey.trim() ? resolveInternalSessionKey({
        key: opts.agentSessionKey,
        alias,
        mainKey
      }) : void 0;
      const restrictToSpawned = opts?.sandboxed === true && visibility === 'spawned' && !!requesterInternalKey && !isSubagentSessionKey(requesterInternalKey);
      const a2aPolicy = createAgentToAgentPolicy(cfg);
      const sessionKeyParam = readStringParam(params, 'sessionKey');
      const labelParam = readStringParam(params, 'label')?.trim() || void 0;
      const labelAgentIdParam = readStringParam(params, 'agentId')?.trim() || void 0;
      if (sessionKeyParam && labelParam) {
        return jsonResult({
          runId: crypto.randomUUID(),
          status: 'error',
          error: 'Provide either sessionKey or label (not both).'
        });
      }
      const listSessions = async (listParams) => {
        const result = await callGateway({
          method: 'sessions.list',
          params: listParams,
          timeoutMs: 1e4
        });
        return Array.isArray(result?.sessions) ? result.sessions : [];
      };
      let sessionKey = sessionKeyParam;
      if (!sessionKey && labelParam) {
        const requesterAgentId2 = requesterInternalKey ? resolveAgentIdFromSessionKey(requesterInternalKey) : void 0;
        const requestedAgentId = labelAgentIdParam ? normalizeAgentId(labelAgentIdParam) : void 0;
        if (restrictToSpawned && requestedAgentId && requesterAgentId2 && requestedAgentId !== requesterAgentId2) {
          return jsonResult({
            runId: crypto.randomUUID(),
            status: 'forbidden',
            error: 'Sandboxed sessions_send label lookup is limited to this agent'
          });
        }
        if (requesterAgentId2 && requestedAgentId && requestedAgentId !== requesterAgentId2) {
          if (!a2aPolicy.enabled) {
            return jsonResult({
              runId: crypto.randomUUID(),
              status: 'forbidden',
              error: 'Agent-to-agent messaging is disabled. Set tools.agentToAgent.enabled=true to allow cross-agent sends.'
            });
          }
          if (!a2aPolicy.isAllowed(requesterAgentId2, requestedAgentId)) {
            return jsonResult({
              runId: crypto.randomUUID(),
              status: 'forbidden',
              error: 'Agent-to-agent messaging denied by tools.agentToAgent.allow.'
            });
          }
        }
        const resolveParams = {
          label: labelParam,
          ...requestedAgentId ? { agentId: requestedAgentId } : {},
          ...restrictToSpawned ? { spawnedBy: requesterInternalKey } : {}
        };
        let resolvedKey2 = '';
        try {
          const resolved = await callGateway({
            method: 'sessions.resolve',
            params: resolveParams,
            timeoutMs: 1e4
          });
          resolvedKey2 = typeof resolved?.key === 'string' ? resolved.key.trim() : '';
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (restrictToSpawned) {
            return jsonResult({
              runId: crypto.randomUUID(),
              status: 'forbidden',
              error: 'Session not visible from this sandboxed agent session.'
            });
          }
          return jsonResult({
            runId: crypto.randomUUID(),
            status: 'error',
            error: msg || `No session found with label: ${labelParam}`
          });
        }
        if (!resolvedKey2) {
          if (restrictToSpawned) {
            return jsonResult({
              runId: crypto.randomUUID(),
              status: 'forbidden',
              error: 'Session not visible from this sandboxed agent session.'
            });
          }
          return jsonResult({
            runId: crypto.randomUUID(),
            status: 'error',
            error: `No session found with label: ${labelParam}`
          });
        }
        sessionKey = resolvedKey2;
      }
      if (!sessionKey) {
        return jsonResult({
          runId: crypto.randomUUID(),
          status: 'error',
          error: 'Either sessionKey or label is required'
        });
      }
      const resolvedSession = await resolveSessionReference({
        sessionKey,
        alias,
        mainKey,
        requesterInternalKey,
        restrictToSpawned
      });
      if (!resolvedSession.ok) {
        return jsonResult({
          runId: crypto.randomUUID(),
          status: resolvedSession.status,
          error: resolvedSession.error
        });
      }
      const resolvedKey = resolvedSession.key;
      const displayKey = resolvedSession.displayKey;
      const resolvedViaSessionId = resolvedSession.resolvedViaSessionId;
      if (restrictToSpawned && !resolvedViaSessionId) {
        const sessions = await listSessions({
          includeGlobal: false,
          includeUnknown: false,
          limit: 500,
          spawnedBy: requesterInternalKey
        });
        const ok = sessions.some((entry) => entry?.key === resolvedKey);
        if (!ok) {
          return jsonResult({
            runId: crypto.randomUUID(),
            status: 'forbidden',
            error: `Session not visible from this sandboxed agent session: ${sessionKey}`,
            sessionKey: displayKey
          });
        }
      }
      const timeoutSeconds = typeof params.timeoutSeconds === 'number' && Number.isFinite(params.timeoutSeconds) ? Math.max(0, Math.floor(params.timeoutSeconds)) : 30;
      const timeoutMs = timeoutSeconds * 1e3;
      const announceTimeoutMs = timeoutSeconds === 0 ? 3e4 : timeoutMs;
      const idempotencyKey = crypto.randomUUID();
      let runId = idempotencyKey;
      const requesterAgentId = resolveAgentIdFromSessionKey(requesterInternalKey);
      const targetAgentId = resolveAgentIdFromSessionKey(resolvedKey);
      const isCrossAgent = requesterAgentId !== targetAgentId;
      if (isCrossAgent) {
        if (!a2aPolicy.enabled) {
          return jsonResult({
            runId: crypto.randomUUID(),
            status: 'forbidden',
            error: 'Agent-to-agent messaging is disabled. Set tools.agentToAgent.enabled=true to allow cross-agent sends.',
            sessionKey: displayKey
          });
        }
        if (!a2aPolicy.isAllowed(requesterAgentId, targetAgentId)) {
          return jsonResult({
            runId: crypto.randomUUID(),
            status: 'forbidden',
            error: 'Agent-to-agent messaging denied by tools.agentToAgent.allow.',
            sessionKey: displayKey
          });
        }
      }
      const agentMessageContext = buildAgentToAgentMessageContext({
        requesterSessionKey: opts?.agentSessionKey,
        requesterChannel: opts?.agentChannel,
        targetSessionKey: displayKey
      });
      const sendParams = {
        message,
        sessionKey: resolvedKey,
        idempotencyKey,
        deliver: false,
        channel: INTERNAL_MESSAGE_CHANNEL,
        lane: AGENT_LANE_NESTED,
        extraSystemPrompt: agentMessageContext
      };
      const requesterSessionKey = opts?.agentSessionKey;
      const requesterChannel = opts?.agentChannel;
      const maxPingPongTurns = resolvePingPongTurns(cfg);
      const delivery = { status: 'pending', mode: 'announce' };
      const startA2AFlow = (roundOneReply, waitRunId) => {
        void runSessionsSendA2AFlow({
          targetSessionKey: resolvedKey,
          displayKey,
          message,
          announceTimeoutMs,
          maxPingPongTurns,
          requesterSessionKey,
          requesterChannel,
          roundOneReply,
          waitRunId
        });
      };
      if (timeoutSeconds === 0) {
        try {
          const response = await callGateway({
            method: 'agent',
            params: sendParams,
            timeoutMs: 1e4
          });
          if (typeof response?.runId === 'string' && response.runId) {
            runId = response.runId;
          }
          startA2AFlow(void 0, runId);
          return jsonResult({
            runId,
            status: 'accepted',
            sessionKey: displayKey,
            delivery
          });
        } catch (err) {
          const messageText = err instanceof Error ? err.message : typeof err === 'string' ? err : 'error';
          return jsonResult({
            runId,
            status: 'error',
            error: messageText,
            sessionKey: displayKey
          });
        }
      }
      try {
        const response = await callGateway({
          method: 'agent',
          params: sendParams,
          timeoutMs: 1e4
        });
        if (typeof response?.runId === 'string' && response.runId) {
          runId = response.runId;
        }
      } catch (err) {
        const messageText = err instanceof Error ? err.message : typeof err === 'string' ? err : 'error';
        return jsonResult({
          runId,
          status: 'error',
          error: messageText,
          sessionKey: displayKey
        });
      }
      let waitStatus;
      let waitError;
      try {
        const wait = await callGateway({
          method: 'agent.wait',
          params: {
            runId,
            timeoutMs
          },
          timeoutMs: timeoutMs + 2e3
        });
        waitStatus = typeof wait?.status === 'string' ? wait.status : void 0;
        waitError = typeof wait?.error === 'string' ? wait.error : void 0;
      } catch (err) {
        const messageText = err instanceof Error ? err.message : typeof err === 'string' ? err : 'error';
        return jsonResult({
          runId,
          status: messageText.includes('gateway timeout') ? 'timeout' : 'error',
          error: messageText,
          sessionKey: displayKey
        });
      }
      if (waitStatus === 'timeout') {
        return jsonResult({
          runId,
          status: 'timeout',
          error: waitError,
          sessionKey: displayKey
        });
      }
      if (waitStatus === 'error') {
        return jsonResult({
          runId,
          status: 'error',
          error: waitError ?? 'agent error',
          sessionKey: displayKey
        });
      }
      const history = await callGateway({
        method: 'chat.history',
        params: { sessionKey: resolvedKey, limit: 50 }
      });
      const filtered = stripToolMessages(Array.isArray(history?.messages) ? history.messages : []);
      const last = filtered.length > 0 ? filtered[filtered.length - 1] : void 0;
      const reply = last ? extractAssistantText(last) : void 0;
      startA2AFlow(reply ?? void 0);
      return jsonResult({
        runId,
        status: 'ok',
        reply,
        sessionKey: displayKey,
        delivery
      });
    }
  };
}
export {
  createSessionsSendTool
};
