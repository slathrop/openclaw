import fs from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from 'vitest';
import { WebSocket } from 'ws';
import { resolveMainSessionKeyFromConfig } from '../config/sessions.js';
import { resetAgentRunContextForTest } from '../infra/agent-events.js';
import {
  loadOrCreateDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload
} from '../infra/device-identity.js';
import { drainSystemEvents, peekSystemEvents } from '../infra/system-events.js';
import { rawDataToString } from '../infra/ws.js';
import { resetLogger, setLoggerOverride } from '../logging.js';
import { DEFAULT_AGENT_ID, toAgentStoreSessionKey } from '../routing/session-key.js';
import { getDeterministicFreePortBlock } from '../test-utils/ports.js';
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from '../utils/message-channel.js';
import { buildDeviceAuthPayload } from './device-auth.js';
import { PROTOCOL_VERSION } from './protocol/index.js';
import {
  agentCommand,
  cronIsolatedRun,
  embeddedRunMock,
  piSdkMock,
  sessionStoreSaveDelayMs,
  setTestConfigRoot,
  testIsNixMode,
  testTailscaleWhois,
  testState,
  testTailnetIPv4
} from './test-helpers.mocks.js';
const serverModulePromise = import('./server.js');
let previousHome;
let previousUserProfile;
let previousStateDir;
let previousConfigPath;
let previousSkipBrowserControl;
let previousSkipGmailWatcher;
let previousSkipCanvasHost;
let tempHome;
let tempConfigRoot;
async function writeSessionStore(params) {
  const storePath = params.storePath ?? testState.sessionStorePath;
  if (!storePath) {
    throw new Error('writeSessionStore requires testState.sessionStorePath');
  }
  const agentId = params.agentId ?? DEFAULT_AGENT_ID;
  const store = {};
  for (const [requestKey, entry] of Object.entries(params.entries)) {
    const rawKey = requestKey.trim();
    const storeKey = rawKey === 'global' || rawKey === 'unknown' ? rawKey : toAgentStoreSessionKey({
      agentId,
      requestKey,
      mainKey: params.mainKey
    });
    store[storeKey] = entry;
  }
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), 'utf-8');
}
async function setupGatewayTestHome() {
  previousHome = process.env.HOME;
  previousUserProfile = process.env.USERPROFILE;
  previousStateDir = process.env.OPENCLAW_STATE_DIR;
  previousConfigPath = process.env.OPENCLAW_CONFIG_PATH;
  previousSkipBrowserControl = process.env.OPENCLAW_SKIP_BROWSER_CONTROL_SERVER;
  previousSkipGmailWatcher = process.env.OPENCLAW_SKIP_GMAIL_WATCHER;
  previousSkipCanvasHost = process.env.OPENCLAW_SKIP_CANVAS_HOST;
  tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-gateway-home-'));
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
  process.env.OPENCLAW_STATE_DIR = path.join(tempHome, '.openclaw');
  delete process.env.OPENCLAW_CONFIG_PATH;
}
function applyGatewaySkipEnv() {
  process.env.OPENCLAW_SKIP_BROWSER_CONTROL_SERVER = '1';
  process.env.OPENCLAW_SKIP_GMAIL_WATCHER = '1';
  process.env.OPENCLAW_SKIP_CANVAS_HOST = '1';
}
async function resetGatewayTestState(options) {
  vi.useRealTimers();
  setLoggerOverride({ level: 'silent', consoleLevel: 'silent' });
  if (!tempHome) {
    throw new Error('resetGatewayTestState called before temp home was initialized');
  }
  applyGatewaySkipEnv();
  tempConfigRoot = options.uniqueConfigRoot ? await fs.mkdtemp(path.join(tempHome, 'openclaw-test-')) : path.join(tempHome, '.openclaw-test');
  setTestConfigRoot(tempConfigRoot);
  sessionStoreSaveDelayMs.value = 0;
  testTailnetIPv4.value = void 0;
  testTailscaleWhois.value = null;
  testState.gatewayBind = void 0;
  testState.gatewayAuth = { mode: 'token', token: 'test-gateway-token-1234567890' };
  testState.gatewayControlUi = void 0;
  testState.hooksConfig = void 0;
  testState.canvasHostPort = void 0;
  testState.legacyIssues = [];
  testState.legacyParsed = {};
  testState.migrationConfig = null;
  testState.migrationChanges = [];
  testState.cronEnabled = false;
  testState.cronStorePath = void 0;
  testState.sessionConfig = void 0;
  testState.sessionStorePath = void 0;
  testState.agentConfig = void 0;
  testState.agentsConfig = void 0;
  testState.bindingsConfig = void 0;
  testState.channelsConfig = void 0;
  testState.allowFrom = void 0;
  testIsNixMode.value = false;
  cronIsolatedRun.mockClear();
  agentCommand.mockClear();
  embeddedRunMock.activeIds.clear();
  embeddedRunMock.abortCalls = [];
  embeddedRunMock.waitCalls = [];
  embeddedRunMock.waitResults.clear();
  drainSystemEvents(resolveMainSessionKeyFromConfig());
  resetAgentRunContextForTest();
  const mod = await serverModulePromise;
  mod.__resetModelCatalogCacheForTest();
  piSdkMock.enabled = false;
  piSdkMock.discoverCalls = 0;
  piSdkMock.models = [];
}
async function cleanupGatewayTestHome(options) {
  vi.useRealTimers();
  resetLogger();
  if (options.restoreEnv) {
    if (previousHome === void 0) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    if (previousUserProfile === void 0) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = previousUserProfile;
    }
    if (previousStateDir === void 0) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
    if (previousConfigPath === void 0) {
      delete process.env.OPENCLAW_CONFIG_PATH;
    } else {
      process.env.OPENCLAW_CONFIG_PATH = previousConfigPath;
    }
    if (previousSkipBrowserControl === void 0) {
      delete process.env.OPENCLAW_SKIP_BROWSER_CONTROL_SERVER;
    } else {
      process.env.OPENCLAW_SKIP_BROWSER_CONTROL_SERVER = previousSkipBrowserControl;
    }
    if (previousSkipGmailWatcher === void 0) {
      delete process.env.OPENCLAW_SKIP_GMAIL_WATCHER;
    } else {
      process.env.OPENCLAW_SKIP_GMAIL_WATCHER = previousSkipGmailWatcher;
    }
    if (previousSkipCanvasHost === void 0) {
      delete process.env.OPENCLAW_SKIP_CANVAS_HOST;
    } else {
      process.env.OPENCLAW_SKIP_CANVAS_HOST = previousSkipCanvasHost;
    }
  }
  if (options.restoreEnv && tempHome) {
    await fs.rm(tempHome, {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 25
    });
    tempHome = void 0;
  }
  tempConfigRoot = void 0;
}
function installGatewayTestHooks(options) {
  const scope = options?.scope ?? 'test';
  if (scope === 'suite') {
    beforeAll(async () => {
      await setupGatewayTestHome();
      await resetGatewayTestState({ uniqueConfigRoot: true });
    });
    beforeEach(async () => {
      await resetGatewayTestState({ uniqueConfigRoot: true });
    }, 6e4);
    afterEach(async () => {
      await cleanupGatewayTestHome({ restoreEnv: false });
    });
    afterAll(async () => {
      await cleanupGatewayTestHome({ restoreEnv: true });
    });
    return;
  }
  beforeEach(async () => {
    await setupGatewayTestHome();
    await resetGatewayTestState({ uniqueConfigRoot: false });
  }, 6e4);
  afterEach(async () => {
    await cleanupGatewayTestHome({ restoreEnv: true });
  });
}
async function getFreePort() {
  return await getDeterministicFreePortBlock({ offsets: [0, 1, 2, 3, 4] });
}
async function occupyPort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}
function onceMessage(ws, filter, timeoutMs = 1e4) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    const closeHandler = (code, reason) => {
      clearTimeout(timer);
      ws.off('message', handler);
      reject(new Error(`closed ${code}: ${reason.toString()}`));
    };
    const handler = (data) => {
      const obj = JSON.parse(rawDataToString(data));
      if (filter(obj)) {
        clearTimeout(timer);
        ws.off('message', handler);
        ws.off('close', closeHandler);
        resolve(obj);
      }
    };
    ws.on('message', handler);
    ws.once('close', closeHandler);
  });
}
async function startGatewayServer(port, opts) {
  const mod = await serverModulePromise;
  return await mod.startGatewayServer(port, opts);
}
async function startServerWithClient(token, opts) {
  let port = await getFreePort();
  const prev = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (typeof token === 'string') {
    testState.gatewayAuth = { mode: 'token', token };
  }
  const fallbackToken = token ?? (typeof testState.gatewayAuth?.token === 'string' ? testState.gatewayAuth.token : void 0);
  if (fallbackToken === void 0) {
    delete process.env.OPENCLAW_GATEWAY_TOKEN;
  } else {
    process.env.OPENCLAW_GATEWAY_TOKEN = fallbackToken;
  }
  let server = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      server = await startGatewayServer(port, opts);
      break;
    } catch (err) {
      const code = err.cause?.code;
      if (code !== 'EADDRINUSE') {
        throw err;
      }
      port = await getFreePort();
    }
  }
  if (!server) {
    throw new Error('failed to start gateway server after retries');
  }
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((resolve) => ws.once('open', resolve));
  return { server, ws, port, prevToken: prev };
}
async function connectReq(ws, opts) {
  const { randomUUID } = await import('node:crypto');
  const id = randomUUID();
  const client = opts?.client ?? {
    id: GATEWAY_CLIENT_NAMES.TEST,
    version: '1.0.0',
    platform: 'test',
    mode: GATEWAY_CLIENT_MODES.TEST
  };
  const role = opts?.role ?? 'operator';
  const defaultToken = opts?.skipDefaultAuth === true ? void 0 : typeof testState.gatewayAuth?.token === 'string' ? testState.gatewayAuth.token ?? void 0 : process.env.OPENCLAW_GATEWAY_TOKEN;
  const defaultPassword = opts?.skipDefaultAuth === true ? void 0 : typeof testState.gatewayAuth?.password === 'string' ? testState.gatewayAuth.password ?? void 0 : process.env.OPENCLAW_GATEWAY_PASSWORD;
  const token = opts?.token ?? defaultToken;
  const password = opts?.password ?? defaultPassword;
  const requestedScopes = Array.isArray(opts?.scopes) ? opts?.scopes : [];
  const device = (() => {
    if (opts?.device === null) {
      return void 0;
    }
    if (opts?.device) {
      return opts.device;
    }
    const identity = loadOrCreateDeviceIdentity();
    const signedAtMs = Date.now();
    const payload = buildDeviceAuthPayload({
      deviceId: identity.deviceId,
      clientId: client.id,
      clientMode: client.mode,
      role,
      scopes: requestedScopes,
      signedAtMs,
      token: token ?? null
    });
    return {
      id: identity.deviceId,
      publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
      signature: signDevicePayload(identity.privateKeyPem, payload),
      signedAt: signedAtMs,
      nonce: opts?.device?.nonce
    };
  })();
  ws.send(
    JSON.stringify({
      type: 'req',
      id,
      method: 'connect',
      params: {
        minProtocol: opts?.minProtocol ?? PROTOCOL_VERSION,
        maxProtocol: opts?.maxProtocol ?? PROTOCOL_VERSION,
        client,
        caps: opts?.caps ?? [],
        commands: opts?.commands ?? [],
        permissions: opts?.permissions ?? void 0,
        role,
        scopes: opts?.scopes,
        auth: token || password ? {
          token,
          password
        } : void 0,
        device
      }
    })
  );
  const isResponseForId = (o) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) {
      return false;
    }
    const rec = o;
    return rec.type === 'res' && rec.id === id;
  };
  return await onceMessage(ws, isResponseForId);
}
async function connectOk(ws, opts) {
  const res = await connectReq(ws, opts);
  expect(res.ok).toBe(true);
  expect(res.payload?.type).toBe('hello-ok');
  return res.payload;
}
async function rpcReq(ws, method, params, timeoutMs) {
  const { randomUUID } = await import('node:crypto');
  const id = randomUUID();
  ws.send(JSON.stringify({ type: 'req', id, method, params }));
  return await onceMessage(
    ws,
    (o) => {
      if (!o || typeof o !== 'object' || Array.isArray(o)) {
        return false;
      }
      const rec = o;
      return rec.type === 'res' && rec.id === id;
    },
    timeoutMs
  );
}
async function waitForSystemEvent(timeoutMs = 2e3) {
  const sessionKey = resolveMainSessionKeyFromConfig();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const events = peekSystemEvents(sessionKey);
    if (events.length > 0) {
      return events;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('timeout waiting for system event');
}
export {
  connectOk,
  connectReq,
  getFreePort,
  installGatewayTestHooks,
  occupyPort,
  onceMessage,
  rpcReq,
  startGatewayServer,
  startServerWithClient,
  waitForSystemEvent,
  writeSessionStore
};
