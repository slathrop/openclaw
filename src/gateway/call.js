/** @module gateway/call -- Gateway RPC call helpers and request/response framing. */
import { randomUUID } from 'node:crypto';
import {
  loadConfig,
  resolveConfigPath,
  resolveGatewayPort,
  resolveStateDir
} from '../config/config.js';
import { loadOrCreateDeviceIdentity } from '../infra/device-identity.js';
import { pickPrimaryTailnetIPv4 } from '../infra/tailnet.js';
import { loadGatewayTlsRuntime } from '../infra/tls/gateway.js';
import {
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES
} from '../utils/message-channel.js';
import { GatewayClient } from './client.js';
import { PROTOCOL_VERSION } from './protocol/index.js';
function buildGatewayConnectionDetails(options = {}) {
  const config = options.config ?? loadConfig();
  const configPath = options.configPath ?? resolveConfigPath(process.env, resolveStateDir(process.env));
  const isRemoteMode = config.gateway?.mode === 'remote';
  const remote = isRemoteMode ? config.gateway?.remote : void 0;
  const tlsEnabled = config.gateway?.tls?.enabled === true;
  const localPort = resolveGatewayPort(config);
  const tailnetIPv4 = pickPrimaryTailnetIPv4();
  const bindMode = config.gateway?.bind ?? 'loopback';
  const preferTailnet = bindMode === 'tailnet' && !!tailnetIPv4;
  const scheme = tlsEnabled ? 'wss' : 'ws';
  const localUrl = preferTailnet && tailnetIPv4 ? `${scheme}://${tailnetIPv4}:${localPort}` : `${scheme}://127.0.0.1:${localPort}`;
  const urlOverride = typeof options.url === 'string' && options.url.trim().length > 0 ? options.url.trim() : void 0;
  const remoteUrl = typeof remote?.url === 'string' && remote.url.trim().length > 0 ? remote.url.trim() : void 0;
  const remoteMisconfigured = isRemoteMode && !urlOverride && !remoteUrl;
  const url = urlOverride || remoteUrl || localUrl;
  const urlSource = urlOverride ? 'cli --url' : remoteUrl ? 'config gateway.remote.url' : remoteMisconfigured ? 'missing gateway.remote.url (fallback local)' : preferTailnet && tailnetIPv4 ? `local tailnet ${tailnetIPv4}` : 'local loopback';
  const remoteFallbackNote = remoteMisconfigured ? 'Warn: gateway.mode=remote but gateway.remote.url is missing; set gateway.remote.url or switch gateway.mode=local.' : void 0;
  const bindDetail = !urlOverride && !remoteUrl ? `Bind: ${bindMode}` : void 0;
  const message = [
    `Gateway target: ${url}`,
    `Source: ${urlSource}`,
    `Config: ${configPath}`,
    bindDetail,
    remoteFallbackNote
  ].filter(Boolean).join('\n');
  return {
    url,
    urlSource,
    bindDetail,
    remoteFallbackNote,
    message
  };
}
async function callGateway(opts) {
  const timeoutMs = opts.timeoutMs ?? 1e4;
  const config = opts.config ?? loadConfig();
  const isRemoteMode = config.gateway?.mode === 'remote';
  const remote = isRemoteMode ? config.gateway?.remote : void 0;
  const urlOverride = typeof opts.url === 'string' && opts.url.trim().length > 0 ? opts.url.trim() : void 0;
  const remoteUrl = typeof remote?.url === 'string' && remote.url.trim().length > 0 ? remote.url.trim() : void 0;
  if (isRemoteMode && !urlOverride && !remoteUrl) {
    const configPath = opts.configPath ?? resolveConfigPath(process.env, resolveStateDir(process.env));
    throw new Error(
      [
        'gateway remote mode misconfigured: gateway.remote.url missing',
        `Config: ${configPath}`,
        'Fix: set gateway.remote.url, or set gateway.mode=local.'
      ].join('\n')
    );
  }
  const authToken = config.gateway?.auth?.token;
  const authPassword = config.gateway?.auth?.password;
  const connectionDetails = buildGatewayConnectionDetails({
    config,
    url: urlOverride,
    ...opts.configPath ? { configPath: opts.configPath } : {}
  });
  const url = connectionDetails.url;
  const useLocalTls = config.gateway?.tls?.enabled === true && !urlOverride && !remoteUrl && url.startsWith('wss://');
  const tlsRuntime = useLocalTls ? await loadGatewayTlsRuntime(config.gateway?.tls) : void 0;
  const remoteTlsFingerprint = isRemoteMode && !urlOverride && remoteUrl && typeof remote?.tlsFingerprint === 'string' ? remote.tlsFingerprint.trim() : void 0;
  const overrideTlsFingerprint = typeof opts.tlsFingerprint === 'string' ? opts.tlsFingerprint.trim() : void 0;
  const tlsFingerprint = overrideTlsFingerprint || remoteTlsFingerprint || (tlsRuntime?.enabled ? tlsRuntime.fingerprintSha256 : void 0);
  const token = (typeof opts.token === 'string' && opts.token.trim().length > 0 ? opts.token.trim() : void 0) || (isRemoteMode ? typeof remote?.token === 'string' && remote.token.trim().length > 0 ? remote.token.trim() : void 0 : process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || process.env.CLAWDBOT_GATEWAY_TOKEN?.trim() || (typeof authToken === 'string' && authToken.trim().length > 0 ? authToken.trim() : void 0));
  const password = (typeof opts.password === 'string' && opts.password.trim().length > 0 ? opts.password.trim() : void 0) || process.env.OPENCLAW_GATEWAY_PASSWORD?.trim() || process.env.CLAWDBOT_GATEWAY_PASSWORD?.trim() || (isRemoteMode ? typeof remote?.password === 'string' && remote.password.trim().length > 0 ? remote.password.trim() : void 0 : typeof authPassword === 'string' && authPassword.trim().length > 0 ? authPassword.trim() : void 0);
  const formatCloseError = (code, reason) => {
    const reasonText = reason?.trim() || 'no close reason';
    const hint = code === 1006 ? 'abnormal closure (no close frame)' : code === 1e3 ? 'normal closure' : '';
    const suffix = hint ? ` ${hint}` : '';
    return `gateway closed (${code}${suffix}): ${reasonText}
${connectionDetails.message}`;
  };
  const formatTimeoutError = () => `gateway timeout after ${timeoutMs}ms
${connectionDetails.message}`;
  return await new Promise((resolve, reject) => {
    let settled = false;
    let ignoreClose = false;
    const stop = (err, value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (err) {
        reject(err);
      } else {
        resolve(value);
      }
    };
    const client = new GatewayClient({
      url,
      token,
      password,
      tlsFingerprint,
      instanceId: opts.instanceId ?? randomUUID(),
      clientName: opts.clientName ?? GATEWAY_CLIENT_NAMES.CLI,
      clientDisplayName: opts.clientDisplayName,
      clientVersion: opts.clientVersion ?? 'dev',
      platform: opts.platform,
      mode: opts.mode ?? GATEWAY_CLIENT_MODES.CLI,
      role: 'operator',
      scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
      deviceIdentity: loadOrCreateDeviceIdentity(),
      minProtocol: opts.minProtocol ?? PROTOCOL_VERSION,
      maxProtocol: opts.maxProtocol ?? PROTOCOL_VERSION,
      onHelloOk: async () => {
        try {
          const result = await client.request(opts.method, opts.params, {
            expectFinal: opts.expectFinal
          });
          ignoreClose = true;
          stop(void 0, result);
          client.stop();
        } catch (err) {
          ignoreClose = true;
          client.stop();
          stop(err);
        }
      },
      onClose: (code, reason) => {
        if (settled || ignoreClose) {
          return;
        }
        ignoreClose = true;
        client.stop();
        stop(new Error(formatCloseError(code, reason)));
      }
    });
    const timer = setTimeout(() => {
      ignoreClose = true;
      client.stop();
      stop(new Error(formatTimeoutError()));
    }, timeoutMs);
    client.start();
  });
}
function randomIdempotencyKey() {
  return randomUUID();
}
export {
  buildGatewayConnectionDetails,
  callGateway,
  randomIdempotencyKey
};
