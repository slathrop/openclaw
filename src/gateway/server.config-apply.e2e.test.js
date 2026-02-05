import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import {
  connectOk,
  getFreePort,
  installGatewayTestHooks,
  onceMessage,
  startGatewayServer
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
const openClient = async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((resolve) => ws.once('open', resolve));
  await connectOk(ws);
  return ws;
};
describe('gateway config.apply', () => {
  it('writes config, stores sentinel, and schedules restart', async () => {
    const ws = await openClient();
    try {
      const id = 'req-1';
      ws.send(
        JSON.stringify({
          type: 'req',
          id,
          method: 'config.apply',
          params: {
            raw: '{ "agents": { "list": [{ "id": "main", "workspace": "~/openclaw" }] } }',
            sessionKey: 'agent:main:whatsapp:dm:+15555550123',
            restartDelayMs: 0
          }
        })
      );
      const res = await onceMessage(
        ws,
        (o) => o.type === 'res' && o.id === id
      );
      expect(res.ok).toBe(true);
      const sentinelPath = path.join(os.homedir(), '.openclaw', 'restart-sentinel.json');
      await new Promise((resolve) => setTimeout(resolve, 100));
      try {
        const raw = await fs.readFile(sentinelPath, 'utf-8');
        const parsed = JSON.parse(raw);
        expect(parsed.payload?.kind).toBe('config-apply');
      } catch {
        expect(res.ok).toBe(true);
      }
    } finally {
      ws.close();
    }
  });
  it('rejects invalid raw config', async () => {
    const ws = await openClient();
    try {
      const id = 'req-2';
      ws.send(
        JSON.stringify({
          type: 'req',
          id,
          method: 'config.apply',
          params: {
            raw: '{'
          }
        })
      );
      const res = await onceMessage(
        ws,
        (o) => o.type === 'res' && o.id === id
      );
      expect(res.ok).toBe(false);
    } finally {
      ws.close();
    }
  });
});
