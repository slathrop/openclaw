import fs from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { WebSocket } from 'ws';
import { getChannelPlugin } from '../channels/plugins/index.js';
import { resolveCanvasHostUrl } from '../infra/canvas-host-url.js';
import { GatewayLockError } from '../infra/gateway-lock.js';
import { getActivePluginRegistry, setActivePluginRegistry } from '../plugins/runtime.js';
import { createOutboundTestPlugin } from '../test-utils/channel-plugins.js';
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from '../utils/message-channel.js';
import {
  connectOk,
  getFreePort,
  installGatewayTestHooks,
  occupyPort,
  onceMessage,
  piSdkMock,
  rpcReq,
  startGatewayServer,
  startServerWithClient,
  testState,
  testTailnetIPv4
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
const whatsappOutbound = {
  deliveryMode: 'direct',
  sendText: async ({ deps, to, text }) => {
    if (!deps?.sendWhatsApp) {
      throw new Error('Missing sendWhatsApp dep');
    }
    return { channel: 'whatsapp', ...await deps.sendWhatsApp(to, text, {}) };
  },
  sendMedia: async ({ deps, to, text, mediaUrl }) => {
    if (!deps?.sendWhatsApp) {
      throw new Error('Missing sendWhatsApp dep');
    }
    return { channel: 'whatsapp', ...await deps.sendWhatsApp(to, text, { mediaUrl }) };
  }
};
const whatsappPlugin = createOutboundTestPlugin({
  id: 'whatsapp',
  outbound: whatsappOutbound,
  label: 'WhatsApp'
});
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
const whatsappRegistry = createRegistry([
  {
    pluginId: 'whatsapp',
    source: 'test',
    plugin: whatsappPlugin
  }
]);
const emptyRegistry = createRegistry([]);
describe('gateway server models + voicewake', () => {
  const setTempHome = (homeDir) => {
    const prevHome = process.env.HOME;
    const prevStateDir = process.env.OPENCLAW_STATE_DIR;
    const prevUserProfile = process.env.USERPROFILE;
    const prevHomeDrive = process.env.HOMEDRIVE;
    const prevHomePath = process.env.HOMEPATH;
    process.env.HOME = homeDir;
    process.env.OPENCLAW_STATE_DIR = path.join(homeDir, '.openclaw');
    process.env.USERPROFILE = homeDir;
    if (process.platform === 'win32') {
      const parsed = path.parse(homeDir);
      process.env.HOMEDRIVE = parsed.root.replace(/\\$/, '');
      process.env.HOMEPATH = homeDir.slice(Math.max(parsed.root.length - 1, 0));
    }
    return () => {
      if (prevHome === void 0) {
        delete process.env.HOME;
      } else {
        process.env.HOME = prevHome;
      }
      if (prevStateDir === void 0) {
        delete process.env.OPENCLAW_STATE_DIR;
      } else {
        process.env.OPENCLAW_STATE_DIR = prevStateDir;
      }
      if (prevUserProfile === void 0) {
        delete process.env.USERPROFILE;
      } else {
        process.env.USERPROFILE = prevUserProfile;
      }
      if (process.platform === 'win32') {
        if (prevHomeDrive === void 0) {
          delete process.env.HOMEDRIVE;
        } else {
          process.env.HOMEDRIVE = prevHomeDrive;
        }
        if (prevHomePath === void 0) {
          delete process.env.HOMEPATH;
        } else {
          process.env.HOMEPATH = prevHomePath;
        }
      }
    };
  };
  test(
    'voicewake.get returns defaults and voicewake.set broadcasts',
    { timeout: 6e4 },
    async () => {
      const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-home-'));
      const restoreHome = setTempHome(homeDir);
      const initial = await rpcReq(ws, 'voicewake.get');
      expect(initial.ok).toBe(true);
      expect(initial.payload?.triggers).toEqual(['openclaw', 'claude', 'computer']);
      const changedP = onceMessage(ws, (o) => o.type === 'event' && o.event === 'voicewake.changed');
      const setRes = await rpcReq(ws, 'voicewake.set', {
        triggers: ['  hi  ', '', 'there']
      });
      expect(setRes.ok).toBe(true);
      expect(setRes.payload?.triggers).toEqual(['hi', 'there']);
      const changed = await changedP;
      expect(changed.event).toBe('voicewake.changed');
      expect(changed.payload?.triggers).toEqual([
        'hi',
        'there'
      ]);
      const after = await rpcReq(ws, 'voicewake.get');
      expect(after.ok).toBe(true);
      expect(after.payload?.triggers).toEqual(['hi', 'there']);
      const onDisk = JSON.parse(
        await fs.readFile(path.join(homeDir, '.openclaw', 'settings', 'voicewake.json'), 'utf8')
      );
      expect(onDisk.triggers).toEqual(['hi', 'there']);
      expect(typeof onDisk.updatedAtMs).toBe('number');
      restoreHome();
    }
  );
  test('pushes voicewake.changed to nodes on connect and on updates', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-home-'));
    const restoreHome = setTempHome(homeDir);
    const nodeWs = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((resolve) => nodeWs.once('open', resolve));
    const firstEventP = onceMessage(
      nodeWs,
      (o) => o.type === 'event' && o.event === 'voicewake.changed'
    );
    await connectOk(nodeWs, {
      role: 'node',
      client: {
        id: GATEWAY_CLIENT_NAMES.NODE_HOST,
        version: '1.0.0',
        platform: 'ios',
        mode: GATEWAY_CLIENT_MODES.NODE
      }
    });
    const first = await firstEventP;
    expect(first.event).toBe('voicewake.changed');
    expect(first.payload?.triggers).toEqual([
      'openclaw',
      'claude',
      'computer'
    ]);
    const broadcastP = onceMessage(
      nodeWs,
      (o) => o.type === 'event' && o.event === 'voicewake.changed'
    );
    const setRes = await rpcReq(ws, 'voicewake.set', {
      triggers: ['openclaw', 'computer']
    });
    expect(setRes.ok).toBe(true);
    const broadcast = await broadcastP;
    expect(broadcast.event).toBe('voicewake.changed');
    expect(broadcast.payload?.triggers).toEqual([
      'openclaw',
      'computer'
    ]);
    nodeWs.close();
    restoreHome();
  });
  test('models.list returns model catalog', async () => {
    piSdkMock.enabled = true;
    piSdkMock.models = [
      { id: 'gpt-test-z', provider: 'openai', contextWindow: 0 },
      {
        id: 'gpt-test-a',
        name: 'A-Model',
        provider: 'openai',
        contextWindow: 8e3
      },
      {
        id: 'claude-test-b',
        name: 'B-Model',
        provider: 'anthropic',
        contextWindow: 1e3
      },
      {
        id: 'claude-test-a',
        name: 'A-Model',
        provider: 'anthropic',
        contextWindow: 2e5
      }
    ];
    const res1 = await rpcReq(ws, 'models.list');
    const res2 = await rpcReq(ws, 'models.list');
    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    const models = res1.payload?.models ?? [];
    expect(models).toEqual([
      {
        id: 'claude-test-a',
        name: 'A-Model',
        provider: 'anthropic',
        contextWindow: 2e5
      },
      {
        id: 'claude-test-b',
        name: 'B-Model',
        provider: 'anthropic',
        contextWindow: 1e3
      },
      {
        id: 'gpt-test-a',
        name: 'A-Model',
        provider: 'openai',
        contextWindow: 8e3
      },
      {
        id: 'gpt-test-z',
        name: 'gpt-test-z',
        provider: 'openai'
      }
    ]);
    expect(piSdkMock.discoverCalls).toBe(1);
  });
  test('models.list rejects unknown params', async () => {
    piSdkMock.enabled = true;
    piSdkMock.models = [{ id: 'gpt-test-a', name: 'A', provider: 'openai' }];
    const res = await rpcReq(ws, 'models.list', { extra: true });
    expect(res.ok).toBe(false);
    expect(res.error?.message ?? '').toMatch(/invalid models\.list params/i);
  });
});
describe('gateway server misc', () => {
  test('hello-ok advertises the gateway port for canvas host', async () => {
    const prevToken = process.env.OPENCLAW_GATEWAY_TOKEN;
    const prevCanvasPort = process.env.OPENCLAW_CANVAS_HOST_PORT;
    process.env.OPENCLAW_GATEWAY_TOKEN = 'secret';
    testTailnetIPv4.value = '100.64.0.1';
    testState.gatewayBind = 'lan';
    const canvasPort = await getFreePort();
    testState.canvasHostPort = canvasPort;
    process.env.OPENCLAW_CANVAS_HOST_PORT = String(canvasPort);
    const testPort = await getFreePort();
    const canvasHostUrl = resolveCanvasHostUrl({
      canvasPort,
      requestHost: `100.64.0.1:${testPort}`,
      localAddress: '127.0.0.1'
    });
    expect(canvasHostUrl).toBe(`http://100.64.0.1:${canvasPort}`);
    if (prevToken === void 0) {
      delete process.env.OPENCLAW_GATEWAY_TOKEN;
    } else {
      process.env.OPENCLAW_GATEWAY_TOKEN = prevToken;
    }
    if (prevCanvasPort === void 0) {
      delete process.env.OPENCLAW_CANVAS_HOST_PORT;
    } else {
      process.env.OPENCLAW_CANVAS_HOST_PORT = prevCanvasPort;
    }
  });
  test('send dedupes by idempotencyKey', { timeout: 6e4 }, async () => {
    const prevRegistry = getActivePluginRegistry() ?? emptyRegistry;
    try {
      setActivePluginRegistry(whatsappRegistry);
      expect(getChannelPlugin('whatsapp')).toBeDefined();
      const idem = 'same-key';
      const res1P = onceMessage(ws, (o) => o.type === 'res' && o.id === 'a1');
      const res2P = onceMessage(ws, (o) => o.type === 'res' && o.id === 'a2');
      const sendReq = (id) => ws.send(
        JSON.stringify({
          type: 'req',
          id,
          method: 'send',
          params: { to: '+15550000000', message: 'hi', idempotencyKey: idem }
        })
      );
      sendReq('a1');
      sendReq('a2');
      const res1 = await res1P;
      const res2 = await res2P;
      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);
      expect(res1.payload).toEqual(res2.payload);
    } finally {
      setActivePluginRegistry(prevRegistry);
    }
  });
  test('auto-enables configured channel plugins on startup', async () => {
    const configPath = process.env.OPENCLAW_CONFIG_PATH;
    if (!configPath) {
      throw new Error('Missing OPENCLAW_CONFIG_PATH');
    }
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify(
        {
          channels: {
            discord: {
              token: 'token-123'
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );
    const autoPort = await getFreePort();
    const autoServer = await startGatewayServer(autoPort);
    await autoServer.close();
    const updated = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    const plugins = updated.plugins;
    const entries = plugins?.entries;
    const discord = entries?.discord;
    expect(discord?.enabled).toBe(true);
    expect(updated.channels?.discord).toMatchObject({
      token: 'token-123'
    });
  });
  test('refuses to start when port already bound', async () => {
    const { server: blocker, port: blockedPort } = await occupyPort();
    await expect(startGatewayServer(blockedPort)).rejects.toBeInstanceOf(GatewayLockError);
    await expect(startGatewayServer(blockedPort)).rejects.toThrow(/already listening/i);
    blocker.close();
  });
  test('releases port after close', async () => {
    const releasePort = await getFreePort();
    const releaseServer = await startGatewayServer(releasePort);
    await releaseServer.close();
    const probe = createServer();
    await new Promise((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(releasePort, '127.0.0.1', () => resolve());
    });
    await new Promise(
      (resolve, reject) => probe.close((err) => err ? reject(err) : resolve())
    );
  });
});
