import { resolveSessionAgentId } from '../../agents/agent-scope.js';
import { abortEmbeddedPiRun } from '../../agents/pi-embedded.js';
import { listSubagentRunsForRequester } from '../../agents/subagent-registry.js';
import {

  // SECURITY: This module handles security-sensitive operations.
  // Changes should be reviewed carefully for security implications.

  resolveInternalSessionKey,
  resolveMainSessionAlias
} from '../../agents/tools/sessions-helpers.js';
import {
  loadSessionStore,
  resolveStorePath,
  updateSessionStore
} from '../../config/sessions.js';
import { logVerbose } from '../../globals.js';
import { parseAgentSessionKey } from '../../routing/session-key.js';
import { resolveCommandAuthorization } from '../command-auth.js';
import { normalizeCommandBody } from '../commands-registry.js';
import { stripMentions, stripStructuralPrefixes } from './mentions.js';
import { clearSessionQueues } from './queue.js';
const ABORT_TRIGGERS = /* @__PURE__ */ new Set(['stop', 'esc', 'abort', 'wait', 'exit', 'interrupt']);
const ABORT_MEMORY = /* @__PURE__ */ new Map();
function isAbortTrigger(text) {
  if (!text) {
    return false;
  }
  const normalized = text.trim().toLowerCase();
  return ABORT_TRIGGERS.has(normalized);
}
function getAbortMemory(key) {
  return ABORT_MEMORY.get(key);
}
function setAbortMemory(key, value) {
  ABORT_MEMORY.set(key, value);
}
function formatAbortReplyText(stoppedSubagents) {
  if (typeof stoppedSubagents !== 'number' || stoppedSubagents <= 0) {
    return '\u2699\uFE0F Agent was aborted.';
  }
  const label = stoppedSubagents === 1 ? 'sub-agent' : 'sub-agents';
  return `\u2699\uFE0F Agent was aborted. Stopped ${stoppedSubagents} ${label}.`;
}
function resolveSessionEntryForKey(store, sessionKey) {
  if (!store || !sessionKey) {
    return {};
  }
  const direct = store[sessionKey];
  if (direct) {
    return { entry: direct, key: sessionKey };
  }
  return {};
}
function resolveAbortTargetKey(ctx) {
  const target = ctx.CommandTargetSessionKey?.trim();
  if (target) {
    return target;
  }
  const sessionKey = ctx.SessionKey?.trim();
  return sessionKey || void 0;
}
function normalizeRequesterSessionKey(cfg, key) {
  const cleaned = key?.trim();
  if (!cleaned) {
    return void 0;
  }
  const { mainKey, alias } = resolveMainSessionAlias(cfg);
  return resolveInternalSessionKey({ key: cleaned, alias, mainKey });
}
function stopSubagentsForRequester(params) {
  const requesterKey = normalizeRequesterSessionKey(params.cfg, params.requesterSessionKey);
  if (!requesterKey) {
    return { stopped: 0 };
  }
  const runs = listSubagentRunsForRequester(requesterKey);
  if (runs.length === 0) {
    return { stopped: 0 };
  }
  const storeCache = /* @__PURE__ */ new Map();
  const seenChildKeys = /* @__PURE__ */ new Set();
  let stopped = 0;
  for (const run of runs) {
    if (run.endedAt) {
      continue;
    }
    const childKey = run.childSessionKey?.trim();
    if (!childKey || seenChildKeys.has(childKey)) {
      continue;
    }
    seenChildKeys.add(childKey);
    const cleared = clearSessionQueues([childKey]);
    const parsed = parseAgentSessionKey(childKey);
    const storePath = resolveStorePath(params.cfg.session?.store, { agentId: parsed?.agentId });
    let store = storeCache.get(storePath);
    if (!store) {
      store = loadSessionStore(storePath);
      storeCache.set(storePath, store);
    }
    const entry = store[childKey];
    const sessionId = entry?.sessionId;
    const aborted = sessionId ? abortEmbeddedPiRun(sessionId) : false;
    if (aborted || cleared.followupCleared > 0 || cleared.laneCleared > 0) {
      stopped += 1;
    }
  }
  if (stopped > 0) {
    logVerbose(`abort: stopped ${stopped} subagent run(s) for ${requesterKey}`);
  }
  return { stopped };
}
async function tryFastAbortFromMessage(params) {
  const { ctx, cfg } = params;
  const targetKey = resolveAbortTargetKey(ctx);
  const agentId = resolveSessionAgentId({
    sessionKey: targetKey ?? ctx.SessionKey ?? '',
    config: cfg
  });
  const raw = stripStructuralPrefixes(ctx.CommandBody ?? ctx.RawBody ?? ctx.Body ?? '');
  const isGroup = ctx.ChatType?.trim().toLowerCase() === 'group';
  const stripped = isGroup ? stripMentions(raw, ctx, cfg, agentId) : raw;
  const normalized = normalizeCommandBody(stripped);
  const abortRequested = normalized === '/stop' || isAbortTrigger(stripped);
  if (!abortRequested) {
    return { handled: false, aborted: false };
  }
  const commandAuthorized = ctx.CommandAuthorized;
  const auth = resolveCommandAuthorization({
    ctx,
    cfg,
    commandAuthorized
  });
  if (!auth.isAuthorizedSender) {
    return { handled: false, aborted: false };
  }
  const abortKey = targetKey ?? auth.from ?? auth.to;
  const requesterSessionKey = targetKey ?? ctx.SessionKey ?? abortKey;
  if (targetKey) {
    const storePath = resolveStorePath(cfg.session?.store, { agentId });
    const store = loadSessionStore(storePath);
    const { entry, key } = resolveSessionEntryForKey(store, targetKey);
    const sessionId = entry?.sessionId;
    const aborted = sessionId ? abortEmbeddedPiRun(sessionId) : false;
    const cleared = clearSessionQueues([key ?? targetKey, sessionId]);
    if (cleared.followupCleared > 0 || cleared.laneCleared > 0) {
      logVerbose(
        `abort: cleared followups=${cleared.followupCleared} lane=${cleared.laneCleared} keys=${cleared.keys.join(',')}`
      );
    }
    if (entry && key) {
      entry.abortedLastRun = true;
      entry.updatedAt = Date.now();
      store[key] = entry;
      await updateSessionStore(storePath, (nextStore) => {
        const nextEntry = nextStore[key] ?? entry;
        if (!nextEntry) {
          return;
        }
        nextEntry.abortedLastRun = true;
        nextEntry.updatedAt = Date.now();
        nextStore[key] = nextEntry;
      });
    } else if (abortKey) {
      setAbortMemory(abortKey, true);
    }
    const { stopped: stopped2 } = stopSubagentsForRequester({ cfg, requesterSessionKey });
    return { handled: true, aborted, stoppedSubagents: stopped2 };
  }
  if (abortKey) {
    setAbortMemory(abortKey, true);
  }
  const { stopped } = stopSubagentsForRequester({ cfg, requesterSessionKey });
  return { handled: true, aborted: false, stoppedSubagents: stopped };
}
export {
  formatAbortReplyText,
  getAbortMemory,
  isAbortTrigger,
  setAbortMemory,
  stopSubagentsForRequester,
  tryFastAbortFromMessage
};
