import { toNumber } from '../format.js';
async function loadSessions(state, overrides) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.sessionsLoading) {
    return;
  }
  state.sessionsLoading = true;
  state.sessionsError = null;
  try {
    const includeGlobal = overrides?.includeGlobal ?? state.sessionsIncludeGlobal;
    const includeUnknown = overrides?.includeUnknown ?? state.sessionsIncludeUnknown;
    const activeMinutes = overrides?.activeMinutes ?? toNumber(state.sessionsFilterActive, 0);
    const limit = overrides?.limit ?? toNumber(state.sessionsFilterLimit, 0);
    const params = {
      includeGlobal,
      includeUnknown
    };
    if (activeMinutes > 0) {
      params.activeMinutes = activeMinutes;
    }
    if (limit > 0) {
      params.limit = limit;
    }
    const res = await state.client.request('sessions.list', params);
    if (res) {
      state.sessionsResult = res;
    }
  } catch (err) {
    state.sessionsError = String(err);
  } finally {
    state.sessionsLoading = false;
  }
}
async function patchSession(state, key, patch) {
  if (!state.client || !state.connected) {
    return;
  }
  const params = { key };
  if ('label' in patch) {
    params.label = patch.label;
  }
  if ('thinkingLevel' in patch) {
    params.thinkingLevel = patch.thinkingLevel;
  }
  if ('verboseLevel' in patch) {
    params.verboseLevel = patch.verboseLevel;
  }
  if ('reasoningLevel' in patch) {
    params.reasoningLevel = patch.reasoningLevel;
  }
  try {
    await state.client.request('sessions.patch', params);
    await loadSessions(state);
  } catch (err) {
    state.sessionsError = String(err);
  }
}
async function deleteSession(state, key) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.sessionsLoading) {
    return;
  }
  const confirmed = window.confirm(
    `Delete session "${key}"?

Deletes the session entry and archives its transcript.`
  );
  if (!confirmed) {
    return;
  }
  state.sessionsLoading = true;
  state.sessionsError = null;
  try {
    await state.client.request('sessions.delete', { key, deleteTranscript: true });
    await loadSessions(state);
  } catch (err) {
    state.sessionsError = String(err);
  } finally {
    state.sessionsLoading = false;
  }
}
export {
  deleteSession,
  loadSessions,
  patchSession
};
