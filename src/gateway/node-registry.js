/** @module gateway/node-registry -- Registry for connected compute nodes with invoke/event dispatching. */
import { randomUUID } from 'node:crypto';
class NodeRegistry {
  _nodesById = /* @__PURE__ */ new Map();
  _nodesByConn = /* @__PURE__ */ new Map();
  _pendingInvokes = /* @__PURE__ */ new Map();
  register(client, opts) {
    const connect = client.connect;
    const nodeId = connect.device?.id ?? connect.client.id;
    const caps = Array.isArray(connect.caps) ? connect.caps : [];
    const commands = Array.isArray(connect.commands) ? connect.commands ?? [] : [];
    const permissions = typeof connect.permissions === 'object' ? connect.permissions ?? void 0 : void 0;
    const pathEnv = typeof connect.pathEnv === 'string' ? connect.pathEnv : void 0;
    const session = {
      nodeId,
      connId: client.connId,
      client,
      displayName: connect.client.displayName,
      platform: connect.client.platform,
      version: connect.client.version,
      coreVersion: connect.coreVersion,
      uiVersion: connect.uiVersion,
      deviceFamily: connect.client.deviceFamily,
      modelIdentifier: connect.client.modelIdentifier,
      remoteIp: opts.remoteIp,
      caps,
      commands,
      permissions,
      pathEnv,
      connectedAtMs: Date.now()
    };
    this._nodesById.set(nodeId, session);
    this._nodesByConn.set(client.connId, nodeId);
    return session;
  }
  unregister(connId) {
    const nodeId = this._nodesByConn.get(connId);
    if (!nodeId) {
      return null;
    }
    this._nodesByConn.delete(connId);
    this._nodesById.delete(nodeId);
    for (const [id, pending] of this._pendingInvokes.entries()) {
      if (pending.nodeId !== nodeId) {
        continue;
      }
      clearTimeout(pending.timer);
      pending.reject(new Error(`node disconnected (${pending.command})`));
      this._pendingInvokes.delete(id);
    }
    return nodeId;
  }
  listConnected() {
    return [...this._nodesById.values()];
  }
  get(nodeId) {
    return this._nodesById.get(nodeId);
  }
  async invoke(params) {
    const node = this._nodesById.get(params.nodeId);
    if (!node) {
      return {
        ok: false,
        error: { code: 'NOT_CONNECTED', message: 'node not connected' }
      };
    }
    const requestId = randomUUID();
    const payload = {
      id: requestId,
      nodeId: params.nodeId,
      command: params.command,
      paramsJSON: 'params' in params && params.params !== void 0 ? JSON.stringify(params.params) : null,
      timeoutMs: params.timeoutMs,
      idempotencyKey: params.idempotencyKey
    };
    const ok = this._sendEventToSession(node, 'node.invoke.request', payload);
    if (!ok) {
      return {
        ok: false,
        error: { code: 'UNAVAILABLE', message: 'failed to send invoke to node' }
      };
    }
    const timeoutMs = typeof params.timeoutMs === 'number' ? params.timeoutMs : 3e4;
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingInvokes.delete(requestId);
        resolve({
          ok: false,
          error: { code: 'TIMEOUT', message: 'node invoke timed out' }
        });
      }, timeoutMs);
      this._pendingInvokes.set(requestId, {
        nodeId: params.nodeId,
        command: params.command,
        resolve,
        reject,
        timer
      });
    });
  }
  handleInvokeResult(params) {
    const pending = this._pendingInvokes.get(params.id);
    if (!pending) {
      return false;
    }
    if (pending.nodeId !== params.nodeId) {
      return false;
    }
    clearTimeout(pending.timer);
    this._pendingInvokes.delete(params.id);
    pending.resolve({
      ok: params.ok,
      payload: params.payload,
      payloadJSON: params.payloadJSON ?? null,
      error: params.error ?? null
    });
    return true;
  }
  sendEvent(nodeId, event, payload) {
    const node = this._nodesById.get(nodeId);
    if (!node) {
      return false;
    }
    return this._sendEventToSession(node, event, payload);
  }
  _sendEventInternal(node, event, payload) {
    try {
      node.client.socket.send(
        JSON.stringify({
          type: 'event',
          event,
          payload
        })
      );
      return true;
    } catch {
      return false;
    }
  }
  _sendEventToSession(node, event, payload) {
    return this._sendEventInternal(node, event, payload);
  }
}
export {
  NodeRegistry
};
