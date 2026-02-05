import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import { randomUUID } from 'node:crypto';
import { getAvailableCommands } from './commands.js';
import {
  extractAttachmentsFromPrompt,
  extractTextFromPrompt,
  formatToolTitle,
  inferToolKind
} from './event-mapper.js';
import { readBool, readNumber, readString } from './meta.js';
import { parseSessionMeta, resetSessionIfNeeded, resolveSessionKey } from './session-mapper.js';
import { defaultAcpSessionStore } from './session.js';
import { ACP_AGENT_INFO } from './types.js';
class AcpGatewayAgent {
  _connection;
  _gateway;
  _opts;
  _log;
  _sessionStore;
  _pendingPrompts = /* @__PURE__ */ new Map();
  constructor(connection, gateway, opts = {}) {
    this._connection = connection;
    this._gateway = gateway;
    this._opts = opts;
    this._log = opts.verbose ? (msg) => process.stderr.write(`[acp] ${msg}
`) : () => {
    };
    this._sessionStore = opts._sessionStore ?? defaultAcpSessionStore;
  }
  start() {
    this._log('ready');
  }
  handleGatewayReconnect() {
    this._log('gateway reconnected');
  }
  handleGatewayDisconnect(reason) {
    this._log(`gateway disconnected: ${reason}`);
    for (const pending of this._pendingPrompts.values()) {
      pending.reject(new Error(`Gateway disconnected: ${reason}`));
      this._sessionStore.clearActiveRun(pending.sessionId);
    }
    this._pendingPrompts.clear();
  }
  async handleGatewayEvent(evt) {
    if (evt.event === 'chat') {
      await this.handleChatEvent(evt);
      return;
    }
    if (evt.event === 'agent') {
      await this.handleAgentEvent(evt);
    }
  }
  // eslint-disable-next-line no-unused-vars
  async initialize(_params) {
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: true,
        promptCapabilities: {
          image: true,
          audio: false,
          embeddedContext: true
        },
        mcpCapabilities: {
          http: false,
          sse: false
        },
        sessionCapabilities: {
          list: {}
        }
      },
      agentInfo: ACP_AGENT_INFO,
      authMethods: []
    };
  }
  async newSession(params) {
    if (params.mcpServers.length > 0) {
      this._log(`ignoring ${params.mcpServers.length} MCP servers`);
    }
    const sessionId = randomUUID();
    const meta = parseSessionMeta(params._meta);
    const sessionKey = await resolveSessionKey({
      meta,
      fallbackKey: `acp:${sessionId}`,
      gateway: this._gateway,
      opts: this._opts
    });
    await resetSessionIfNeeded({
      meta,
      sessionKey,
      gateway: this._gateway,
      opts: this._opts
    });
    const session = this._sessionStore.createSession({
      sessionId,
      sessionKey,
      cwd: params.cwd
    });
    this._log(`newSession: ${session.sessionId} -> ${session.sessionKey}`);
    await this.sendAvailableCommands(session.sessionId);
    return { sessionId: session.sessionId };
  }
  async loadSession(params) {
    if (params.mcpServers.length > 0) {
      this._log(`ignoring ${params.mcpServers.length} MCP servers`);
    }
    const meta = parseSessionMeta(params._meta);
    const sessionKey = await resolveSessionKey({
      meta,
      fallbackKey: params.sessionId,
      gateway: this._gateway,
      opts: this._opts
    });
    await resetSessionIfNeeded({
      meta,
      sessionKey,
      gateway: this._gateway,
      opts: this._opts
    });
    const session = this._sessionStore.createSession({
      sessionId: params.sessionId,
      sessionKey,
      cwd: params.cwd
    });
    this._log(`loadSession: ${session.sessionId} -> ${session.sessionKey}`);
    await this.sendAvailableCommands(session.sessionId);
    return {};
  }
  async unstable_listSessions(params) {
    const limit = readNumber(params._meta, ['limit']) ?? 100;
    const result = await this._gateway.request('sessions.list', { limit });
    const cwd = params.cwd ?? process.cwd();
    return {
      sessions: result.sessions.map((session) => ({
        sessionId: session.key,
        cwd,
        title: session.displayName ?? session.label ?? session.key,
        updatedAt: session.updatedAt ? new Date(session.updatedAt).toISOString() : void 0,
        _meta: {
          sessionKey: session.key,
          kind: session.kind,
          channel: session.channel
        }
      })),
      nextCursor: null
    };
  }
  // eslint-disable-next-line no-unused-vars
  async authenticate(_params) {
    return {};
  }
  async setSessionMode(params) {
    const session = this._sessionStore.getSession(params.sessionId);
    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`);
    }
    if (!params.modeId) {
      return {};
    }
    try {
      await this._gateway.request('sessions.patch', {
        key: session.sessionKey,
        thinkingLevel: params.modeId
      });
      this._log(`setSessionMode: ${session.sessionId} -> ${params.modeId}`);
    } catch (err) {
      this._log(`setSessionMode error: ${String(err)}`);
    }
    return {};
  }
  async prompt(params) {
    const session = this._sessionStore.getSession(params.sessionId);
    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`);
    }
    if (session.abortController) {
      this._sessionStore.cancelActiveRun(params.sessionId);
    }
    const abortController = new AbortController();
    const runId = randomUUID();
    this._sessionStore.setActiveRun(params.sessionId, runId, abortController);
    const meta = parseSessionMeta(params._meta);
    const userText = extractTextFromPrompt(params.prompt);
    const attachments = extractAttachmentsFromPrompt(params.prompt);
    const prefixCwd = meta.prefixCwd ?? this._opts.prefixCwd ?? true;
    const message = prefixCwd ? `[Working directory: ${session.cwd}]

${userText}` : userText;
    return new Promise((resolve, reject) => {
      this._pendingPrompts.set(params.sessionId, {
        sessionId: params.sessionId,
        sessionKey: session.sessionKey,
        idempotencyKey: runId,
        resolve,
        reject
      });
      this._gateway.request(
        'chat.send',
        {
          sessionKey: session.sessionKey,
          message,
          attachments: attachments.length > 0 ? attachments : void 0,
          idempotencyKey: runId,
          thinking: readString(params._meta, ['thinking', 'thinkingLevel']),
          deliver: readBool(params._meta, ['deliver']),
          timeoutMs: readNumber(params._meta, ['timeoutMs'])
        },
        { expectFinal: true }
      ).catch((err) => {
        this._pendingPrompts.delete(params.sessionId);
        this._sessionStore.clearActiveRun(params.sessionId);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }
  async cancel(params) {
    const session = this._sessionStore.getSession(params.sessionId);
    if (!session) {
      return;
    }
    this._sessionStore.cancelActiveRun(params.sessionId);
    try {
      await this._gateway.request('chat.abort', { sessionKey: session.sessionKey });
    } catch (err) {
      this._log(`cancel error: ${String(err)}`);
    }
    const pending = this._pendingPrompts.get(params.sessionId);
    if (pending) {
      this._pendingPrompts.delete(params.sessionId);
      pending.resolve({ stopReason: 'cancelled' });
    }
  }
  async handleAgentEvent(evt) {
    const payload = evt.payload;
    if (!payload) {
      return;
    }
    const stream = payload.stream;
    const data = payload.data;
    const sessionKey = payload.sessionKey;
    if (!stream || !data || !sessionKey) {
      return;
    }
    if (stream !== 'tool') {
      return;
    }
    const phase = data.phase;
    const name = data.name;
    const toolCallId = data.toolCallId;
    if (!toolCallId) {
      return;
    }
    const pending = this._findPendingBySessionKey(sessionKey);
    if (!pending) {
      return;
    }
    if (phase === 'start') {
      if (!pending.toolCalls) {
        pending.toolCalls = /* @__PURE__ */ new Set();
      }
      if (pending.toolCalls.has(toolCallId)) {
        return;
      }
      pending.toolCalls.add(toolCallId);
      const args = data.args;
      await this._connection.sessionUpdate({
        sessionId: pending.sessionId,
        update: {
          sessionUpdate: 'tool_call',
          toolCallId,
          title: formatToolTitle(name, args),
          status: 'in_progress',
          rawInput: args,
          kind: inferToolKind(name)
        }
      });
      return;
    }
    if (phase === 'result') {
      const isError = Boolean(data.isError);
      await this._connection.sessionUpdate({
        sessionId: pending.sessionId,
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId,
          status: isError ? 'failed' : 'completed',
          rawOutput: data.result
        }
      });
    }
  }
  async handleChatEvent(evt) {
    const payload = evt.payload;
    if (!payload) {
      return;
    }
    const sessionKey = payload.sessionKey;
    const state = payload.state;
    const runId = payload.runId;
    const messageData = payload.message;
    if (!sessionKey || !state) {
      return;
    }
    const pending = this._findPendingBySessionKey(sessionKey);
    if (!pending) {
      return;
    }
    if (runId && pending.idempotencyKey !== runId) {
      return;
    }
    if (state === 'delta' && messageData) {
      await this.handleDeltaEvent(pending.sessionId, messageData);
      return;
    }
    if (state === 'final') {
      this._finishPrompt(pending.sessionId, pending, 'end_turn');
      return;
    }
    if (state === 'aborted') {
      this._finishPrompt(pending.sessionId, pending, 'cancelled');
      return;
    }
    if (state === 'error') {
      this._finishPrompt(pending.sessionId, pending, 'refusal');
    }
  }
  async handleDeltaEvent(sessionId, messageData) {
    const content = messageData.content;
    const fullText = content?.find((c) => c.type === 'text')?.text ?? '';
    const pending = this._pendingPrompts.get(sessionId);
    if (!pending) {
      return;
    }
    const sentSoFar = pending.sentTextLength ?? 0;
    if (fullText.length <= sentSoFar) {
      return;
    }
    const newText = fullText.slice(sentSoFar);
    pending.sentTextLength = fullText.length;
    pending.sentText = fullText;
    await this._connection.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: newText }
      }
    });
  }
  _finishPrompt(sessionId, pending, stopReason) {
    this._pendingPrompts.delete(sessionId);
    this._sessionStore.clearActiveRun(sessionId);
    pending.resolve({ stopReason });
  }
  _findPendingBySessionKey(sessionKey) {
    for (const pending of this._pendingPrompts.values()) {
      if (pending.sessionKey === sessionKey) {
        return pending;
      }
    }
    return void 0;
  }
  async sendAvailableCommands(sessionId) {
    await this._connection.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'available_commands_update',
        availableCommands: getAvailableCommands()
      }
    });
  }
}
export {
  AcpGatewayAgent
};
