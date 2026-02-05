/** @module gateway/client -- Gateway WebSocket client with reconnection, backoff, and TLS fingerprinting. */
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import {
  clearDeviceAuthToken,
  loadDeviceAuthToken,
  storeDeviceAuthToken
} from '../infra/device-auth-store.js';
import {
  loadOrCreateDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload
} from '../infra/device-identity.js';
import { normalizeFingerprint } from '../infra/tls/fingerprint.js';
import { rawDataToString } from '../infra/ws.js';
import { logDebug, logError } from '../logger.js';
import {
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES
} from '../utils/message-channel.js';
import { buildDeviceAuthPayload } from './device-auth.js';
import {
  PROTOCOL_VERSION,
  validateEventFrame,
  validateRequestFrame,
  validateResponseFrame
} from './protocol/index.js';
const GATEWAY_CLOSE_CODE_HINTS = {
  1e3: 'normal closure',
  1006: 'abnormal closure (no close frame)',
  1008: 'policy violation',
  1012: 'service restart'
};
function describeGatewayCloseCode(code) {
  return GATEWAY_CLOSE_CODE_HINTS[code];
}
class GatewayClient {
  _ws = null;
  _opts;
  _pending = /* @__PURE__ */ new Map();
  _backoffMs = 1e3;
  _closed = false;
  _lastSeq = null;
  _connectNonce = null;
  _connectSent = false;
  _connectTimer = null;
  // Track last tick to detect silent stalls.
  _lastTick = null;
  _tickIntervalMs = 3e4;
  _tickTimer = null;
  constructor(opts) {
    this._opts = {
      ...opts,
      deviceIdentity: opts.deviceIdentity ?? loadOrCreateDeviceIdentity()
    };
  }
  start() {
    if (this._closed) {
      return;
    }
    const url = this._opts.url ?? 'ws://127.0.0.1:18789';
    if (this._opts.tlsFingerprint && !url.startsWith('wss://')) {
      this._opts.onConnectError?.(new Error('gateway tls fingerprint requires wss:// gateway url'));
      return;
    }
    const wsOptions = {
      maxPayload: 25 * 1024 * 1024
    };
    if (url.startsWith('wss://') && this._opts.tlsFingerprint) {
      wsOptions.rejectUnauthorized = false;
      wsOptions.checkServerIdentity = ((_host, cert) => {
        const fingerprintValue = typeof cert === 'object' && cert && 'fingerprint256' in cert ? cert.fingerprint256 ?? '' : '';
        const fingerprint = normalizeFingerprint(
          typeof fingerprintValue === 'string' ? fingerprintValue : ''
        );
        const expected = normalizeFingerprint(this._opts.tlsFingerprint ?? '');
        if (!expected) {
          return new Error('gateway tls fingerprint missing');
        }
        if (!fingerprint) {
          return new Error('gateway tls fingerprint unavailable');
        }
        if (fingerprint !== expected) {
          return new Error('gateway tls fingerprint mismatch');
        }
        return void 0;
      });
    }
    this._ws = new WebSocket(url, wsOptions);
    this._ws.on('open', () => {
      if (url.startsWith('wss://') && this._opts.tlsFingerprint) {
        const tlsError = this._validateTlsFingerprint();
        if (tlsError) {
          this._opts.onConnectError?.(tlsError);
          this._ws?.close(1008, tlsError.message);
          return;
        }
      }
      this._queueConnect();
    });
    this._ws.on('message', (data) => this._handleMessage(rawDataToString(data)));
    this._ws.on('close', (code, reason) => {
      const reasonText = rawDataToString(reason);
      this._ws = null;
      this._flushPendingErrors(new Error(`gateway closed (${code}): ${reasonText}`));
      this._scheduleReconnect();
      this._opts.onClose?.(code, reasonText);
    });
    this._ws.on('error', (err) => {
      logDebug(`gateway client error: ${String(err)}`);
      if (!this._connectSent) {
        this._opts.onConnectError?.(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
  stop() {
    this._closed = true;
    if (this._tickTimer) {
      clearInterval(this._tickTimer);
      this._tickTimer = null;
    }
    this._ws?.close();
    this._ws = null;
    this._flushPendingErrors(new Error('gateway client stopped'));
  }
  _sendConnect() {
    if (this._connectSent) {
      return;
    }
    this._connectSent = true;
    if (this._connectTimer) {
      clearTimeout(this._connectTimer);
      this._connectTimer = null;
    }
    const role = this._opts.role ?? 'operator';
    const storedToken = this._opts.deviceIdentity ? loadDeviceAuthToken({ deviceId: this._opts.deviceIdentity.deviceId, role })?.token : null;
    const authToken = storedToken ?? this._opts.token ?? void 0;
    const canFallbackToShared = Boolean(storedToken && this._opts.token);
    const auth = authToken || this._opts.password ? {
      token: authToken,
      password: this._opts.password
    } : void 0;
    const signedAtMs = Date.now();
    const nonce = this._connectNonce ?? void 0;
    const scopes = this._opts.scopes ?? ['operator.admin'];
    const device = (() => {
      if (!this._opts.deviceIdentity) {
        return void 0;
      }
      const payload = buildDeviceAuthPayload({
        deviceId: this._opts.deviceIdentity.deviceId,
        clientId: this._opts.clientName ?? GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
        clientMode: this._opts.mode ?? GATEWAY_CLIENT_MODES.BACKEND,
        role,
        scopes,
        signedAtMs,
        token: authToken ?? null,
        nonce
      });
      const signature = signDevicePayload(this._opts.deviceIdentity.privateKeyPem, payload);
      return {
        id: this._opts.deviceIdentity.deviceId,
        publicKey: publicKeyRawBase64UrlFromPem(this._opts.deviceIdentity.publicKeyPem),
        signature,
        signedAt: signedAtMs,
        nonce
      };
    })();
    const params = {
      minProtocol: this._opts.minProtocol ?? PROTOCOL_VERSION,
      maxProtocol: this._opts.maxProtocol ?? PROTOCOL_VERSION,
      client: {
        id: this._opts.clientName ?? GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
        displayName: this._opts.clientDisplayName,
        version: this._opts.clientVersion ?? 'dev',
        platform: this._opts.platform ?? process.platform,
        mode: this._opts.mode ?? GATEWAY_CLIENT_MODES.BACKEND,
        instanceId: this._opts.instanceId
      },
      caps: Array.isArray(this._opts.caps) ? this._opts.caps : [],
      commands: Array.isArray(this._opts.commands) ? this._opts.commands : void 0,
      permissions: this._opts.permissions && typeof this._opts.permissions === 'object' ? this._opts.permissions : void 0,
      pathEnv: this._opts.pathEnv,
      auth,
      role,
      scopes,
      device
    };
    void this.request('connect', params).then((helloOk) => {
      const authInfo = helloOk?.auth;
      if (authInfo?.deviceToken && this._opts.deviceIdentity) {
        storeDeviceAuthToken({
          deviceId: this._opts.deviceIdentity.deviceId,
          role: authInfo.role ?? role,
          token: authInfo.deviceToken,
          scopes: authInfo.scopes ?? []
        });
      }
      this._backoffMs = 1e3;
      this._tickIntervalMs = typeof helloOk.policy?.tickIntervalMs === 'number' ? helloOk.policy.tickIntervalMs : 3e4;
      this._lastTick = Date.now();
      this._startTickWatch();
      this._opts.onHelloOk?.(helloOk);
    }).catch((err) => {
      if (canFallbackToShared && this._opts.deviceIdentity) {
        clearDeviceAuthToken({
          deviceId: this._opts.deviceIdentity.deviceId,
          role
        });
      }
      this._opts.onConnectError?.(err instanceof Error ? err : new Error(String(err)));
      const msg = `gateway connect failed: ${String(err)}`;
      if (this._opts.mode === GATEWAY_CLIENT_MODES.PROBE) {
        logDebug(msg);
      } else {
        logError(msg);
      }
      this._ws?.close(1008, 'connect failed');
    });
  }
  _handleMessage(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (validateEventFrame(parsed)) {
        const evt = parsed;
        if (evt.event === 'connect.challenge') {
          const payload = evt.payload;
          const nonce = payload && typeof payload.nonce === 'string' ? payload.nonce : null;
          if (nonce) {
            this._connectNonce = nonce;
            this._sendConnect();
          }
          return;
        }
        const seq = typeof evt.seq === 'number' ? evt.seq : null;
        if (seq !== null) {
          if (this._lastSeq !== null && seq > this._lastSeq + 1) {
            this._opts.onGap?.({ expected: this._lastSeq + 1, received: seq });
          }
          this._lastSeq = seq;
        }
        if (evt.event === 'tick') {
          this._lastTick = Date.now();
        }
        this._opts.onEvent?.(evt);
        return;
      }
      if (validateResponseFrame(parsed)) {
        const pending = this._pending.get(parsed.id);
        if (!pending) {
          return;
        }
        const payload = parsed.payload;
        const status = payload?.status;
        if (pending.expectFinal && status === 'accepted') {
          return;
        }
        this._pending.delete(parsed.id);
        if (parsed.ok) {
          pending.resolve(parsed.payload);
        } else {
          pending.reject(new Error(parsed.error?.message ?? 'unknown error'));
        }
      }
    } catch (err) {
      logDebug(`gateway client parse error: ${String(err)}`);
    }
  }
  _queueConnect() {
    this._connectNonce = null;
    this._connectSent = false;
    if (this._connectTimer) {
      clearTimeout(this._connectTimer);
    }
    this._connectTimer = setTimeout(() => {
      this._sendConnect();
    }, 750);
  }
  _scheduleReconnect() {
    if (this._closed) {
      return;
    }
    if (this._tickTimer) {
      clearInterval(this._tickTimer);
      this._tickTimer = null;
    }
    const delay = this._backoffMs;
    this._backoffMs = Math.min(this._backoffMs * 2, 3e4);
    setTimeout(() => this.start(), delay).unref();
  }
  _flushPendingErrors(err) {
    for (const [, p] of this._pending) {
      p.reject(err);
    }
    this._pending.clear();
  }
  _startTickWatch() {
    if (this._tickTimer) {
      clearInterval(this._tickTimer);
    }
    const interval = Math.max(this._tickIntervalMs, 1e3);
    this._tickTimer = setInterval(() => {
      if (this._closed) {
        return;
      }
      if (!this._lastTick) {
        return;
      }
      const gap = Date.now() - this._lastTick;
      if (gap > this._tickIntervalMs * 2) {
        this._ws?.close(4e3, 'tick timeout');
      }
    }, interval);
  }
  _validateTlsFingerprint() {
    if (!this._opts.tlsFingerprint || !this._ws) {
      return null;
    }
    const expected = normalizeFingerprint(this._opts.tlsFingerprint);
    if (!expected) {
      return new Error('gateway tls fingerprint missing');
    }
    const socket = this._ws._socket;
    if (!socket || typeof socket.getPeerCertificate !== 'function') {
      return new Error('gateway tls fingerprint unavailable');
    }
    const cert = socket.getPeerCertificate();
    const fingerprint = normalizeFingerprint(cert?.fingerprint256 ?? '');
    if (!fingerprint) {
      return new Error('gateway tls fingerprint unavailable');
    }
    if (fingerprint !== expected) {
      return new Error('gateway tls fingerprint mismatch');
    }
    return null;
  }
  async request(method, params, opts) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      throw new Error('gateway not connected');
    }
    const id = randomUUID();
    const frame = { type: 'req', id, method, params };
    if (!validateRequestFrame(frame)) {
      throw new Error(
        `invalid request frame: ${JSON.stringify(validateRequestFrame.errors, null, 2)}`
      );
    }
    const expectFinal = opts?.expectFinal === true;
    const p = new Promise((resolve, reject) => {
      this._pending.set(id, {
        resolve: (value) => resolve(value),
        reject,
        expectFinal
      });
    });
    this._ws.send(JSON.stringify(frame));
    return p;
  }
}
export {
  GATEWAY_CLOSE_CODE_HINTS,
  GatewayClient,
  describeGatewayCloseCode
};
