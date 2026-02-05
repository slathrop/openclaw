import { afterAll, beforeAll, test } from 'vitest';
import WebSocket from 'ws';
import { PROTOCOL_VERSION } from './protocol/index.js';
import { getFreePort, onceMessage, startGatewayServer } from './test-helpers.server.js';
let server;
let port = 0;
beforeAll(async () => {
  port = await getFreePort();
  server = await startGatewayServer(port);
});
afterAll(async () => {
  await server.close();
});
function connectReq(ws, params) {
  const id = `c-${Math.random().toString(16).slice(2)}`;
  ws.send(
    JSON.stringify({
      type: 'req',
      id,
      method: 'connect',
      params: {
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: params.clientId,
          version: 'dev',
          platform: params.platform,
          mode: 'node'
        },
        auth: {
          token: params.token,
          password: params.password
        },
        role: 'node',
        scopes: [],
        caps: ['canvas'],
        commands: ['system.notify'],
        permissions: {}
      }
    })
  );
  return onceMessage(
    ws,
    (o) => o.type === 'res' && o.id === id
  );
}
test('accepts openclaw-ios as a valid gateway client id', async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((resolve) => ws.once('open', resolve));
  const res = await connectReq(ws, { clientId: 'openclaw-ios', platform: 'ios' });
  if (!res.ok) {
    const message = String(res.error?.message ?? '');
    if (message.includes('invalid connect params')) {
      throw new Error(message);
    }
  }
  ws.close();
});
test('accepts openclaw-android as a valid gateway client id', async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((resolve) => ws.once('open', resolve));
  const res = await connectReq(ws, { clientId: 'openclaw-android', platform: 'android' });
  if (!res.ok) {
    const message = String(res.error?.message ?? '');
    if (message.includes('invalid connect params')) {
      throw new Error(message);
    }
  }
  ws.close();
});
