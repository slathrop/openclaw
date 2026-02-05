import crypto from 'node:crypto';
import { parseAbsoluteTimeMs } from '../parse.js';
import { computeNextRunAtMs } from '../schedule.js';
import {
  normalizeOptionalAgentId,
  normalizeOptionalText,
  normalizePayloadToSystemText,
  normalizeRequiredName
} from './normalize.js';
const STUCK_RUN_MS = 2 * 60 * 60 * 1e3;
function assertSupportedJobSpec(job) {
  if (job.sessionTarget === 'main' && job.payload.kind !== 'systemEvent') {
    throw new Error('main cron jobs require payload.kind="systemEvent"');
  }
  if (job.sessionTarget === 'isolated' && job.payload.kind !== 'agentTurn') {
    throw new Error('isolated cron jobs require payload.kind="agentTurn"');
  }
}
function assertDeliverySupport(job) {
  if (job.delivery && job.sessionTarget !== 'isolated') {
    throw new Error('cron delivery config is only supported for sessionTarget="isolated"');
  }
}
function findJobOrThrow(state, id) {
  const job = state.store?.jobs.find((j) => j.id === id);
  if (!job) {
    throw new Error(`unknown cron job id: ${id}`);
  }
  return job;
}
function computeJobNextRunAtMs(job, nowMs) {
  if (!job.enabled) {
    return void 0;
  }
  if (job.schedule.kind === 'at') {
    if (job.state.lastStatus === 'ok' && job.state.lastRunAtMs) {
      return void 0;
    }
    const atMs = parseAbsoluteTimeMs(job.schedule.at);
    return atMs !== null ? atMs : void 0;
  }
  return computeNextRunAtMs(job.schedule, nowMs);
}
function recomputeNextRuns(state) {
  if (!state.store) {
    return;
  }
  const now = state.deps.nowMs();
  for (const job of state.store.jobs) {
    if (!job.state) {
      job.state = {};
    }
    if (!job.enabled) {
      job.state.nextRunAtMs = void 0;
      job.state.runningAtMs = void 0;
      continue;
    }
    const runningAt = job.state.runningAtMs;
    if (typeof runningAt === 'number' && now - runningAt > STUCK_RUN_MS) {
      state.deps.log.warn(
        { jobId: job.id, runningAtMs: runningAt },
        'cron: clearing stuck running marker'
      );
      job.state.runningAtMs = void 0;
    }
    job.state.nextRunAtMs = computeJobNextRunAtMs(job, now);
  }
}
function nextWakeAtMs(state) {
  const jobs = state.store?.jobs ?? [];
  const enabled = jobs.filter((j) => j.enabled && typeof j.state.nextRunAtMs === 'number');
  if (enabled.length === 0) {
    return void 0;
  }
  return enabled.reduce(
    (min, j) => Math.min(min, j.state.nextRunAtMs),
    enabled[0].state.nextRunAtMs
  );
}
function createJob(state, input) {
  const now = state.deps.nowMs();
  const id = crypto.randomUUID();
  const deleteAfterRun = typeof input.deleteAfterRun === 'boolean' ? input.deleteAfterRun : input.schedule.kind === 'at' ? true : void 0;
  const enabled = typeof input.enabled === 'boolean' ? input.enabled : true;
  const job = {
    id,
    agentId: normalizeOptionalAgentId(input.agentId),
    name: normalizeRequiredName(input.name),
    description: normalizeOptionalText(input.description),
    enabled,
    deleteAfterRun,
    createdAtMs: now,
    updatedAtMs: now,
    schedule: input.schedule,
    sessionTarget: input.sessionTarget,
    wakeMode: input.wakeMode,
    payload: input.payload,
    delivery: input.delivery,
    state: {
      ...input.state
    }
  };
  assertSupportedJobSpec(job);
  assertDeliverySupport(job);
  job.state.nextRunAtMs = computeJobNextRunAtMs(job, now);
  return job;
}
function applyJobPatch(job, patch) {
  if ('name' in patch) {
    job.name = normalizeRequiredName(patch.name);
  }
  if ('description' in patch) {
    job.description = normalizeOptionalText(patch.description);
  }
  if (typeof patch.enabled === 'boolean') {
    job.enabled = patch.enabled;
  }
  if (typeof patch.deleteAfterRun === 'boolean') {
    job.deleteAfterRun = patch.deleteAfterRun;
  }
  if (patch.schedule) {
    job.schedule = patch.schedule;
  }
  if (patch.sessionTarget) {
    job.sessionTarget = patch.sessionTarget;
  }
  if (patch.wakeMode) {
    job.wakeMode = patch.wakeMode;
  }
  if (patch.payload) {
    job.payload = mergeCronPayload(job.payload, patch.payload);
  }
  if (!patch.delivery && patch.payload?.kind === 'agentTurn') {
    const legacyDeliveryPatch = buildLegacyDeliveryPatch(patch.payload);
    if (legacyDeliveryPatch && job.sessionTarget === 'isolated' && job.payload.kind === 'agentTurn') {
      job.delivery = mergeCronDelivery(job.delivery, legacyDeliveryPatch);
    }
  }
  if (patch.delivery) {
    job.delivery = mergeCronDelivery(job.delivery, patch.delivery);
  }
  if (job.sessionTarget === 'main' && job.delivery) {
    job.delivery = void 0;
  }
  if (patch.state) {
    job.state = { ...job.state, ...patch.state };
  }
  if ('agentId' in patch) {
    job.agentId = normalizeOptionalAgentId(patch.agentId);
  }
  assertSupportedJobSpec(job);
  assertDeliverySupport(job);
}
function mergeCronPayload(existing, patch) {
  if (patch.kind !== existing.kind) {
    return buildPayloadFromPatch(patch);
  }
  if (patch.kind === 'systemEvent') {
    if (existing.kind !== 'systemEvent') {
      return buildPayloadFromPatch(patch);
    }
    const text = typeof patch.text === 'string' ? patch.text : existing.text;
    return { kind: 'systemEvent', text };
  }
  if (existing.kind !== 'agentTurn') {
    return buildPayloadFromPatch(patch);
  }
  const next = { ...existing };
  if (typeof patch.message === 'string') {
    next.message = patch.message;
  }
  if (typeof patch.model === 'string') {
    next.model = patch.model;
  }
  if (typeof patch.thinking === 'string') {
    next.thinking = patch.thinking;
  }
  if (typeof patch.timeoutSeconds === 'number') {
    next.timeoutSeconds = patch.timeoutSeconds;
  }
  if (typeof patch.deliver === 'boolean') {
    next.deliver = patch.deliver;
  }
  if (typeof patch.channel === 'string') {
    next.channel = patch.channel;
  }
  if (typeof patch.to === 'string') {
    next.to = patch.to;
  }
  if (typeof patch.bestEffortDeliver === 'boolean') {
    next.bestEffortDeliver = patch.bestEffortDeliver;
  }
  return next;
}
function buildLegacyDeliveryPatch(payload) {
  const deliver = payload.deliver;
  const toRaw = typeof payload.to === 'string' ? payload.to.trim() : '';
  const hasLegacyHints = typeof deliver === 'boolean' || typeof payload.bestEffortDeliver === 'boolean' || Boolean(toRaw);
  if (!hasLegacyHints) {
    return null;
  }
  const patch = {};
  let hasPatch = false;
  if (deliver === false) {
    patch.mode = 'none';
    hasPatch = true;
  } else if (deliver === true || toRaw) {
    patch.mode = 'announce';
    hasPatch = true;
  }
  if (typeof payload.channel === 'string') {
    const channel = payload.channel.trim().toLowerCase();
    patch.channel = channel ? channel : void 0;
    hasPatch = true;
  }
  if (typeof payload.to === 'string') {
    patch.to = payload.to.trim();
    hasPatch = true;
  }
  if (typeof payload.bestEffortDeliver === 'boolean') {
    patch.bestEffort = payload.bestEffortDeliver;
    hasPatch = true;
  }
  return hasPatch ? patch : null;
}
function buildPayloadFromPatch(patch) {
  if (patch.kind === 'systemEvent') {
    if (typeof patch.text !== 'string' || patch.text.length === 0) {
      throw new Error('cron.update payload.kind="systemEvent" requires text');
    }
    return { kind: 'systemEvent', text: patch.text };
  }
  if (typeof patch.message !== 'string' || patch.message.length === 0) {
    throw new Error('cron.update payload.kind="agentTurn" requires message');
  }
  return {
    kind: 'agentTurn',
    message: patch.message,
    model: patch.model,
    thinking: patch.thinking,
    timeoutSeconds: patch.timeoutSeconds,
    deliver: patch.deliver,
    channel: patch.channel,
    to: patch.to,
    bestEffortDeliver: patch.bestEffortDeliver
  };
}
function mergeCronDelivery(existing, patch) {
  const next = {
    mode: existing?.mode ?? 'none',
    channel: existing?.channel,
    to: existing?.to,
    bestEffort: existing?.bestEffort
  };
  if (typeof patch.mode === 'string') {
    next.mode = patch.mode === 'deliver' ? 'announce' : patch.mode;
  }
  if ('channel' in patch) {
    const channel = typeof patch.channel === 'string' ? patch.channel.trim() : '';
    next.channel = channel ? channel : void 0;
  }
  if ('to' in patch) {
    const to = typeof patch.to === 'string' ? patch.to.trim() : '';
    next.to = to ? to : void 0;
  }
  if (typeof patch.bestEffort === 'boolean') {
    next.bestEffort = patch.bestEffort;
  }
  return next;
}
function isJobDue(job, nowMs, opts) {
  if (opts.forced) {
    return true;
  }
  return job.enabled && typeof job.state.nextRunAtMs === 'number' && nowMs >= job.state.nextRunAtMs;
}
function resolveJobPayloadTextForMain(job) {
  if (job.payload.kind !== 'systemEvent') {
    return void 0;
  }
  const text = normalizePayloadToSystemText(job.payload);
  return text.trim() ? text : void 0;
}
export {
  applyJobPatch,
  assertSupportedJobSpec,
  computeJobNextRunAtMs,
  createJob,
  findJobOrThrow,
  isJobDue,
  nextWakeAtMs,
  recomputeNextRuns,
  resolveJobPayloadTextForMain
};
