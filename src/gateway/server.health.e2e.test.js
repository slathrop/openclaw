import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { WebSocket } from 'ws';
import { emitAgentEvent } from '../infra/agent-events.js';
import {
  loadOrCreateDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload
} from '../infra/device-identity.js';
import { emitHeartbeatEvent } from '../infra/heartbeat-events.js';
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from '../utils/message-channel.js';
import { buildDeviceAuthPayload } from './device-auth.js';
import {
  connectOk,
  getFreePort,
  installGatewayTestHooks,
  onceMessage,
  startGatewayServer,
  startServerWithClient
} from './test-helpers.js';
installGatewayTestHooks({ scope: 'suite' });
let server;
let port = 0;
let previousToken;
beforeAll(async () => {
  previousToken = process.env.OPENCLAW_GATEWAY_TOKEN;
  delete process.env.OPENCLAW_GATEWAY_TOKEN;
  port = await getFreePort();
  server = await startGatewayServer(port);
});
afterAll(async () => {
  await server.close();
  if (previousToken === void 0) {
    delete process.env.OPENCLAW_GATEWAY_TOKEN;
  } else {
    process.env.OPENCLAW_GATEWAY_TOKEN = previousToken;
  }
});
const openClient = async (opts) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((resolve) => ws.once('open', resolve));
  await connectOk(ws, opts);
  return ws;
};
describe('gateway server health/presence', () => {
  test('connect + health + presence + status succeed', { timeout: 6e4 }, async () => {
    const ws = await openClient();
    const healthP = onceMessage(ws, (o) => o.type === 'res' && o.id === 'health1');
    const statusP = onceMessage(ws, (o) => o.type === 'res' && o.id === 'status1');
    const presenceP = onceMessage(ws, (o) => o.type === 'res' && o.id === 'presence1');
    const channelsP = onceMessage(ws, (o) => o.type === 'res' && o.id === 'channels1');
    const sendReq = (id, method) => ws.send(JSON.stringify({ type: 'req', id, method }));
    sendReq('health1', 'health');
    sendReq('status1', 'status');
    sendReq('presence1', 'system-presence');
    sendReq('channels1', 'channels.status');
    const health = await healthP;
    const status = await statusP;
    const presence = await presenceP;
    const channels = await channelsP;
    expect(health.ok).toBe(true);
    expect(status.ok).toBe(true);
    expect(presence.ok).toBe(true);
    expect(channels.ok).toBe(true);
    expect(Array.isArray(presence.payload)).toBe(true);
    ws.close();
  });
  test('broadcasts heartbeat events and serves last-heartbeat', async () => {
    const ws = await openClient();
    const waitHeartbeat = onceMessage(
      ws,
      (o) => o.type === 'event' && o.event === 'heartbeat'
    );
    emitHeartbeatEvent({ status: 'sent', to: '+123', preview: 'ping' });
    const evt = await waitHeartbeat;
    expect(evt.payload?.status).toBe('sent');
    expect(typeof evt.payload?.ts).toBe('number');
    ws.send(
      JSON.stringify({
        type: 'req',
        id: 'hb-last',
        method: 'last-heartbeat'
      })
    );
    const last = await onceMessage(ws, (o) => o.type === 'res' && o.id === 'hb-last');
    expect(last.ok).toBe(true);
    const lastPayload = last.payload;
    expect(lastPayload?.status).toBe('sent');
    expect(lastPayload?.ts).toBe(evt.payload?.ts);
    ws.send(
      JSON.stringify({
        type: 'req',
        id: 'hb-toggle-off',
        method: 'set-heartbeats',
        params: { enabled: false }
      })
    );
    const toggle = await onceMessage(
      ws,
      (o) => o.type === 'res' && o.id === 'hb-toggle-off'
    );
    expect(toggle.ok).toBe(true);
    expect(toggle.payload?.enabled).toBe(false);
    ws.close();
  });
  test('presence events carry seq + stateVersion', { timeout: 8e3 }, async () => {
    const ws = await openClient();
    const presenceEventP = onceMessage(ws, (o) => o.type === 'event' && o.event === 'presence');
    ws.send(
      JSON.stringify({
        type: 'req',
        id: 'evt-1',
        method: 'system-event',
        params: { text: 'note from test' }
      })
    );
    const evt = await presenceEventP;
    expect(typeof evt.seq).toBe('number');
    expect(evt.stateVersion?.presence).toBeGreaterThan(0);
    expect(Array.isArray(evt.payload?.presence)).toBe(true);
    ws.close();
  });
  test('agent events stream with seq', { timeout: 8e3 }, async () => {
    const ws = await openClient();
    const runId = randomUUID();
    const evtPromise = onceMessage(
      ws,
      (o) => o.type === 'event' && o.event === 'agent' && o.payload?.runId === runId && o.payload?.stream === 'lifecycle'
    );
    emitAgentEvent({ runId, stream: 'lifecycle', data: { msg: 'hi' } });
    const evt = await evtPromise;
    expect(evt.payload.runId).toBe(runId);
    expect(typeof evt.seq).toBe('number');
    expect(evt.payload.data.msg).toBe('hi');
    ws.close();
  });
  test('shutdown event is broadcast on close', { timeout: 8e3 }, async () => {
    const { server: server2, ws } = await startServerWithClient();
    await connectOk(ws);
    const shutdownP = onceMessage(ws, (o) => o.type === 'event' && o.event === 'shutdown', 5e3);
    await server2.close();
    const evt = await shutdownP;
    expect(evt.payload?.reason).toBeDefined();
  });
  test('presence broadcast reaches multiple clients', { timeout: 8e3 }, async () => {
    const clients = await Promise.all([openClient(), openClient(), openClient()]);
    const waits = clients.map(
      (c) => onceMessage(c, (o) => o.type === 'event' && o.event === 'presence')
    );
    clients[0].send(
      JSON.stringify({
        type: 'req',
        id: 'broadcast',
        method: 'system-event',
        params: { text: 'fanout' }
      })
    );
    const events = await Promise.all(waits);
    for (const evt of events) {
      expect(evt.payload?.presence?.length).toBeGreaterThan(0);
      expect(typeof evt.seq).toBe('number');
    }
    for (const c of clients) {
      c.close();
    }
  });
  test('presence includes client fingerprint', async () => {
    const identityPath = path.join(os.tmpdir(), `openclaw-device-${randomUUID()}.json`);
    const identity = loadOrCreateDeviceIdentity(identityPath);
    const role = 'operator';
    const scopes = [];
    const signedAtMs = Date.now();
    const payload = buildDeviceAuthPayload({
      deviceId: identity.deviceId,
      clientId: GATEWAY_CLIENT_NAMES.FINGERPRINT,
      clientMode: GATEWAY_CLIENT_MODES.UI,
      role,
      scopes,
      signedAtMs,
      token: null
    });
    const ws = await openClient({
      role,
      scopes,
      client: {
        id: GATEWAY_CLIENT_NAMES.FINGERPRINT,
        version: '9.9.9',
        platform: 'test',
        deviceFamily: 'iPad',
        modelIdentifier: 'iPad16,6',
        mode: GATEWAY_CLIENT_MODES.UI,
        instanceId: 'abc'
      },
      device: {
        id: identity.deviceId,
        publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
        signature: signDevicePayload(identity.privateKeyPem, payload),
        signedAt: signedAtMs
      }
    });
    const presenceP = onceMessage(ws, (o) => o.type === 'res' && o.id === 'fingerprint', 4e3);
    ws.send(
      JSON.stringify({
        type: 'req',
        id: 'fingerprint',
        method: 'system-presence'
      })
    );
    const presenceRes = await presenceP;
    const entries = presenceRes.payload;
    const clientEntry = entries.find(
      (e) => e.host === GATEWAY_CLIENT_NAMES.FINGERPRINT && e.version === '9.9.9'
    );
    expect(clientEntry?.host).toBe(GATEWAY_CLIENT_NAMES.FINGERPRINT);
    expect(clientEntry?.version).toBe('9.9.9');
    expect(clientEntry?.mode).toBe('ui');
    expect(clientEntry?.deviceFamily).toBe('iPad');
    expect(clientEntry?.modelIdentifier).toBe('iPad16,6');
    ws.close();
  });
  test('cli connections are not tracked as instances', async () => {
    const cliId = `cli-${randomUUID()}`;
    const ws = await openClient({
      client: {
        id: GATEWAY_CLIENT_NAMES.CLI,
        version: 'dev',
        platform: 'test',
        mode: GATEWAY_CLIENT_MODES.CLI,
        instanceId: cliId
      }
    });
    const presenceP = onceMessage(ws, (o) => o.type === 'res' && o.id === 'cli-presence', 4e3);
    ws.send(
      JSON.stringify({
        type: 'req',
        id: 'cli-presence',
        method: 'system-presence'
      })
    );
    const presenceRes = await presenceP;
    const entries = presenceRes.payload;
    expect(entries.some((e) => e.instanceId === cliId)).toBe(false);
    ws.close();
  });
});
