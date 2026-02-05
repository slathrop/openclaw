import { toNumber } from '../format.js';
async function loadCronStatus(state) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    const res = await state.client.request('cron.status', {});
    state.cronStatus = res;
  } catch (err) {
    state.cronError = String(err);
  }
}
async function loadCronJobs(state) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.cronLoading) {
    return;
  }
  state.cronLoading = true;
  state.cronError = null;
  try {
    const res = await state.client.request('cron.list', {
      includeDisabled: true
    });
    state.cronJobs = Array.isArray(res.jobs) ? res.jobs : [];
  } catch (err) {
    state.cronError = String(err);
  } finally {
    state.cronLoading = false;
  }
}
function buildCronSchedule(form) {
  if (form.scheduleKind === 'at') {
    const ms = Date.parse(form.scheduleAt);
    if (!Number.isFinite(ms)) {
      throw new Error('Invalid run time.');
    }
    return { kind: 'at', at: new Date(ms).toISOString() };
  }
  if (form.scheduleKind === 'every') {
    const amount = toNumber(form.everyAmount, 0);
    if (amount <= 0) {
      throw new Error('Invalid interval amount.');
    }
    const unit = form.everyUnit;
    const mult = unit === 'minutes' ? 6e4 : unit === 'hours' ? 36e5 : 864e5;
    return { kind: 'every', everyMs: amount * mult };
  }
  const expr = form.cronExpr.trim();
  if (!expr) {
    throw new Error('Cron expression required.');
  }
  return { kind: 'cron', expr, tz: form.cronTz.trim() || void 0 };
}
function buildCronPayload(form) {
  if (form.payloadKind === 'systemEvent') {
    const text = form.payloadText.trim();
    if (!text) {
      throw new Error('System event text required.');
    }
    return { kind: 'systemEvent', text };
  }
  const message = form.payloadText.trim();
  if (!message) {
    throw new Error('Agent message required.');
  }
  const payload = { kind: 'agentTurn', message };
  const timeoutSeconds = toNumber(form.timeoutSeconds, 0);
  if (timeoutSeconds > 0) {
    payload.timeoutSeconds = timeoutSeconds;
  }
  return payload;
}
async function addCronJob(state) {
  if (!state.client || !state.connected || state.cronBusy) {
    return;
  }
  state.cronBusy = true;
  state.cronError = null;
  try {
    const schedule = buildCronSchedule(state.cronForm);
    const payload = buildCronPayload(state.cronForm);
    const delivery = state.cronForm.sessionTarget === 'isolated' && state.cronForm.payloadKind === 'agentTurn' && state.cronForm.deliveryMode ? {
      mode: state.cronForm.deliveryMode === 'announce' ? 'announce' : 'none',
      channel: state.cronForm.deliveryChannel.trim() || 'last',
      to: state.cronForm.deliveryTo.trim() || void 0
    } : void 0;
    const agentId = state.cronForm.agentId.trim();
    const job = {
      name: state.cronForm.name.trim(),
      description: state.cronForm.description.trim() || void 0,
      agentId: agentId || void 0,
      enabled: state.cronForm.enabled,
      schedule,
      sessionTarget: state.cronForm.sessionTarget,
      wakeMode: state.cronForm.wakeMode,
      payload,
      delivery
    };
    if (!job.name) {
      throw new Error('Name required.');
    }
    await state.client.request('cron.add', job);
    state.cronForm = {
      ...state.cronForm,
      name: '',
      description: '',
      payloadText: ''
    };
    await loadCronJobs(state);
    await loadCronStatus(state);
  } catch (err) {
    state.cronError = String(err);
  } finally {
    state.cronBusy = false;
  }
}
async function toggleCronJob(state, job, enabled) {
  if (!state.client || !state.connected || state.cronBusy) {
    return;
  }
  state.cronBusy = true;
  state.cronError = null;
  try {
    await state.client.request('cron.update', { id: job.id, patch: { enabled } });
    await loadCronJobs(state);
    await loadCronStatus(state);
  } catch (err) {
    state.cronError = String(err);
  } finally {
    state.cronBusy = false;
  }
}
async function runCronJob(state, job) {
  if (!state.client || !state.connected || state.cronBusy) {
    return;
  }
  state.cronBusy = true;
  state.cronError = null;
  try {
    await state.client.request('cron.run', { id: job.id, mode: 'force' });
    await loadCronRuns(state, job.id);
  } catch (err) {
    state.cronError = String(err);
  } finally {
    state.cronBusy = false;
  }
}
async function removeCronJob(state, job) {
  if (!state.client || !state.connected || state.cronBusy) {
    return;
  }
  state.cronBusy = true;
  state.cronError = null;
  try {
    await state.client.request('cron.remove', { id: job.id });
    if (state.cronRunsJobId === job.id) {
      state.cronRunsJobId = null;
      state.cronRuns = [];
    }
    await loadCronJobs(state);
    await loadCronStatus(state);
  } catch (err) {
    state.cronError = String(err);
  } finally {
    state.cronBusy = false;
  }
}
async function loadCronRuns(state, jobId) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    const res = await state.client.request('cron.runs', {
      id: jobId,
      limit: 50
    });
    state.cronRunsJobId = jobId;
    state.cronRuns = Array.isArray(res.entries) ? res.entries : [];
  } catch (err) {
    state.cronError = String(err);
  }
}
export {
  addCronJob,
  buildCronPayload,
  buildCronSchedule,
  loadCronJobs,
  loadCronRuns,
  loadCronStatus,
  removeCronJob,
  runCronJob,
  toggleCronJob
};
