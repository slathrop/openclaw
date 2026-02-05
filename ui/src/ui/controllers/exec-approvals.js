import { cloneConfigObject, removePathValue, setPathValue } from './config/form-utils.js';
function resolveExecApprovalsRpc(target) {
  if (!target || target.kind === 'gateway') {
    return { method: 'exec.approvals.get', params: {} };
  }
  const nodeId = target.nodeId.trim();
  if (!nodeId) {
    return null;
  }
  return { method: 'exec.approvals.node.get', params: { nodeId } };
}
function resolveExecApprovalsSaveRpc(target, params) {
  if (!target || target.kind === 'gateway') {
    return { method: 'exec.approvals.set', params };
  }
  const nodeId = target.nodeId.trim();
  if (!nodeId) {
    return null;
  }
  return { method: 'exec.approvals.node.set', params: { ...params, nodeId } };
}
async function loadExecApprovals(state, target) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.execApprovalsLoading) {
    return;
  }
  state.execApprovalsLoading = true;
  state.lastError = null;
  try {
    const rpc = resolveExecApprovalsRpc(target);
    if (!rpc) {
      state.lastError = 'Select a node before loading exec approvals.';
      return;
    }
    const res = await state.client.request(rpc.method, rpc.params);
    applyExecApprovalsSnapshot(state, res);
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.execApprovalsLoading = false;
  }
}
function applyExecApprovalsSnapshot(state, snapshot) {
  state.execApprovalsSnapshot = snapshot;
  if (!state.execApprovalsDirty) {
    state.execApprovalsForm = cloneConfigObject(snapshot.file ?? {});
  }
}
async function saveExecApprovals(state, target) {
  if (!state.client || !state.connected) {
    return;
  }
  state.execApprovalsSaving = true;
  state.lastError = null;
  try {
    const baseHash = state.execApprovalsSnapshot?.hash;
    if (!baseHash) {
      state.lastError = 'Exec approvals hash missing; reload and retry.';
      return;
    }
    const file = state.execApprovalsForm ?? state.execApprovalsSnapshot?.file ?? {};
    const rpc = resolveExecApprovalsSaveRpc(target, { file, baseHash });
    if (!rpc) {
      state.lastError = 'Select a node before saving exec approvals.';
      return;
    }
    await state.client.request(rpc.method, rpc.params);
    state.execApprovalsDirty = false;
    await loadExecApprovals(state, target);
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.execApprovalsSaving = false;
  }
}
function updateExecApprovalsFormValue(state, path, value) {
  const base = cloneConfigObject(
    state.execApprovalsForm ?? state.execApprovalsSnapshot?.file ?? {}
  );
  setPathValue(base, path, value);
  state.execApprovalsForm = base;
  state.execApprovalsDirty = true;
}
function removeExecApprovalsFormValue(state, path) {
  const base = cloneConfigObject(
    state.execApprovalsForm ?? state.execApprovalsSnapshot?.file ?? {}
  );
  removePathValue(base, path);
  state.execApprovalsForm = base;
  state.execApprovalsDirty = true;
}
export {
  applyExecApprovalsSnapshot,
  loadExecApprovals,
  removeExecApprovalsFormValue,
  saveExecApprovals,
  updateExecApprovalsFormValue
};
