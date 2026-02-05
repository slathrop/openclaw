/**
 * Gateway management tool for controlling the OpenClaw gateway.
 * @module agents/tools/gateway-tool
 */
import { Type } from '@sinclair/typebox';
import { loadConfig, resolveConfigSnapshotHash } from '../../config/io.js';
import { loadSessionStore, resolveStorePath } from '../../config/sessions.js';
import {
  formatDoctorNonInteractiveHint,
  writeRestartSentinel
} from '../../infra/restart-sentinel.js';
import { scheduleGatewaySigusr1Restart } from '../../infra/restart.js';
import { stringEnum } from '../schema/typebox.js';
import { jsonResult, readStringParam } from './common.js';
import { callGatewayTool } from './gateway.js';
const DEFAULT_UPDATE_TIMEOUT_MS = 20 * 6e4;
function resolveBaseHashFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return void 0;
  }
  const hashValue = snapshot.hash;
  const rawValue = snapshot.raw;
  const hash = resolveConfigSnapshotHash({
    hash: typeof hashValue === 'string' ? hashValue : void 0,
    raw: typeof rawValue === 'string' ? rawValue : void 0
  });
  return hash ?? void 0;
}
const GATEWAY_ACTIONS = [
  'restart',
  'config.get',
  'config.schema',
  'config.apply',
  'config.patch',
  'update.run'
];
const GatewayToolSchema = Type.Object({
  action: stringEnum(GATEWAY_ACTIONS),
  // restart
  delayMs: Type.Optional(Type.Number()),
  reason: Type.Optional(Type.String()),
  // config.get, config.schema, config.apply, update.run
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
  // config.apply, config.patch
  raw: Type.Optional(Type.String()),
  baseHash: Type.Optional(Type.String()),
  // config.apply, config.patch, update.run
  sessionKey: Type.Optional(Type.String()),
  note: Type.Optional(Type.String()),
  restartDelayMs: Type.Optional(Type.Number())
});
function createGatewayTool(opts) {
  return {
    label: 'Gateway',
    name: 'gateway',
    description: 'Restart, apply config, or update the gateway in-place (SIGUSR1). Use config.patch for safe partial config updates (merges with existing). Use config.apply only when replacing entire config. Both trigger restart after writing.',
    parameters: GatewayToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args;
      const action = readStringParam(params, 'action', { required: true });
      if (action === 'restart') {
        if (opts?.config?.commands?.restart !== true) {
          throw new Error('Gateway restart is disabled. Set commands.restart=true to enable.');
        }
        const sessionKey = typeof params.sessionKey === 'string' && params.sessionKey.trim() ? params.sessionKey.trim() : opts?.agentSessionKey?.trim() || void 0;
        const delayMs = typeof params.delayMs === 'number' && Number.isFinite(params.delayMs) ? Math.floor(params.delayMs) : void 0;
        const reason = typeof params.reason === 'string' && params.reason.trim() ? params.reason.trim().slice(0, 200) : void 0;
        const note = typeof params.note === 'string' && params.note.trim() ? params.note.trim() : void 0;
        let deliveryContext;
        let threadId;
        if (sessionKey) {
          const threadMarker = ':thread:';
          const threadIndex = sessionKey.lastIndexOf(threadMarker);
          const baseSessionKey = threadIndex === -1 ? sessionKey : sessionKey.slice(0, threadIndex);
          const threadIdRaw = threadIndex === -1 ? void 0 : sessionKey.slice(threadIndex + threadMarker.length);
          threadId = threadIdRaw?.trim() || void 0;
          try {
            const cfg = loadConfig();
            const storePath = resolveStorePath(cfg.session?.store);
            const store = loadSessionStore(storePath);
            let entry = store[sessionKey];
            if (!entry?.deliveryContext && threadIndex !== -1 && baseSessionKey) {
              entry = store[baseSessionKey];
            }
            if (entry?.deliveryContext) {
              deliveryContext = {
                channel: entry.deliveryContext.channel,
                to: entry.deliveryContext.to,
                accountId: entry.deliveryContext.accountId
              };
            }
          } catch {
            // intentionally ignored
          }
        }
        const payload = {
          kind: 'restart',
          status: 'ok',
          ts: Date.now(),
          sessionKey,
          deliveryContext,
          threadId,
          message: note ?? reason ?? null,
          doctorHint: formatDoctorNonInteractiveHint(),
          stats: {
            mode: 'gateway.restart',
            reason
          }
        };
        try {
          await writeRestartSentinel(payload);
        } catch {
          // intentionally ignored
        }
        console.info(
          `gateway tool: restart requested (delayMs=${delayMs ?? 'default'}, reason=${reason ?? 'none'})`
        );
        const scheduled = scheduleGatewaySigusr1Restart({
          delayMs,
          reason
        });
        return jsonResult(scheduled);
      }
      const gatewayUrl = typeof params.gatewayUrl === 'string' && params.gatewayUrl.trim() ? params.gatewayUrl.trim() : void 0;
      const gatewayToken = typeof params.gatewayToken === 'string' && params.gatewayToken.trim() ? params.gatewayToken.trim() : void 0;
      const timeoutMs = typeof params.timeoutMs === 'number' && Number.isFinite(params.timeoutMs) ? Math.max(1, Math.floor(params.timeoutMs)) : void 0;
      const gatewayOpts = { gatewayUrl, gatewayToken, timeoutMs };
      if (action === 'config.get') {
        const result = await callGatewayTool('config.get', gatewayOpts, {});
        return jsonResult({ ok: true, result });
      }
      if (action === 'config.schema') {
        const result = await callGatewayTool('config.schema', gatewayOpts, {});
        return jsonResult({ ok: true, result });
      }
      if (action === 'config.apply') {
        const raw = readStringParam(params, 'raw', { required: true });
        let baseHash = readStringParam(params, 'baseHash');
        if (!baseHash) {
          const snapshot = await callGatewayTool('config.get', gatewayOpts, {});
          baseHash = resolveBaseHashFromSnapshot(snapshot);
        }
        const sessionKey = typeof params.sessionKey === 'string' && params.sessionKey.trim() ? params.sessionKey.trim() : opts?.agentSessionKey?.trim() || void 0;
        const note = typeof params.note === 'string' && params.note.trim() ? params.note.trim() : void 0;
        const restartDelayMs = typeof params.restartDelayMs === 'number' && Number.isFinite(params.restartDelayMs) ? Math.floor(params.restartDelayMs) : void 0;
        const result = await callGatewayTool('config.apply', gatewayOpts, {
          raw,
          baseHash,
          sessionKey,
          note,
          restartDelayMs
        });
        return jsonResult({ ok: true, result });
      }
      if (action === 'config.patch') {
        const raw = readStringParam(params, 'raw', { required: true });
        let baseHash = readStringParam(params, 'baseHash');
        if (!baseHash) {
          const snapshot = await callGatewayTool('config.get', gatewayOpts, {});
          baseHash = resolveBaseHashFromSnapshot(snapshot);
        }
        const sessionKey = typeof params.sessionKey === 'string' && params.sessionKey.trim() ? params.sessionKey.trim() : opts?.agentSessionKey?.trim() || void 0;
        const note = typeof params.note === 'string' && params.note.trim() ? params.note.trim() : void 0;
        const restartDelayMs = typeof params.restartDelayMs === 'number' && Number.isFinite(params.restartDelayMs) ? Math.floor(params.restartDelayMs) : void 0;
        const result = await callGatewayTool('config.patch', gatewayOpts, {
          raw,
          baseHash,
          sessionKey,
          note,
          restartDelayMs
        });
        return jsonResult({ ok: true, result });
      }
      if (action === 'update.run') {
        const sessionKey = typeof params.sessionKey === 'string' && params.sessionKey.trim() ? params.sessionKey.trim() : opts?.agentSessionKey?.trim() || void 0;
        const note = typeof params.note === 'string' && params.note.trim() ? params.note.trim() : void 0;
        const restartDelayMs = typeof params.restartDelayMs === 'number' && Number.isFinite(params.restartDelayMs) ? Math.floor(params.restartDelayMs) : void 0;
        const updateGatewayOpts = {
          ...gatewayOpts,
          timeoutMs: timeoutMs ?? DEFAULT_UPDATE_TIMEOUT_MS
        };
        const result = await callGatewayTool('update.run', updateGatewayOpts, {
          sessionKey,
          note,
          restartDelayMs,
          timeoutMs: timeoutMs ?? DEFAULT_UPDATE_TIMEOUT_MS
        });
        return jsonResult({ ok: true, result });
      }
      throw new Error(`Unknown action: ${action}`);
    }
  };
}
export {
  createGatewayTool
};
