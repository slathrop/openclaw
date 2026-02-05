async function loadDebug(state) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.debugLoading) {
    return;
  }
  state.debugLoading = true;
  try {
    const [status, health, models, heartbeat] = await Promise.all([
      state.client.request('status', {}),
      state.client.request('health', {}),
      state.client.request('models.list', {}),
      state.client.request('last-heartbeat', {})
    ]);
    state.debugStatus = status;
    state.debugHealth = health;
    const modelPayload = models;
    state.debugModels = Array.isArray(modelPayload?.models) ? modelPayload?.models : [];
    state.debugHeartbeat = heartbeat;
  } catch (err) {
    state.debugCallError = String(err);
  } finally {
    state.debugLoading = false;
  }
}
async function callDebugMethod(state) {
  if (!state.client || !state.connected) {
    return;
  }
  state.debugCallError = null;
  state.debugCallResult = null;
  try {
    const params = state.debugCallParams.trim() ? JSON.parse(state.debugCallParams) : {};
    const res = await state.client.request(state.debugCallMethod.trim(), params);
    state.debugCallResult = JSON.stringify(res, null, 2);
  } catch (err) {
    state.debugCallError = String(err);
  }
}
export {
  callDebugMethod,
  loadDebug
};
