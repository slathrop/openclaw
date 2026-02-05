/**
 * @module subagent-registry.store
 * Persistent subagent registry storage and version migration.
 */
import path from 'node:path';
import { STATE_DIR } from '../config/paths.js';
import { loadJsonFile, saveJsonFile } from '../infra/json-file.js';
import { normalizeDeliveryContext } from '../utils/delivery-context.js';
const REGISTRY_VERSION = 2;
function resolveSubagentRegistryPath() {
  return path.join(STATE_DIR, 'subagents', 'runs.json');
}
function loadSubagentRegistryFromDisk() {
  const pathname = resolveSubagentRegistryPath();
  const raw = loadJsonFile(pathname);
  if (!raw || typeof raw !== 'object') {
    return /* @__PURE__ */ new Map();
  }
  const record = raw;
  if (record.version !== 1 && record.version !== 2) {
    return /* @__PURE__ */ new Map();
  }
  const runsRaw = record.runs;
  if (!runsRaw || typeof runsRaw !== 'object') {
    return /* @__PURE__ */ new Map();
  }
  const out = /* @__PURE__ */ new Map();
  const isLegacy = record.version === 1;
  let migrated = false;
  for (const [runId, entry] of Object.entries(runsRaw)) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const typed = entry;
    if (!typed.runId || typeof typed.runId !== 'string') {
      continue;
    }
    const legacyCompletedAt = isLegacy && typeof typed.announceCompletedAt === 'number' ? typed.announceCompletedAt : void 0;
    const cleanupCompletedAt = typeof typed.cleanupCompletedAt === 'number' ? typed.cleanupCompletedAt : legacyCompletedAt;
    const cleanupHandled = typeof typed.cleanupHandled === 'boolean' ? typed.cleanupHandled : isLegacy ? Boolean(typed.announceHandled ?? cleanupCompletedAt) : void 0;
    const requesterOrigin = normalizeDeliveryContext(
      typed.requesterOrigin ?? {
        channel: typeof typed.requesterChannel === 'string' ? typed.requesterChannel : void 0,
        accountId: typeof typed.requesterAccountId === 'string' ? typed.requesterAccountId : void 0
      }
    );
    const {
      announceCompletedAt: _announceCompletedAt, // eslint-disable-line no-unused-vars
      announceHandled: _announceHandled, // eslint-disable-line no-unused-vars
      requesterChannel: _channel, // eslint-disable-line no-unused-vars
      requesterAccountId: _accountId, // eslint-disable-line no-unused-vars
      ...rest
    } = typed;
    out.set(runId, {
      ...rest,
      requesterOrigin,
      cleanupCompletedAt,
      cleanupHandled
    });
    if (isLegacy) {
      migrated = true;
    }
  }
  if (migrated) {
    try {
      saveSubagentRegistryToDisk(out);
    } catch {
    // intentionally ignored
    }
  }
  return out;
}
function saveSubagentRegistryToDisk(runs) {
  const pathname = resolveSubagentRegistryPath();
  const serialized = {};
  for (const [runId, entry] of runs.entries()) {
    serialized[runId] = entry;
  }
  const out = {
    version: REGISTRY_VERSION,
    runs: serialized
  };
  saveJsonFile(pathname, out);
}
export {
  loadSubagentRegistryFromDisk,
  resolveSubagentRegistryPath,
  saveSubagentRegistryToDisk
};
