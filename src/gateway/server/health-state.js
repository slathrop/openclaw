/** @module gateway/server/health-state -- Gateway health state tracking (version, presence counters). */
import { resolveDefaultAgentId } from '../../agents/agent-scope.js';
import { getHealthSnapshot } from '../../commands/health.js';
import { CONFIG_PATH, STATE_DIR, loadConfig } from '../../config/config.js';
import { resolveMainSessionKey } from '../../config/sessions.js';
import { listSystemPresence } from '../../infra/system-presence.js';
import { normalizeMainKey } from '../../routing/session-key.js';
let presenceVersion = 1;
let healthVersion = 1;
let healthCache = null;
let healthRefresh = null;
let broadcastHealthUpdate = null;
function buildGatewaySnapshot() {
  const cfg = loadConfig();
  const defaultAgentId = resolveDefaultAgentId(cfg);
  const mainKey = normalizeMainKey(cfg.session?.mainKey);
  const mainSessionKey = resolveMainSessionKey(cfg);
  const scope = cfg.session?.scope ?? 'per-sender';
  const presence = listSystemPresence();
  const uptimeMs = Math.round(process.uptime() * 1e3);
  const emptyHealth = {};
  return {
    presence,
    health: emptyHealth,
    stateVersion: { presence: presenceVersion, health: healthVersion },
    uptimeMs,
    // Surface resolved paths so UIs can display the true config location.
    configPath: CONFIG_PATH,
    stateDir: STATE_DIR,
    sessionDefaults: {
      defaultAgentId,
      mainKey,
      mainSessionKey,
      scope
    }
  };
}
function getHealthCache() {
  return healthCache;
}
function getHealthVersion() {
  return healthVersion;
}
function incrementPresenceVersion() {
  presenceVersion += 1;
  return presenceVersion;
}
function getPresenceVersion() {
  return presenceVersion;
}
function setBroadcastHealthUpdate(fn) {
  broadcastHealthUpdate = fn;
}
async function refreshGatewayHealthSnapshot(opts) {
  if (!healthRefresh) {
    healthRefresh = (async () => {
      const snap = await getHealthSnapshot({ probe: opts?.probe });
      healthCache = snap;
      healthVersion += 1;
      if (broadcastHealthUpdate) {
        broadcastHealthUpdate(snap);
      }
      return snap;
    })().finally(() => {
      healthRefresh = null;
    });
  }
  return healthRefresh;
}
export {
  buildGatewaySnapshot,
  getHealthCache,
  getHealthVersion,
  getPresenceVersion,
  incrementPresenceVersion,
  refreshGatewayHealthSnapshot,
  setBroadcastHealthUpdate
};
