const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import crypto from 'node:crypto';
import {
  normalizeThinkLevel,
  normalizeVerboseLevel
} from '../../auto-reply/thinking.js';
import {
  evaluateSessionFreshness,
  loadSessionStore,
  resolveAgentIdFromSessionKey,
  resolveChannelResetConfig,
  resolveExplicitAgentSessionKey,
  resolveSessionResetPolicy,
  resolveSessionResetType,
  resolveSessionKey,
  resolveStorePath
} from '../../config/sessions.js';
import { normalizeMainKey } from '../../routing/session-key.js';
function resolveSessionKeyForRequest(opts) {
  const sessionCfg = opts.cfg.session;
  const scope = sessionCfg?.scope ?? 'per-sender';
  const mainKey = normalizeMainKey(sessionCfg?.mainKey);
  const explicitSessionKey = opts.sessionKey?.trim() || resolveExplicitAgentSessionKey({
    cfg: opts.cfg,
    agentId: opts.agentId
  });
  const storeAgentId = resolveAgentIdFromSessionKey(explicitSessionKey);
  const storePath = resolveStorePath(sessionCfg?.store, {
    agentId: storeAgentId
  });
  const sessionStore = loadSessionStore(storePath);
  const ctx = opts.to?.trim() ? { From: opts.to } : void 0;
  let sessionKey = explicitSessionKey ?? (ctx ? resolveSessionKey(scope, ctx, mainKey) : void 0);
  if (!explicitSessionKey && opts.sessionId && (!sessionKey || sessionStore[sessionKey]?.sessionId !== opts.sessionId)) {
    const foundKey = Object.keys(sessionStore).find(
      (key) => sessionStore[key]?.sessionId === opts.sessionId
    );
    if (foundKey) {
      sessionKey = foundKey;
    }
  }
  return { sessionKey, sessionStore, storePath };
}
__name(resolveSessionKeyForRequest, 'resolveSessionKeyForRequest');
function resolveSession(opts) {
  const sessionCfg = opts.cfg.session;
  const { sessionKey, sessionStore, storePath } = resolveSessionKeyForRequest({
    cfg: opts.cfg,
    to: opts.to,
    sessionId: opts.sessionId,
    sessionKey: opts.sessionKey,
    agentId: opts.agentId
  });
  const now = Date.now();
  const sessionEntry = sessionKey ? sessionStore[sessionKey] : void 0;
  const resetType = resolveSessionResetType({ sessionKey });
  const channelReset = resolveChannelResetConfig({
    sessionCfg,
    channel: sessionEntry?.lastChannel ?? sessionEntry?.channel
  });
  const resetPolicy = resolveSessionResetPolicy({
    sessionCfg,
    resetType,
    resetOverride: channelReset
  });
  const fresh = sessionEntry ? evaluateSessionFreshness({ updatedAt: sessionEntry.updatedAt, now, policy: resetPolicy }).fresh : false;
  const sessionId = opts.sessionId?.trim() || (fresh ? sessionEntry?.sessionId : void 0) || crypto.randomUUID();
  const isNewSession = !fresh && !opts.sessionId;
  const persistedThinking = fresh && sessionEntry?.thinkingLevel ? normalizeThinkLevel(sessionEntry.thinkingLevel) : void 0;
  const persistedVerbose = fresh && sessionEntry?.verboseLevel ? normalizeVerboseLevel(sessionEntry.verboseLevel) : void 0;
  return {
    sessionId,
    sessionKey,
    sessionEntry,
    sessionStore,
    storePath,
    isNewSession,
    persistedThinking,
    persistedVerbose
  };
}
__name(resolveSession, 'resolveSession');
export {
  resolveSession,
  resolveSessionKeyForRequest
};
