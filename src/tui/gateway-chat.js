import { randomUUID } from 'node:crypto';
import { loadConfig, resolveGatewayPort } from '../config/config.js';
import { GatewayClient } from '../gateway/client.js';
import { GATEWAY_CLIENT_CAPS } from '../gateway/protocol/client-info.js';
import {
  PROTOCOL_VERSION
} from '../gateway/protocol/index.js';
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from '../utils/message-channel.js';
import { VERSION } from '../version.js';
class GatewayChatClient {
  _client;
  _readyPromise;
  _resolveReady;
  connection;
  hello;
  onEvent;
  onConnected;
  onDisconnected;
  onGap;
  constructor(opts) {
    const resolved = resolveGatewayConnection(opts);
    this.connection = resolved;
    this._readyPromise = new Promise((resolve) => {
      this._resolveReady = resolve;
    });
    this._client = new GatewayClient({
      url: resolved.url,
      token: resolved.token,
      password: resolved.password,
      clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
      clientDisplayName: 'openclaw-tui',
      clientVersion: VERSION,
      platform: process.platform,
      mode: GATEWAY_CLIENT_MODES.UI,
      caps: [GATEWAY_CLIENT_CAPS.TOOL_EVENTS],
      instanceId: randomUUID(),
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      onHelloOk: (hello) => {
        this.hello = hello;
        this._resolveReady?.();
        this.onConnected?.();
      },
      onEvent: (evt) => {
        this.onEvent?.({
          event: evt.event,
          payload: evt.payload,
          seq: evt.seq
        });
      },
      onClose: (_code, reason) => {
        this.onDisconnected?.(reason);
      },
      onGap: (info) => {
        this.onGap?.(info);
      }
    });
  }
  start() {
    this._client.start();
  }
  stop() {
    this._client.stop();
  }
  async waitForReady() {
    await this._readyPromise;
  }
  async sendChat(opts) {
    const runId = opts.runId ?? randomUUID();
    await this._client.request('chat.send', {
      sessionKey: opts.sessionKey,
      message: opts.message,
      thinking: opts.thinking,
      deliver: opts.deliver,
      timeoutMs: opts.timeoutMs,
      idempotencyKey: runId
    });
    return { runId };
  }
  async abortChat(opts) {
    return await this._client.request('chat.abort', {
      sessionKey: opts.sessionKey,
      runId: opts.runId
    });
  }
  async loadHistory(opts) {
    return await this._client.request('chat.history', {
      sessionKey: opts.sessionKey,
      limit: opts.limit
    });
  }
  async listSessions(opts) {
    return await this._client.request('sessions.list', {
      limit: opts?.limit,
      activeMinutes: opts?.activeMinutes,
      includeGlobal: opts?.includeGlobal,
      includeUnknown: opts?.includeUnknown,
      includeDerivedTitles: opts?.includeDerivedTitles,
      includeLastMessage: opts?.includeLastMessage,
      agentId: opts?.agentId
    });
  }
  async listAgents() {
    return await this._client.request('agents.list', {});
  }
  async patchSession(opts) {
    return await this._client.request('sessions.patch', opts);
  }
  async resetSession(key) {
    return await this._client.request('sessions.reset', { key });
  }
  async getStatus() {
    return await this._client.request('status');
  }
  async listModels() {
    const res = await this._client.request('models.list');
    return Array.isArray(res?.models) ? res.models : [];
  }
}
function resolveGatewayConnection(opts) {
  const config = loadConfig();
  const isRemoteMode = config.gateway?.mode === 'remote';
  const remote = isRemoteMode ? config.gateway?.remote : void 0;
  const authToken = config.gateway?.auth?.token;
  const localPort = resolveGatewayPort(config);
  const url = (typeof opts.url === 'string' && opts.url.trim().length > 0 ? opts.url.trim() : void 0) || (typeof remote?.url === 'string' && remote.url.trim().length > 0 ? remote.url.trim() : void 0) || `ws://127.0.0.1:${localPort}`;
  const token = (typeof opts.token === 'string' && opts.token.trim().length > 0 ? opts.token.trim() : void 0) || (isRemoteMode ? typeof remote?.token === 'string' && remote.token.trim().length > 0 ? remote.token.trim() : void 0 : process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || (typeof authToken === 'string' && authToken.trim().length > 0 ? authToken.trim() : void 0));
  const password = (typeof opts.password === 'string' && opts.password.trim().length > 0 ? opts.password.trim() : void 0) || process.env.OPENCLAW_GATEWAY_PASSWORD?.trim() || (typeof remote?.password === 'string' && remote.password.trim().length > 0 ? remote.password.trim() : void 0);
  return { url, token, password };
}
export {
  GatewayChatClient,
  resolveGatewayConnection
};
