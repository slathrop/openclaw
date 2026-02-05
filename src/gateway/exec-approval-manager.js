/** @module gateway/exec-approval-manager -- Manages pending execution approval requests with timeout tracking. */
import { randomUUID } from 'node:crypto';
class ExecApprovalManager {
  _pending = /* @__PURE__ */ new Map();
  create(request, timeoutMs, id) {
    const now = Date.now();
    const resolvedId = id && id.trim().length > 0 ? id.trim() : randomUUID();
    const record = {
      id: resolvedId,
      request,
      createdAtMs: now,
      expiresAtMs: now + timeoutMs
    };
    return record;
  }
  async waitForDecision(record, timeoutMs) {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(record.id);
        resolve(null);
      }, timeoutMs);
      this._pending.set(record.id, { record, resolve, reject, timer });
    });
  }
  resolve(recordId, decision, resolvedBy) {
    const pending = this._pending.get(recordId);
    if (!pending) {
      return false;
    }
    clearTimeout(pending.timer);
    pending.record.resolvedAtMs = Date.now();
    pending.record.decision = decision;
    pending.record.resolvedBy = resolvedBy ?? null;
    this._pending.delete(recordId);
    pending.resolve(decision);
    return true;
  }
  getSnapshot(recordId) {
    const entry = this._pending.get(recordId);
    return entry?.record ?? null;
  }
}
export {
  ExecApprovalManager
};
