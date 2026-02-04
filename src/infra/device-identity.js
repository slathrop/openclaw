/**
 * Device identity management with Ed25519 key pairs.
 *
 * Generates, persists, and loads device identity (key pair + fingerprint).
 * Provides signing and verification for device authentication protocol.
 * SECURITY: Private key file stored with 0o600 permissions.
 * SECURITY: Device ID derived from SHA-256 hash of public key raw bytes.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * @typedef {{
 *   deviceId: string,
 *   publicKeyPem: string,
 *   privateKeyPem: string
 * }} DeviceIdentity
 */

const DEFAULT_DIR = path.join(os.homedir(), '.openclaw', 'identity');
const DEFAULT_FILE = path.join(DEFAULT_DIR, 'device.json');

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
}

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * @param {Buffer} buf
 * @returns {string}
 */
function base64UrlEncode(buf) {
  return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

/**
 * @param {string} input
 * @returns {Buffer}
 */
function base64UrlDecode(input) {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

/**
 * Extracts raw 32-byte public key from PEM by stripping the SPKI prefix.
 * @param {string} publicKeyPem
 * @returns {Buffer}
 */
function derivePublicKeyRaw(publicKeyPem) {
  const key = crypto.createPublicKey(publicKeyPem);
  const spki = key.export({type: 'spki', format: 'der'});
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

/**
 * SECURITY: Fingerprint is a SHA-256 hash of the raw public key bytes.
 * @param {string} publicKeyPem
 * @returns {string}
 */
function fingerprintPublicKey(publicKeyPem) {
  const raw = derivePublicKeyRaw(publicKeyPem);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * @returns {DeviceIdentity}
 */
function generateIdentity() {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({type: 'spki', format: 'pem'}).toString();
  const privateKeyPem = privateKey.export({type: 'pkcs8', format: 'pem'}).toString();
  const deviceId = fingerprintPublicKey(publicKeyPem);
  return {deviceId, publicKeyPem, privateKeyPem};
}

/**
 * Loads or creates a device identity from disk.
 * SECURITY: Identity file stored with 0o600 permissions; re-derives deviceId on load.
 * @param {string} [filePath]
 * @returns {DeviceIdentity}
 */
export function loadOrCreateDeviceIdentity(filePath = DEFAULT_FILE) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (
        parsed?.version === 1 &&
        typeof parsed.deviceId === 'string' &&
        typeof parsed.publicKeyPem === 'string' &&
        typeof parsed.privateKeyPem === 'string'
      ) {
        const derivedId = fingerprintPublicKey(parsed.publicKeyPem);
        if (derivedId && derivedId !== parsed.deviceId) {
          const updated = {
            ...parsed,
            deviceId: derivedId
          };
          fs.writeFileSync(filePath, `${JSON.stringify(updated, null, 2)}\n`, {mode: 0o600});
          try {
            fs.chmodSync(filePath, 0o600);
          } catch {
            // best-effort
          }
          return {
            deviceId: derivedId,
            publicKeyPem: parsed.publicKeyPem,
            privateKeyPem: parsed.privateKeyPem
          };
        }
        return {
          deviceId: parsed.deviceId,
          publicKeyPem: parsed.publicKeyPem,
          privateKeyPem: parsed.privateKeyPem
        };
      }
    }
  } catch {
    // fall through to regenerate
  }

  const identity = generateIdentity();
  ensureDir(filePath);
  const stored = {
    version: 1,
    deviceId: identity.deviceId,
    publicKeyPem: identity.publicKeyPem,
    privateKeyPem: identity.privateKeyPem,
    createdAtMs: Date.now()
  };
  fs.writeFileSync(filePath, `${JSON.stringify(stored, null, 2)}\n`, {mode: 0o600});
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // best-effort
  }
  return identity;
}

/**
 * Signs a payload using the device's Ed25519 private key.
 * SECURITY: Signature is base64url-encoded for safe transport.
 * @param {string} privateKeyPem
 * @param {string} payload
 * @returns {string}
 */
export function signDevicePayload(privateKeyPem, payload) {
  const key = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(payload, 'utf8'), key);
  return base64UrlEncode(sig);
}

/**
 * Normalizes a public key to base64url format.
 * @param {string} publicKey - PEM or base64url-encoded public key
 * @returns {string | null}
 */
export function normalizeDevicePublicKeyBase64Url(publicKey) {
  try {
    if (publicKey.includes('BEGIN')) {
      return base64UrlEncode(derivePublicKeyRaw(publicKey));
    }
    const raw = base64UrlDecode(publicKey);
    return base64UrlEncode(raw);
  } catch {
    return null;
  }
}

/**
 * Derives a device ID (SHA-256 fingerprint) from a public key.
 * @param {string} publicKey - PEM or base64url-encoded public key
 * @returns {string | null}
 */
export function deriveDeviceIdFromPublicKey(publicKey) {
  try {
    const raw = publicKey.includes('BEGIN')
      ? derivePublicKeyRaw(publicKey)
      : base64UrlDecode(publicKey);
    return crypto.createHash('sha256').update(raw).digest('hex');
  } catch {
    return null;
  }
}

/**
 * @param {string} publicKeyPem
 * @returns {string}
 */
export function publicKeyRawBase64UrlFromPem(publicKeyPem) {
  return base64UrlEncode(derivePublicKeyRaw(publicKeyPem));
}

/**
 * Verifies an Ed25519 signature against a public key and payload.
 * SECURITY: Accepts both PEM and raw base64url public keys for flexibility.
 * @param {string} publicKey
 * @param {string} payload
 * @param {string} signatureBase64Url
 * @returns {boolean}
 */
export function verifyDeviceSignature(publicKey, payload, signatureBase64Url) {
  try {
    const key = publicKey.includes('BEGIN')
      ? crypto.createPublicKey(publicKey)
      : crypto.createPublicKey({
        key: Buffer.concat([ED25519_SPKI_PREFIX, base64UrlDecode(publicKey)]),
        type: 'spki',
        format: 'der'
      });
    const sig = (() => {
      try {
        return base64UrlDecode(signatureBase64Url);
      } catch {
        return Buffer.from(signatureBase64Url, 'base64');
      }
    })();
    return crypto.verify(null, Buffer.from(payload, 'utf8'), key, sig);
  } catch {
    return false;
  }
}
