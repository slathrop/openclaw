import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { WebSocket } from 'ws';
import { loadOrCreateDeviceIdentity } from '../infra/device-identity.js';
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from '../utils/message-channel.js';
vi.mock('../infra/update-runner.js', () => ({
  runGatewayUpdate: vi.fn(async () => ({
    status: 'ok',
    mode: 'git',
    root: '/repo',
    steps: [],
    durationMs: 12
  }))
}));
import {
  connectOk,
  installGatewayTestHooks,
  rpcReq,
  startServerWithClient
} from './test-helpers.js';
installGatewayTestHooks({ scope: 'suite' });
let server;
let ws;
let port;
beforeAll(async () => {
  const token = 'test-gateway-token-1234567890';
  const started = await startServerWithClient(token);
  server = started.server;
  ws = started.ws;
  port = started.port;
  await connectOk(ws, { token });
});
afterAll(async () => {
  ws.close();
  await server.close();
});
describe('late-arriving invoke results', () => {
  test('returns success for unknown invoke id (late arrival after timeout)', async () => {
    const nodeWs = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((resolve) => nodeWs.once('open', resolve));
    try {
      const identity = loadOrCreateDeviceIdentity();
      const nodeId = identity.deviceId;
      await connectOk(nodeWs, {
        role: 'node',
        client: {
          id: GATEWAY_CLIENT_NAMES.NODE_HOST,
          version: '1.0.0',
          platform: 'ios',
          mode: GATEWAY_CLIENT_MODES.NODE
        },
        commands: ['canvas.snapshot'],
        token: 'test-gateway-token-1234567890'
      });
      const result = await rpcReq(
        nodeWs,
        'node.invoke.result',
        {
          id: 'unknown-invoke-id-12345',
          nodeId,
          ok: true,
          payloadJSON: JSON.stringify({ result: 'late' })
        }
      );
      expect(result.ok).toBe(true);
      expect(result.payload?.ok).toBe(true);
      expect(result.payload?.ignored).toBe(true);
    } finally {
      nodeWs.close();
    }
  });
  test('returns success for unknown invoke id with error payload', async () => {
    const nodeWs = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((resolve) => nodeWs.once('open', resolve));
    try {
      await connectOk(nodeWs, {
        role: 'node',
        client: {
          id: GATEWAY_CLIENT_NAMES.NODE_HOST,
          version: '1.0.0',
          platform: 'darwin',
          mode: GATEWAY_CLIENT_MODES.NODE
        },
        commands: []
      });
      const identity = loadOrCreateDeviceIdentity();
      const nodeId = identity.deviceId;
      const result = await rpcReq(
        nodeWs,
        'node.invoke.result',
        {
          id: 'another-unknown-invoke-id',
          nodeId,
          ok: false,
          error: { code: 'FAILED', message: 'test error' }
        }
      );
      expect(result.ok).toBe(true);
      expect(result.payload?.ok).toBe(true);
      expect(result.payload?.ignored).toBe(true);
    } finally {
      nodeWs.close();
    }
  });
});
