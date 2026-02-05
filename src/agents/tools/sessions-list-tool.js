/**
 * Session listing tool for enumerating active and recent sessions.
 * @module agents/tools/sessions-list-tool
 */
import { Type } from '@sinclair/typebox';
import path from 'node:path';
import { loadConfig } from '../../config/config.js';
import { callGateway } from '../../gateway/call.js';
import { isSubagentSessionKey, resolveAgentIdFromSessionKey } from '../../routing/session-key.js';
import { jsonResult, readStringArrayParam } from './common.js';
import {
  createAgentToAgentPolicy,
  classifySessionKind,
  deriveChannel,
  resolveDisplaySessionKey,
  resolveInternalSessionKey,
  resolveMainSessionAlias,
  stripToolMessages
} from './sessions-helpers.js';
const SessionsListToolSchema = Type.Object({
  kinds: Type.Optional(Type.Array(Type.String())),
  limit: Type.Optional(Type.Number({ minimum: 1 })),
  activeMinutes: Type.Optional(Type.Number({ minimum: 1 })),
  messageLimit: Type.Optional(Type.Number({ minimum: 0 }))
});
function resolveSandboxSessionToolsVisibility(cfg) {
  return cfg.agents?.defaults?.sandbox?.sessionToolsVisibility ?? 'spawned';
}
function createSessionsListTool(opts) {
  return {
    label: 'Sessions',
    name: 'sessions_list',
    description: 'List sessions with optional filters and last messages.',
    parameters: SessionsListToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args;
      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const visibility = resolveSandboxSessionToolsVisibility(cfg);
      const requesterInternalKey = typeof opts?.agentSessionKey === 'string' && opts.agentSessionKey.trim() ? resolveInternalSessionKey({
        key: opts.agentSessionKey,
        alias,
        mainKey
      }) : void 0;
      const restrictToSpawned = opts?.sandboxed === true && visibility === 'spawned' && requesterInternalKey && !isSubagentSessionKey(requesterInternalKey);
      const kindsRaw = readStringArrayParam(params, 'kinds')?.map(
        (value) => value.trim().toLowerCase()
      );
      const allowedKindsList = (kindsRaw ?? []).filter(
        (value) => ['main', 'group', 'cron', 'hook', 'node', 'other'].includes(value)
      );
      const allowedKinds = allowedKindsList.length ? new Set(allowedKindsList) : void 0;
      const limit = typeof params.limit === 'number' && Number.isFinite(params.limit) ? Math.max(1, Math.floor(params.limit)) : void 0;
      const activeMinutes = typeof params.activeMinutes === 'number' && Number.isFinite(params.activeMinutes) ? Math.max(1, Math.floor(params.activeMinutes)) : void 0;
      const messageLimitRaw = typeof params.messageLimit === 'number' && Number.isFinite(params.messageLimit) ? Math.max(0, Math.floor(params.messageLimit)) : 0;
      const messageLimit = Math.min(messageLimitRaw, 20);
      const list = await callGateway({
        method: 'sessions.list',
        params: {
          limit,
          activeMinutes,
          includeGlobal: !restrictToSpawned,
          includeUnknown: !restrictToSpawned,
          spawnedBy: restrictToSpawned ? requesterInternalKey : void 0
        }
      });
      const sessions = Array.isArray(list?.sessions) ? list.sessions : [];
      const storePath = typeof list?.path === 'string' ? list.path : void 0;
      const a2aPolicy = createAgentToAgentPolicy(cfg);
      const requesterAgentId = resolveAgentIdFromSessionKey(requesterInternalKey);
      const rows = [];
      for (const entry of sessions) {
        if (!entry || typeof entry !== 'object') {
          continue;
        }
        const key = typeof entry.key === 'string' ? entry.key : '';
        if (!key) {
          continue;
        }
        const entryAgentId = resolveAgentIdFromSessionKey(key);
        const crossAgent = entryAgentId !== requesterAgentId;
        if (crossAgent && !a2aPolicy.isAllowed(requesterAgentId, entryAgentId)) {
          continue;
        }
        if (key === 'unknown') {
          continue;
        }
        if (key === 'global' && alias !== 'global') {
          continue;
        }
        const gatewayKind = typeof entry.kind === 'string' ? entry.kind : void 0;
        const kind = classifySessionKind({ key, gatewayKind, alias, mainKey });
        if (allowedKinds && !allowedKinds.has(kind)) {
          continue;
        }
        const displayKey = resolveDisplaySessionKey({
          key,
          alias,
          mainKey
        });
        const entryChannel = typeof entry.channel === 'string' ? entry.channel : void 0;
        const deliveryContext = entry.deliveryContext && typeof entry.deliveryContext === 'object' ? entry.deliveryContext : void 0;
        const deliveryChannel = typeof deliveryContext?.channel === 'string' ? deliveryContext.channel : void 0;
        const deliveryTo = typeof deliveryContext?.to === 'string' ? deliveryContext.to : void 0;
        const deliveryAccountId = typeof deliveryContext?.accountId === 'string' ? deliveryContext.accountId : void 0;
        const lastChannel = deliveryChannel ?? (typeof entry.lastChannel === 'string' ? entry.lastChannel : void 0);
        const lastAccountId = deliveryAccountId ?? (typeof entry.lastAccountId === 'string' ? entry.lastAccountId : void 0);
        const derivedChannel = deriveChannel({
          key,
          kind,
          channel: entryChannel,
          lastChannel
        });
        const sessionId = typeof entry.sessionId === 'string' ? entry.sessionId : void 0;
        const transcriptPath = sessionId && storePath ? path.join(path.dirname(storePath), `${sessionId}.jsonl`) : void 0;
        const row = {
          key: displayKey,
          kind,
          channel: derivedChannel,
          label: typeof entry.label === 'string' ? entry.label : void 0,
          displayName: typeof entry.displayName === 'string' ? entry.displayName : void 0,
          deliveryContext: deliveryChannel || deliveryTo || deliveryAccountId ? {
            channel: deliveryChannel,
            to: deliveryTo,
            accountId: deliveryAccountId
          } : void 0,
          updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : void 0,
          sessionId,
          model: typeof entry.model === 'string' ? entry.model : void 0,
          contextTokens: typeof entry.contextTokens === 'number' ? entry.contextTokens : void 0,
          totalTokens: typeof entry.totalTokens === 'number' ? entry.totalTokens : void 0,
          thinkingLevel: typeof entry.thinkingLevel === 'string' ? entry.thinkingLevel : void 0,
          verboseLevel: typeof entry.verboseLevel === 'string' ? entry.verboseLevel : void 0,
          systemSent: typeof entry.systemSent === 'boolean' ? entry.systemSent : void 0,
          abortedLastRun: typeof entry.abortedLastRun === 'boolean' ? entry.abortedLastRun : void 0,
          sendPolicy: typeof entry.sendPolicy === 'string' ? entry.sendPolicy : void 0,
          lastChannel,
          lastTo: deliveryTo ?? (typeof entry.lastTo === 'string' ? entry.lastTo : void 0),
          lastAccountId,
          transcriptPath
        };
        if (messageLimit > 0) {
          const resolvedKey = resolveInternalSessionKey({
            key: displayKey,
            alias,
            mainKey
          });
          const history = await callGateway({
            method: 'chat.history',
            params: { sessionKey: resolvedKey, limit: messageLimit }
          });
          const rawMessages = Array.isArray(history?.messages) ? history.messages : [];
          const filtered = stripToolMessages(rawMessages);
          row.messages = filtered.length > messageLimit ? filtered.slice(-messageLimit) : filtered;
        }
        rows.push(row);
      }
      return jsonResult({
        count: rows.length,
        sessions: rows
      });
    }
  };
}
export {
  createSessionsListTool
};
