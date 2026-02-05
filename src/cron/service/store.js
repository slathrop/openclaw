import fs from 'node:fs';
import { parseAbsoluteTimeMs } from '../parse.js';
import { migrateLegacyCronPayload } from '../payload-migration.js';
import { loadCronStore, saveCronStore } from '../store.js';
import { recomputeNextRuns } from './jobs.js';
import { inferLegacyName, normalizeOptionalText } from './normalize.js';
function hasLegacyDeliveryHints(payload) {
  if (typeof payload.deliver === 'boolean') {
    return true;
  }
  if (typeof payload.bestEffortDeliver === 'boolean') {
    return true;
  }
  if (typeof payload.to === 'string' && payload.to.trim()) {
    return true;
  }
  return false;
}
function buildDeliveryFromLegacyPayload(payload) {
  const deliver = payload.deliver;
  const mode = deliver === false ? 'none' : 'announce';
  const channelRaw = typeof payload.channel === 'string' ? payload.channel.trim().toLowerCase() : '';
  const toRaw = typeof payload.to === 'string' ? payload.to.trim() : '';
  const next = { mode };
  if (channelRaw) {
    next.channel = channelRaw;
  }
  if (toRaw) {
    next.to = toRaw;
  }
  if (typeof payload.bestEffortDeliver === 'boolean') {
    next.bestEffort = payload.bestEffortDeliver;
  }
  return next;
}
function buildDeliveryPatchFromLegacyPayload(payload) {
  const deliver = payload.deliver;
  const channelRaw = typeof payload.channel === 'string' ? payload.channel.trim().toLowerCase() : '';
  const toRaw = typeof payload.to === 'string' ? payload.to.trim() : '';
  const next = {};
  let hasPatch = false;
  if (deliver === false) {
    next.mode = 'none';
    hasPatch = true;
  } else if (deliver === true || toRaw) {
    next.mode = 'announce';
    hasPatch = true;
  }
  if (channelRaw) {
    next.channel = channelRaw;
    hasPatch = true;
  }
  if (toRaw) {
    next.to = toRaw;
    hasPatch = true;
  }
  if (typeof payload.bestEffortDeliver === 'boolean') {
    next.bestEffort = payload.bestEffortDeliver;
    hasPatch = true;
  }
  return hasPatch ? next : null;
}
function mergeLegacyDeliveryInto(delivery, payload) {
  const patch = buildDeliveryPatchFromLegacyPayload(payload);
  if (!patch) {
    return { delivery, mutated: false };
  }
  const next = { ...delivery };
  let mutated = false;
  if ('mode' in patch && patch.mode !== next.mode) {
    next.mode = patch.mode;
    mutated = true;
  }
  if ('channel' in patch && patch.channel !== next.channel) {
    next.channel = patch.channel;
    mutated = true;
  }
  if ('to' in patch && patch.to !== next.to) {
    next.to = patch.to;
    mutated = true;
  }
  if ('bestEffort' in patch && patch.bestEffort !== next.bestEffort) {
    next.bestEffort = patch.bestEffort;
    mutated = true;
  }
  return { delivery: next, mutated };
}
function stripLegacyDeliveryFields(payload) {
  if ('deliver' in payload) {
    delete payload.deliver;
  }
  if ('channel' in payload) {
    delete payload.channel;
  }
  if ('to' in payload) {
    delete payload.to;
  }
  if ('bestEffortDeliver' in payload) {
    delete payload.bestEffortDeliver;
  }
}
async function getFileMtimeMs(path) {
  try {
    const stats = await fs.promises.stat(path);
    return stats.mtimeMs;
  } catch {
    return null;
  }
}
async function ensureLoaded(state, opts) {
  if (state.store && !opts?.forceReload) {
    return;
  }
  const fileMtimeMs = await getFileMtimeMs(state.deps.storePath);
  const loaded = await loadCronStore(state.deps.storePath);
  const jobs = loaded.jobs ?? [];
  let mutated = false;
  for (const raw of jobs) {
    const nameRaw = raw.name;
    if (typeof nameRaw !== 'string' || nameRaw.trim().length === 0) {
      raw.name = inferLegacyName({
        schedule: raw.schedule,
        payload: raw.payload
      });
      mutated = true;
    } else {
      raw.name = nameRaw.trim();
    }
    const desc = normalizeOptionalText(raw.description);
    if (raw.description !== desc) {
      raw.description = desc;
      mutated = true;
    }
    if (typeof raw.enabled !== 'boolean') {
      raw.enabled = true;
      mutated = true;
    }
    const payload = raw.payload;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      if (migrateLegacyCronPayload(payload)) {
        mutated = true;
      }
    }
    const schedule = raw.schedule;
    if (schedule && typeof schedule === 'object' && !Array.isArray(schedule)) {
      const sched = schedule;
      const kind = typeof sched.kind === 'string' ? sched.kind.trim().toLowerCase() : '';
      if (!kind && ('at' in sched || 'atMs' in sched)) {
        sched.kind = 'at';
        mutated = true;
      }
      const atRaw = typeof sched.at === 'string' ? sched.at.trim() : '';
      const atMsRaw = sched.atMs;
      const parsedAtMs = typeof atMsRaw === 'number' ? atMsRaw : typeof atMsRaw === 'string' ? parseAbsoluteTimeMs(atMsRaw) : atRaw ? parseAbsoluteTimeMs(atRaw) : null;
      if (parsedAtMs !== null) {
        sched.at = new Date(parsedAtMs).toISOString();
        if ('atMs' in sched) {
          delete sched.atMs;
        }
        mutated = true;
      }
    }
    const delivery = raw.delivery;
    if (delivery && typeof delivery === 'object' && !Array.isArray(delivery)) {
      const modeRaw = delivery.mode;
      if (typeof modeRaw === 'string') {
        const lowered = modeRaw.trim().toLowerCase();
        if (lowered === 'deliver') {
          delivery.mode = 'announce';
          mutated = true;
        }
      }
    }
    const isolation = raw.isolation;
    if (isolation && typeof isolation === 'object' && !Array.isArray(isolation)) {
      delete raw.isolation;
      mutated = true;
    }
    const payloadRecord = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
    const payloadKind = payloadRecord && typeof payloadRecord.kind === 'string' ? payloadRecord.kind : '';
    const sessionTarget = typeof raw.sessionTarget === 'string' ? raw.sessionTarget.trim().toLowerCase() : '';
    const isIsolatedAgentTurn = sessionTarget === 'isolated' || sessionTarget === '' && payloadKind === 'agentTurn';
    const hasDelivery = delivery && typeof delivery === 'object' && !Array.isArray(delivery);
    const hasLegacyDelivery = payloadRecord ? hasLegacyDeliveryHints(payloadRecord) : false;
    if (isIsolatedAgentTurn && payloadKind === 'agentTurn') {
      if (!hasDelivery) {
        raw.delivery = payloadRecord && hasLegacyDelivery ? buildDeliveryFromLegacyPayload(payloadRecord) : { mode: 'announce' };
        mutated = true;
      }
      if (payloadRecord && hasLegacyDelivery) {
        if (hasDelivery) {
          const merged = mergeLegacyDeliveryInto(
            delivery,
            payloadRecord
          );
          if (merged.mutated) {
            raw.delivery = merged.delivery;
            mutated = true;
          }
        }
        stripLegacyDeliveryFields(payloadRecord);
        mutated = true;
      }
    }
  }
  state.store = { version: 1, jobs };
  state.storeLoadedAtMs = state.deps.nowMs();
  state.storeFileMtimeMs = fileMtimeMs;
  recomputeNextRuns(state);
  if (mutated) {
    await persist(state);
  }
}
function warnIfDisabled(state, action) {
  if (state.deps.cronEnabled) {
    return;
  }
  if (state.warnedDisabled) {
    return;
  }
  state.warnedDisabled = true;
  state.deps.log.warn(
    { enabled: false, action, storePath: state.deps.storePath },
    'cron: scheduler disabled; jobs will not run automatically'
  );
}
async function persist(state) {
  if (!state.store) {
    return;
  }
  await saveCronStore(state.deps.storePath, state.store);
  state.storeFileMtimeMs = await getFileMtimeMs(state.deps.storePath);
}
export {
  ensureLoaded,
  persist,
  warnIfDisabled
};
