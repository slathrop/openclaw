import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { WebSocket } from 'ws';
import { whatsappPlugin } from '../../extensions/whatsapp/src/channel.js';
import { emitAgentEvent, registerAgentRunContext } from '../infra/agent-events.js';
import { setActivePluginRegistry } from '../plugins/runtime.js';
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from '../utils/message-channel.js';
import {
  agentCommand,
  connectOk,
  getFreePort,
  installGatewayTestHooks,
  onceMessage,
  rpcReq,
  startGatewayServer,
  startServerWithClient,
  testState,
  writeSessionStore
} from './test-helpers.js';
installGatewayTestHooks({ scope: 'suite' });
let server;
let ws;
let port;
beforeAll(async () => {
  const started = await startServerWithClient();
  server = started.server;
  ws = started.ws;
  port = started.port;
  await connectOk(ws);
});
afterAll(async () => {
  ws.close();
  await server.close();
});
const registryState = vi.hoisted(() => ({
  registry: {
    plugins: [],
    tools: [],
    channels: [],
    providers: [],
    gatewayHandlers: {},
    httpHandlers: [],
    httpRoutes: [],
    cliRegistrars: [],
    services: [],
    diagnostics: []
  }
}));
vi.mock('./server-plugins.js', async () => {
  const { setActivePluginRegistry: setActivePluginRegistry2 } = await import('../plugins/runtime.js');
  return {
    loadGatewayPlugins: (params) => {
      setActivePluginRegistry2(registryState.registry);
      return {
        pluginRegistry: registryState.registry,
        gatewayMethods: params.baseMethods ?? []
      };
    }
  };
});
// eslint-disable-next-line no-unused-vars -- kept as reference for image attachment tests
const _BASE_IMAGE_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X3mIAAAAASUVORK5CYII=';
const createRegistry = (channels) => ({
  plugins: [],
  tools: [],
  channels,
  providers: [],
  gatewayHandlers: {},
  httpHandlers: [],
  httpRoutes: [],
  cliRegistrars: [],
  services: [],
  diagnostics: []
});
const createMSTeamsPlugin = (params) => ({
  id: 'msteams',
  meta: {
    id: 'msteams',
    label: 'Microsoft Teams',
    selectionLabel: 'Microsoft Teams (Bot Framework)',
    docsPath: '/channels/msteams',
    blurb: 'Bot Framework; enterprise support.',
    aliases: params?.aliases
  },
  capabilities: { chatTypes: ['direct'] },
  config: {
    listAccountIds: () => [],
    resolveAccount: () => ({})
  }
});
const emptyRegistry = createRegistry([]);
const defaultRegistry = createRegistry([
  {
    pluginId: 'whatsapp',
    source: 'test',
    plugin: whatsappPlugin
  }
]);
function expectChannels(call, channel) {
  expect(call.channel).toBe(channel);
  expect(call.messageChannel).toBe(channel);
}
describe('gateway server agent', () => {
  beforeEach(() => {
    registryState.registry = defaultRegistry;
    setActivePluginRegistry(defaultRegistry);
  });
  afterEach(() => {
    registryState.registry = emptyRegistry;
    setActivePluginRegistry(emptyRegistry);
  });
  test('agent routes main last-channel msteams', async () => {
    const registry = createRegistry([
      {
        pluginId: 'msteams',
        source: 'test',
        plugin: createMSTeamsPlugin()
      }
    ]);
    registryState.registry = registry;
    setActivePluginRegistry(registry);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-gw-'));
    testState.sessionStorePath = path.join(dir, 'sessions.json');
    await writeSessionStore({
      entries: {
        main: {
          sessionId: 'sess-teams',
          updatedAt: Date.now(),
          lastChannel: 'msteams',
          lastTo: 'conversation:teams-123'
        }
      }
    });
    const res = await rpcReq(ws, 'agent', {
      message: 'hi',
      sessionKey: 'main',
      channel: 'last',
      deliver: true,
      idempotencyKey: 'idem-agent-last-msteams'
    });
    expect(res.ok).toBe(true);
    const spy = vi.mocked(agentCommand);
    const call = spy.mock.calls.at(-1)?.[0];
    expectChannels(call, 'msteams');
    expect(call.to).toBe('conversation:teams-123');
    expect(call.deliver).toBe(true);
    expect(call.bestEffortDeliver).toBe(true);
    expect(call.sessionId).toBe('sess-teams');
  });
  test('agent accepts channel aliases (imsg/teams)', async () => {
    const registry = createRegistry([
      {
        pluginId: 'msteams',
        source: 'test',
        plugin: createMSTeamsPlugin({ aliases: ['teams'] })
      }
    ]);
    registryState.registry = registry;
    setActivePluginRegistry(registry);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-gw-'));
    testState.sessionStorePath = path.join(dir, 'sessions.json');
    await writeSessionStore({
      entries: {
        main: {
          sessionId: 'sess-alias',
          updatedAt: Date.now(),
          lastChannel: 'imessage',
          lastTo: 'chat_id:123'
        }
      }
    });
    const resIMessage = await rpcReq(ws, 'agent', {
      message: 'hi',
      sessionKey: 'main',
      channel: 'imsg',
      deliver: true,
      idempotencyKey: 'idem-agent-imsg'
    });
    expect(resIMessage.ok).toBe(true);
    const resTeams = await rpcReq(ws, 'agent', {
      message: 'hi',
      sessionKey: 'main',
      channel: 'teams',
      to: 'conversation:teams-abc',
      deliver: false,
      idempotencyKey: 'idem-agent-teams'
    });
    expect(resTeams.ok).toBe(true);
    const spy = vi.mocked(agentCommand);
    const lastIMessageCall = spy.mock.calls.at(-2)?.[0];
    expectChannels(lastIMessageCall, 'imessage');
    expect(lastIMessageCall.to).toBe('chat_id:123');
    const lastTeamsCall = spy.mock.calls.at(-1)?.[0];
    expectChannels(lastTeamsCall, 'msteams');
    expect(lastTeamsCall.to).toBe('conversation:teams-abc');
  });
  test('agent rejects unknown channel', async () => {
    const res = await rpcReq(ws, 'agent', {
      message: 'hi',
      sessionKey: 'main',
      channel: 'sms',
      idempotencyKey: 'idem-agent-bad-channel'
    });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INVALID_REQUEST');
  });
  test('agent ignores webchat last-channel for routing', async () => {
    testState.allowFrom = ['+1555'];
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-gw-'));
    testState.sessionStorePath = path.join(dir, 'sessions.json');
    await writeSessionStore({
      entries: {
        main: {
          sessionId: 'sess-main-webchat',
          updatedAt: Date.now(),
          lastChannel: 'webchat',
          lastTo: '+1555'
        }
      }
    });
    const res = await rpcReq(ws, 'agent', {
      message: 'hi',
      sessionKey: 'main',
      channel: 'last',
      deliver: true,
      idempotencyKey: 'idem-agent-webchat'
    });
    expect(res.ok).toBe(true);
    const spy = vi.mocked(agentCommand);
    const call = spy.mock.calls.at(-1)?.[0];
    expectChannels(call, 'whatsapp');
    expect(call.to).toBe('+1555');
    expect(call.deliver).toBe(true);
    expect(call.bestEffortDeliver).toBe(true);
    expect(call.sessionId).toBe('sess-main-webchat');
  });
  test('agent uses webchat for internal runs when last provider is webchat', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-gw-'));
    testState.sessionStorePath = path.join(dir, 'sessions.json');
    await writeSessionStore({
      entries: {
        main: {
          sessionId: 'sess-main-webchat-internal',
          updatedAt: Date.now(),
          lastChannel: 'webchat',
          lastTo: '+1555'
        }
      }
    });
    const res = await rpcReq(ws, 'agent', {
      message: 'hi',
      sessionKey: 'main',
      channel: 'last',
      deliver: false,
      idempotencyKey: 'idem-agent-webchat-internal'
    });
    expect(res.ok).toBe(true);
    const spy = vi.mocked(agentCommand);
    const call = spy.mock.calls.at(-1)?.[0];
    expectChannels(call, 'webchat');
    expect(call.to).toBeUndefined();
    expect(call.deliver).toBe(false);
    expect(call.bestEffortDeliver).toBe(true);
    expect(call.sessionId).toBe('sess-main-webchat-internal');
  });
  test('agent ack response then final response', { timeout: 8e3 }, async () => {
    const ackP = onceMessage(
      ws,
      (o) => o.type === 'res' && o.id === 'ag1' && o.payload?.status === 'accepted'
    );
    const finalP = onceMessage(
      ws,
      (o) => o.type === 'res' && o.id === 'ag1' && o.payload?.status !== 'accepted'
    );
    ws.send(
      JSON.stringify({
        type: 'req',
        id: 'ag1',
        method: 'agent',
        params: { message: 'hi', idempotencyKey: 'idem-ag' }
      })
    );
    const ack = await ackP;
    const final = await finalP;
    expect(ack.payload.runId).toBeDefined();
    expect(final.payload.runId).toBe(ack.payload.runId);
    expect(final.payload.status).toBe('ok');
  });
  test('agent dedupes by idempotencyKey after completion', async () => {
    const firstFinalP = onceMessage(
      ws,
      (o) => o.type === 'res' && o.id === 'ag1' && o.payload?.status !== 'accepted'
    );
    ws.send(
      JSON.stringify({
        type: 'req',
        id: 'ag1',
        method: 'agent',
        params: { message: 'hi', idempotencyKey: 'same-agent' }
      })
    );
    const firstFinal = await firstFinalP;
    const secondP = onceMessage(ws, (o) => o.type === 'res' && o.id === 'ag2');
    ws.send(
      JSON.stringify({
        type: 'req',
        id: 'ag2',
        method: 'agent',
        params: { message: 'hi again', idempotencyKey: 'same-agent' }
      })
    );
    const second = await secondP;
    expect(second.payload).toEqual(firstFinal.payload);
  });
  test('agent dedupe survives reconnect', { timeout: 6e4 }, async () => {
    const port2 = await getFreePort();
    const server2 = await startGatewayServer(port2);
    const dial = async () => {
      const ws3 = new WebSocket(`ws://127.0.0.1:${port2}`);
      await new Promise((resolve) => ws3.once('open', resolve));
      await connectOk(ws3);
      return ws3;
    };
    const idem = 'reconnect-agent';
    const ws1 = await dial();
    const final1P = onceMessage(
      ws1,
      (o) => o.type === 'res' && o.id === 'ag1' && o.payload?.status !== 'accepted',
      6e3
    );
    ws1.send(
      JSON.stringify({
        type: 'req',
        id: 'ag1',
        method: 'agent',
        params: { message: 'hi', idempotencyKey: idem }
      })
    );
    const final1 = await final1P;
    ws1.close();
    const ws2 = await dial();
    const final2P = onceMessage(
      ws2,
      (o) => o.type === 'res' && o.id === 'ag2' && o.payload?.status !== 'accepted',
      6e3
    );
    ws2.send(
      JSON.stringify({
        type: 'req',
        id: 'ag2',
        method: 'agent',
        params: { message: 'hi again', idempotencyKey: idem }
      })
    );
    const res = await final2P;
    expect(res.payload).toEqual(final1.payload);
    ws2.close();
    await server2.close();
  });
  test('agent events stream to webchat clients when run context is registered', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-gw-'));
    testState.sessionStorePath = path.join(dir, 'sessions.json');
    await writeSessionStore({
      entries: {
        main: {
          sessionId: 'sess-main',
          updatedAt: Date.now()
        }
      }
    });
    const webchatWs = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((resolve) => webchatWs.once('open', resolve));
    await connectOk(webchatWs, {
      client: {
        id: GATEWAY_CLIENT_NAMES.WEBCHAT,
        version: '1.0.0',
        platform: 'test',
        mode: GATEWAY_CLIENT_MODES.WEBCHAT
      }
    });
    registerAgentRunContext('run-auto-1', { sessionKey: 'main' });
    const finalChatP = onceMessage(
      webchatWs,
      (o) => {
        if (o.type !== 'event' || o.event !== 'chat') {
          return false;
        }
        const payload2 = o.payload;
        return payload2?.state === 'final' && payload2.runId === 'run-auto-1';
      },
      8e3
    );
    emitAgentEvent({
      runId: 'run-auto-1',
      stream: 'assistant',
      data: { text: 'hi from agent' }
    });
    emitAgentEvent({
      runId: 'run-auto-1',
      stream: 'lifecycle',
      data: { phase: 'end' }
    });
    const evt = await finalChatP;
    const payload = evt.payload && typeof evt.payload === 'object' ? evt.payload : {};
    expect(payload.sessionKey).toBe('main');
    expect(payload.runId).toBe('run-auto-1');
    webchatWs.close();
  });
});
