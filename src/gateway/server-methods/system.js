/** @module gateway/server-methods/system -- System information RPC method handler. */
import { resolveMainSessionKeyFromConfig } from '../../config/sessions.js';
import { getLastHeartbeatEvent } from '../../infra/heartbeat-events.js';
import { setHeartbeatsEnabled } from '../../infra/heartbeat-runner.js';
import { enqueueSystemEvent, isSystemEventContextChanged } from '../../infra/system-events.js';
import { listSystemPresence, updateSystemPresence } from '../../infra/system-presence.js';
import { ErrorCodes, errorShape } from '../protocol/index.js';
const systemHandlers = {
  'last-heartbeat': ({ respond }) => {
    respond(true, getLastHeartbeatEvent(), void 0);
  },
  'set-heartbeats': ({ params, respond }) => {
    const enabled = params.enabled;
    if (typeof enabled !== 'boolean') {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          'invalid set-heartbeats params: enabled (boolean) required'
        )
      );
      return;
    }
    setHeartbeatsEnabled(enabled);
    respond(true, { ok: true, enabled }, void 0);
  },
  'system-presence': ({ respond }) => {
    const presence = listSystemPresence();
    respond(true, presence, void 0);
  },
  'system-event': ({ params, respond, context }) => {
    const text = typeof params.text === 'string' ? params.text.trim() : '';
    if (!text) {
      respond(false, void 0, errorShape(ErrorCodes.INVALID_REQUEST, 'text required'));
      return;
    }
    const sessionKey = resolveMainSessionKeyFromConfig();
    const deviceId = typeof params.deviceId === 'string' ? params.deviceId : void 0;
    const instanceId = typeof params.instanceId === 'string' ? params.instanceId : void 0;
    const host = typeof params.host === 'string' ? params.host : void 0;
    const ip = typeof params.ip === 'string' ? params.ip : void 0;
    const mode = typeof params.mode === 'string' ? params.mode : void 0;
    const version = typeof params.version === 'string' ? params.version : void 0;
    const platform = typeof params.platform === 'string' ? params.platform : void 0;
    const deviceFamily = typeof params.deviceFamily === 'string' ? params.deviceFamily : void 0;
    const modelIdentifier = typeof params.modelIdentifier === 'string' ? params.modelIdentifier : void 0;
    const lastInputSeconds = typeof params.lastInputSeconds === 'number' && Number.isFinite(params.lastInputSeconds) ? params.lastInputSeconds : void 0;
    const reason = typeof params.reason === 'string' ? params.reason : void 0;
    const roles = Array.isArray(params.roles) && params.roles.every((t) => typeof t === 'string') ? params.roles : void 0;
    const scopes = Array.isArray(params.scopes) && params.scopes.every((t) => typeof t === 'string') ? params.scopes : void 0;
    const tags = Array.isArray(params.tags) && params.tags.every((t) => typeof t === 'string') ? params.tags : void 0;
    const presenceUpdate = updateSystemPresence({
      text,
      deviceId,
      instanceId,
      host,
      ip,
      mode,
      version,
      platform,
      deviceFamily,
      modelIdentifier,
      lastInputSeconds,
      reason,
      roles,
      scopes,
      tags
    });
    const isNodePresenceLine = text.startsWith('Node:');
    if (isNodePresenceLine) {
      const next = presenceUpdate.next;
      const changed = new Set(presenceUpdate.changedKeys);
      const reasonValue = next.reason ?? reason;
      const normalizedReason = (reasonValue ?? '').toLowerCase();
      const ignoreReason = normalizedReason.startsWith('periodic') || normalizedReason === 'heartbeat';
      const hostChanged = changed.has('host');
      const ipChanged = changed.has('ip');
      const versionChanged = changed.has('version');
      const modeChanged = changed.has('mode');
      const reasonChanged = changed.has('reason') && !ignoreReason;
      const hasChanges = hostChanged || ipChanged || versionChanged || modeChanged || reasonChanged;
      if (hasChanges) {
        const contextChanged = isSystemEventContextChanged(sessionKey, presenceUpdate.key);
        const parts = [];
        if (contextChanged || hostChanged || ipChanged) {
          const hostLabel = next.host?.trim() || 'Unknown';
          const ipLabel = next.ip?.trim();
          parts.push(`Node: ${hostLabel}${ipLabel ? ` (${ipLabel})` : ''}`);
        }
        if (versionChanged) {
          parts.push(`app ${next.version?.trim() || 'unknown'}`);
        }
        if (modeChanged) {
          parts.push(`mode ${next.mode?.trim() || 'unknown'}`);
        }
        if (reasonChanged) {
          parts.push(`reason ${reasonValue?.trim() || 'event'}`);
        }
        const deltaText = parts.join(' \xB7 ');
        if (deltaText) {
          enqueueSystemEvent(deltaText, {
            sessionKey,
            contextKey: presenceUpdate.key
          });
        }
      }
    } else {
      enqueueSystemEvent(text, { sessionKey });
    }
    const nextPresenceVersion = context.incrementPresenceVersion();
    context.broadcast(
      'presence',
      { presence: listSystemPresence() },
      {
        dropIfSlow: true,
        stateVersion: {
          presence: nextPresenceVersion,
          health: context.getHealthVersion()
        }
      }
    );
    respond(true, { ok: true }, void 0);
  }
};
export {
  systemHandlers
};
