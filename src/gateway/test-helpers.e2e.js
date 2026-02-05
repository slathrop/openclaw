import { WebSocket } from 'ws';
import {
  loadOrCreateDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload
} from '../infra/device-identity.js';
import { rawDataToString } from '../infra/ws.js';
import { getDeterministicFreePortBlock } from '../test-utils/ports.js';
import {
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES
} from '../utils/message-channel.js';
import { GatewayClient } from './client.js';
import { buildDeviceAuthPayload } from './device-auth.js';
import { PROTOCOL_VERSION } from './protocol/index.js';
async function getFreeGatewayPort() {
  return await getDeterministicFreePortBlock({ offsets: [0, 1, 2, 3, 4] });
}
async function connectGatewayClient(params) {
  return await new Promise((resolve, reject) => {
    let settled = false;
    const stop = (err, client2) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (err) {
        reject(err);
      } else {
        resolve(client2);
      }
    };
    const client = new GatewayClient({
      url: params.url,
      token: params.token,
      clientName: params.clientName ?? GATEWAY_CLIENT_NAMES.TEST,
      clientDisplayName: params.clientDisplayName ?? 'vitest',
      clientVersion: params.clientVersion ?? 'dev',
      mode: params.mode ?? GATEWAY_CLIENT_MODES.TEST,
      onHelloOk: () => stop(void 0, client),
      onConnectError: (err) => stop(err),
      onClose: (code, reason) => stop(new Error(`gateway closed during connect (${code}): ${reason}`))
    });
    const timer = setTimeout(() => stop(new Error('gateway connect timeout')), 1e4);
    timer.unref();
    client.start();
  });
}
async function connectDeviceAuthReq(params) {
  const ws = new WebSocket(params.url);
  await new Promise((resolve) => ws.once('open', resolve));
  const identity = loadOrCreateDeviceIdentity();
  const signedAtMs = Date.now();
  const payload = buildDeviceAuthPayload({
    deviceId: identity.deviceId,
    clientId: GATEWAY_CLIENT_NAMES.TEST,
    clientMode: GATEWAY_CLIENT_MODES.TEST,
    role: 'operator',
    scopes: [],
    signedAtMs,
    token: params.token ?? null
  });
  const device = {
    id: identity.deviceId,
    publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
    signature: signDevicePayload(identity.privateKeyPem, payload),
    signedAt: signedAtMs
  };
  ws.send(
    JSON.stringify({
      type: 'req',
      id: 'c1',
      method: 'connect',
      params: {
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: GATEWAY_CLIENT_NAMES.TEST,
          displayName: 'vitest',
          version: 'dev',
          platform: process.platform,
          mode: GATEWAY_CLIENT_MODES.TEST
        },
        caps: [],
        auth: params.token ? { token: params.token } : void 0,
        device
      }
    })
  );
  const res = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 5e3);
    const closeHandler = (code, reason) => {
      clearTimeout(timer);
      ws.off('message', handler);
      reject(new Error(`closed ${code}: ${rawDataToString(reason)}`));
    };
    const handler = (data) => {
      const obj = JSON.parse(rawDataToString(data));
      if (obj?.type !== 'res' || obj?.id !== 'c1') {
        return;
      }
      clearTimeout(timer);
      ws.off('message', handler);
      ws.off('close', closeHandler);
      resolve(
        obj
      );
    };
    ws.on('message', handler);
    ws.once('close', closeHandler);
  });
  ws.close();
  return res;
}
export {
  connectDeviceAuthReq,
  connectGatewayClient,
  getFreeGatewayPort
};
