import {
  applyJobPatch,
  computeJobNextRunAtMs,
  createJob,
  findJobOrThrow,
  isJobDue,
  nextWakeAtMs,
  recomputeNextRuns
} from './jobs.js';
import { locked } from './locked.js';
import { ensureLoaded, persist, warnIfDisabled } from './store.js';
import { armTimer, emit, executeJob, stopTimer, wake } from './timer.js';
async function start(state) {
  await locked(state, async () => {
    if (!state.deps.cronEnabled) {
      state.deps.log.info({ enabled: false }, 'cron: disabled');
      return;
    }
    await ensureLoaded(state);
    recomputeNextRuns(state);
    await persist(state);
    armTimer(state);
    state.deps.log.info(
      {
        enabled: true,
        jobs: state.store?.jobs.length ?? 0,
        nextWakeAtMs: nextWakeAtMs(state) ?? null
      },
      'cron: started'
    );
  });
}
function stop(state) {
  stopTimer(state);
}
async function status(state) {
  return await locked(state, async () => {
    await ensureLoaded(state);
    return {
      enabled: state.deps.cronEnabled,
      storePath: state.deps.storePath,
      jobs: state.store?.jobs.length ?? 0,
      nextWakeAtMs: state.deps.cronEnabled ? nextWakeAtMs(state) ?? null : null
    };
  });
}
async function list(state, opts) {
  return await locked(state, async () => {
    await ensureLoaded(state);
    const includeDisabled = opts?.includeDisabled === true;
    const jobs = (state.store?.jobs ?? []).filter((j) => includeDisabled || j.enabled);
    return jobs.toSorted((a, b) => (a.state.nextRunAtMs ?? 0) - (b.state.nextRunAtMs ?? 0));
  });
}
async function add(state, input) {
  return await locked(state, async () => {
    warnIfDisabled(state, 'add');
    await ensureLoaded(state);
    const job = createJob(state, input);
    state.store?.jobs.push(job);
    await persist(state);
    armTimer(state);
    emit(state, {
      jobId: job.id,
      action: 'added',
      nextRunAtMs: job.state.nextRunAtMs
    });
    return job;
  });
}
async function update(state, id, patch) {
  return await locked(state, async () => {
    warnIfDisabled(state, 'update');
    await ensureLoaded(state);
    const job = findJobOrThrow(state, id);
    const now = state.deps.nowMs();
    applyJobPatch(job, patch);
    job.updatedAtMs = now;
    if (job.enabled) {
      job.state.nextRunAtMs = computeJobNextRunAtMs(job, now);
    } else {
      job.state.nextRunAtMs = void 0;
      job.state.runningAtMs = void 0;
    }
    await persist(state);
    armTimer(state);
    emit(state, {
      jobId: id,
      action: 'updated',
      nextRunAtMs: job.state.nextRunAtMs
    });
    return job;
  });
}
async function remove(state, id) {
  return await locked(state, async () => {
    warnIfDisabled(state, 'remove');
    await ensureLoaded(state);
    const before = state.store?.jobs.length ?? 0;
    if (!state.store) {
      return { ok: false, removed: false };
    }
    state.store.jobs = state.store.jobs.filter((j) => j.id !== id);
    const removed = (state.store.jobs.length ?? 0) !== before;
    await persist(state);
    armTimer(state);
    if (removed) {
      emit(state, { jobId: id, action: 'removed' });
    }
    return { ok: true, removed };
  });
}
async function run(state, id, mode) {
  return await locked(state, async () => {
    warnIfDisabled(state, 'run');
    await ensureLoaded(state);
    const job = findJobOrThrow(state, id);
    const now = state.deps.nowMs();
    const due = isJobDue(job, now, { forced: mode === 'force' });
    if (!due) {
      return { ok: true, ran: false, reason: 'not-due' };
    }
    await executeJob(state, job, now, { forced: mode === 'force' });
    await persist(state);
    armTimer(state);
    return { ok: true, ran: true };
  });
}
function wakeNow(state, opts) {
  return wake(state, opts);
}
export {
  add,
  list,
  remove,
  run,
  start,
  status,
  stop,
  update,
  wakeNow
};
