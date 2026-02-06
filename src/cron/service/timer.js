import { computeJobNextRunAtMs, nextWakeAtMs, resolveJobPayloadTextForMain } from './jobs.js';
import { locked } from './locked.js';
import { ensureLoaded, persist } from './store.js';
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
function armTimer(state) {
  if (state.timer) {
    clearTimeout(state.timer);
  }
  state.timer = null;
  if (!state.deps.cronEnabled) {
    return;
  }
  const nextAt = nextWakeAtMs(state);
  if (!nextAt) {
    return;
  }
  const delay = Math.max(nextAt - state.deps.nowMs(), 0);
  const clampedDelay = Math.min(delay, MAX_TIMEOUT_MS);
  state.timer = setTimeout(() => {
    void onTimer(state).catch((err) => {
      state.deps.log.error({ err: String(err) }, 'cron: timer tick failed');
    });
  }, clampedDelay);
}
async function onTimer(state) {
  if (state.running) {
    return;
  }
  state.running = true;
  try {
    await locked(state, async () => {
      await ensureLoaded(state, { forceReload: true });
      await runDueJobs(state);
      await persist(state);
      armTimer(state);
    });
  } finally {
    state.running = false;
  }
}
async function runDueJobs(state) {
  if (!state.store) {
    return;
  }
  const now = state.deps.nowMs();
  const due = state.store.jobs.filter((j) => {
    if (!j.enabled) {
      return false;
    }
    if (typeof j.state.runningAtMs === 'number') {
      return false;
    }
    const next = j.state.nextRunAtMs;
    return typeof next === 'number' && now >= next;
  });
  for (const job of due) {
    await executeJob(state, job, now, { forced: false });
  }
}
async function executeJob(state, job, nowMs, opts) {
  const startedAt = state.deps.nowMs();
  job.state.runningAtMs = startedAt;
  job.state.lastError = void 0;
  emit(state, { jobId: job.id, action: 'started', runAtMs: startedAt });
  let deleted = false;
  const finish = async (status, err, summary) => {
    const endedAt = state.deps.nowMs();
    job.state.runningAtMs = void 0;
    job.state.lastRunAtMs = startedAt;
    job.state.lastStatus = status;
    job.state.lastDurationMs = Math.max(0, endedAt - startedAt);
    job.state.lastError = err;
    const shouldDelete = job.schedule.kind === 'at' && status === 'ok' && job.deleteAfterRun === true;
    if (!shouldDelete) {
      if (job.schedule.kind === 'at' && status === 'ok') {
        job.enabled = false;
        job.state.nextRunAtMs = void 0;
      } else if (job.enabled) {
        job.state.nextRunAtMs = computeJobNextRunAtMs(job, endedAt);
      } else {
        job.state.nextRunAtMs = void 0;
      }
    }
    emit(state, {
      jobId: job.id,
      action: 'finished',
      status,
      error: err,
      summary,
      runAtMs: startedAt,
      durationMs: job.state.lastDurationMs,
      nextRunAtMs: job.state.nextRunAtMs
    });
    if (shouldDelete && state.store) {
      state.store.jobs = state.store.jobs.filter((j) => j.id !== job.id);
      deleted = true;
      emit(state, { jobId: job.id, action: 'removed' });
    }
  };
  try {
    if (job.sessionTarget === 'main') {
      const text = resolveJobPayloadTextForMain(job);
      if (!text) {
        const kind = job.payload.kind;
        await finish(
          'skipped',
          kind === 'systemEvent' ? 'main job requires non-empty systemEvent text' : 'main job requires payload.kind="systemEvent"'
        );
        return;
      }
      state.deps.enqueueSystemEvent(text, { agentId: job.agentId });
      if (job.wakeMode === 'now' && state.deps.runHeartbeatOnce) {
        const reason = `cron:${job.id}`;
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const maxWaitMs = 2 * 6e4;
        const waitStartedAt = state.deps.nowMs();
        let heartbeatResult;
        for (; ; ) {
          heartbeatResult = await state.deps.runHeartbeatOnce({ reason });
          if (heartbeatResult.status !== 'skipped' || heartbeatResult.reason !== 'requests-in-flight') {
            break;
          }
          if (state.deps.nowMs() - waitStartedAt > maxWaitMs) {
            heartbeatResult = {
              status: 'skipped',
              reason: 'timeout waiting for main lane to become idle'
            };
            break;
          }
          await delay(250);
        }
        if (heartbeatResult.status === 'ran') {
          await finish('ok', void 0, text);
        } else if (heartbeatResult.status === 'skipped') {
          await finish('skipped', heartbeatResult.reason, text);
        } else {
          await finish('error', heartbeatResult.reason, text);
        }
      } else {
        state.deps.requestHeartbeatNow({ reason: `cron:${job.id}` });
        await finish('ok', void 0, text);
      }
      return;
    }
    if (job.payload.kind !== 'agentTurn') {
      await finish('skipped', 'isolated job requires payload.kind=agentTurn');
      return;
    }
    const res = await state.deps.runIsolatedAgentJob({
      job,
      message: job.payload.message
    });
    const summaryText = res.summary?.trim();
    const deliveryMode = job.delivery?.mode ?? 'announce';
    if (summaryText && deliveryMode !== 'none') {
      const prefix = 'Cron';
      const label = res.status === 'error' ? `${prefix} (error): ${summaryText}` : `${prefix}: ${summaryText}`;
      state.deps.enqueueSystemEvent(label, { agentId: job.agentId });
      if (job.wakeMode === 'now') {
        state.deps.requestHeartbeatNow({ reason: `cron:${job.id}` });
      }
    }
    if (res.status === 'ok') {
      await finish('ok', void 0, res.summary);
    } else if (res.status === 'skipped') {
      await finish('skipped', void 0, res.summary);
    } else {
      await finish('error', res.error ?? 'cron job failed', res.summary);
    }
  } catch (err) {
    await finish('error', String(err));
  } finally {
    job.updatedAtMs = nowMs;
    if (!opts.forced && job.enabled && !deleted) {
      job.state.nextRunAtMs = computeJobNextRunAtMs(job, state.deps.nowMs());
    }
  }
}
function wake(state, opts) {
  const text = opts.text.trim();
  if (!text) {
    return { ok: false };
  }
  state.deps.enqueueSystemEvent(text);
  if (opts.mode === 'now') {
    state.deps.requestHeartbeatNow({ reason: 'wake' });
  }
  return { ok: true };
}
function stopTimer(state) {
  if (state.timer) {
    clearTimeout(state.timer);
  }
  state.timer = null;
}
function emit(state, evt) {
  try {
    state.deps.onEvent?.(evt);
  } catch {
    // Intentionally ignored
  }
}
export {
  armTimer,
  emit,
  executeJob,
  onTimer,
  runDueJobs,
  stopTimer,
  wake
};
