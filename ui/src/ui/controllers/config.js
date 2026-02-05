import {
  cloneConfigObject,
  removePathValue,
  serializeConfigForm,
  setPathValue
} from './config/form-utils.js';
async function loadConfig(state) {
  if (!state.client || !state.connected) {
    return;
  }
  state.configLoading = true;
  state.lastError = null;
  try {
    const res = await state.client.request('config.get', {});
    applyConfigSnapshot(state, res);
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.configLoading = false;
  }
}
async function loadConfigSchema(state) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.configSchemaLoading) {
    return;
  }
  state.configSchemaLoading = true;
  try {
    const res = await state.client.request('config.schema', {});
    applyConfigSchema(state, res);
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.configSchemaLoading = false;
  }
}
function applyConfigSchema(state, res) {
  state.configSchema = res.schema ?? null;
  state.configUiHints = res.uiHints ?? {};
  state.configSchemaVersion = res.version ?? null;
}
function applyConfigSnapshot(state, snapshot) {
  state.configSnapshot = snapshot;
  const rawFromSnapshot = typeof snapshot.raw === 'string' ? snapshot.raw : snapshot.config && typeof snapshot.config === 'object' ? serializeConfigForm(snapshot.config) : state.configRaw;
  if (!state.configFormDirty || state.configFormMode === 'raw') {
    state.configRaw = rawFromSnapshot;
  } else if (state.configForm) {
    state.configRaw = serializeConfigForm(state.configForm);
  } else {
    state.configRaw = rawFromSnapshot;
  }
  state.configValid = typeof snapshot.valid === 'boolean' ? snapshot.valid : null;
  state.configIssues = Array.isArray(snapshot.issues) ? snapshot.issues : [];
  if (!state.configFormDirty) {
    state.configForm = cloneConfigObject(snapshot.config ?? {});
    state.configFormOriginal = cloneConfigObject(snapshot.config ?? {});
    state.configRawOriginal = rawFromSnapshot;
  }
}
async function saveConfig(state) {
  if (!state.client || !state.connected) {
    return;
  }
  state.configSaving = true;
  state.lastError = null;
  try {
    const raw = state.configFormMode === 'form' && state.configForm ? serializeConfigForm(state.configForm) : state.configRaw;
    const baseHash = state.configSnapshot?.hash;
    if (!baseHash) {
      state.lastError = 'Config hash missing; reload and retry.';
      return;
    }
    await state.client.request('config.set', { raw, baseHash });
    state.configFormDirty = false;
    await loadConfig(state);
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.configSaving = false;
  }
}
async function applyConfig(state) {
  if (!state.client || !state.connected) {
    return;
  }
  state.configApplying = true;
  state.lastError = null;
  try {
    const raw = state.configFormMode === 'form' && state.configForm ? serializeConfigForm(state.configForm) : state.configRaw;
    const baseHash = state.configSnapshot?.hash;
    if (!baseHash) {
      state.lastError = 'Config hash missing; reload and retry.';
      return;
    }
    await state.client.request('config.apply', {
      raw,
      baseHash,
      sessionKey: state.applySessionKey
    });
    state.configFormDirty = false;
    await loadConfig(state);
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.configApplying = false;
  }
}
async function runUpdate(state) {
  if (!state.client || !state.connected) {
    return;
  }
  state.updateRunning = true;
  state.lastError = null;
  try {
    await state.client.request('update.run', {
      sessionKey: state.applySessionKey
    });
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.updateRunning = false;
  }
}
function updateConfigFormValue(state, path, value) {
  const base = cloneConfigObject(state.configForm ?? state.configSnapshot?.config ?? {});
  setPathValue(base, path, value);
  state.configForm = base;
  state.configFormDirty = true;
  if (state.configFormMode === 'form') {
    state.configRaw = serializeConfigForm(base);
  }
}
function removeConfigFormValue(state, path) {
  const base = cloneConfigObject(state.configForm ?? state.configSnapshot?.config ?? {});
  removePathValue(base, path);
  state.configForm = base;
  state.configFormDirty = true;
  if (state.configFormMode === 'form') {
    state.configRaw = serializeConfigForm(base);
  }
}
export {
  applyConfig,
  applyConfigSchema,
  applyConfigSnapshot,
  loadConfig,
  loadConfigSchema,
  removeConfigFormValue,
  runUpdate,
  saveConfig,
  updateConfigFormValue
};
