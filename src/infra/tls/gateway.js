/**
 * Gateway TLS configuration and certificate management.
 *
 * SECURITY: This module handles TLS certificate loading, auto-generation, and
 * fingerprint extraction for the gateway's HTTPS server. It manages the lifecycle
 * of TLS certificates including self-signed certificate generation for development.
 * Private key files are chmod 600 to restrict access. Certificate fingerprints
 * are extracted for client pinning verification. Minimum TLS version is enforced
 * at TLSv1.3 to prevent downgrade attacks.
 * @module
 */

import {execFile} from 'node:child_process';
import {X509Certificate} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {CONFIG_DIR, ensureDir, resolveUserPath, shortenHomeInString} from '../../utils.js';
import {normalizeFingerprint} from './fingerprint.js';

const execFileAsync = promisify(execFile);

/**
 * @typedef {object} GatewayTlsRuntime
 * @property {boolean} enabled
 * @property {boolean} required
 * @property {string} [certPath]
 * @property {string} [keyPath]
 * @property {string} [caPath]
 * @property {string} [fingerprintSha256]
 * @property {tls.TlsOptions} [tlsOptions]
 * @property {string} [error]
 */

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * SECURITY: Generates a self-signed certificate for development use.
 * Sets restrictive file permissions (0600) on the private key.
 * @param {object} params
 * @param {string} params.certPath
 * @param {string} params.keyPath
 * @param {{ info?: (msg: string) => void }} [params.log]
 * @returns {Promise<void>}
 */
async function generateSelfSignedCert(params) {
  const certDir = path.dirname(params.certPath);
  const keyDir = path.dirname(params.keyPath);
  await ensureDir(certDir);
  if (keyDir !== certDir) {
    await ensureDir(keyDir);
  }
  await execFileAsync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-sha256',
    '-days',
    '3650',
    '-nodes',
    '-keyout',
    params.keyPath,
    '-out',
    params.certPath,
    '-subj',
    '/CN=openclaw-gateway'
  ]);
  // SECURITY: Restrict private key file permissions to owner-only read/write
  await fs.chmod(params.keyPath, 0o600).catch(() => {});
  await fs.chmod(params.certPath, 0o600).catch(() => {});
  params.log?.info?.(
    `gateway tls: generated self-signed cert at ${shortenHomeInString(params.certPath)}`
  );
}

/**
 * SECURITY: Loads TLS configuration for the gateway. Validates certificate
 * existence, optionally auto-generates self-signed certs, extracts SHA-256
 * fingerprints for pinning, and enforces TLSv1.3 minimum version.
 * @param {import('../../config/types.gateway.js').GatewayTlsConfig | undefined} cfg
 * @param {{ info?: (msg: string) => void, warn?: (msg: string) => void }} [log]
 * @returns {Promise<GatewayTlsRuntime>}
 */
export async function loadGatewayTlsRuntime(cfg, log) {
  if (!cfg || cfg.enabled !== true) {
    return {enabled: false, required: false};
  }

  const autoGenerate = cfg.autoGenerate !== false;
  const baseDir = path.join(CONFIG_DIR, 'gateway', 'tls');
  const certPath = resolveUserPath(cfg.certPath ?? path.join(baseDir, 'gateway-cert.pem'));
  const keyPath = resolveUserPath(cfg.keyPath ?? path.join(baseDir, 'gateway-key.pem'));
  const caPath = cfg.caPath ? resolveUserPath(cfg.caPath) : undefined;

  const hasCert = await fileExists(certPath);
  const hasKey = await fileExists(keyPath);

  if (!hasCert && !hasKey && autoGenerate) {
    try {
      await generateSelfSignedCert({certPath, keyPath, log});
    } catch (err) {
      return {
        enabled: false,
        required: true,
        certPath,
        keyPath,
        error: `gateway tls: failed to generate cert (${String(err)})`
      };
    }
  }

  if (!(await fileExists(certPath)) || !(await fileExists(keyPath))) {
    return {
      enabled: false,
      required: true,
      certPath,
      keyPath,
      error: 'gateway tls: cert/key missing'
    };
  }

  try {
    const cert = await fs.readFile(certPath, 'utf8');
    const key = await fs.readFile(keyPath, 'utf8');
    const ca = caPath ? await fs.readFile(caPath, 'utf8') : undefined;
    const x509 = new X509Certificate(cert);
    const fingerprintSha256 = normalizeFingerprint(x509.fingerprint256 ?? '');

    if (!fingerprintSha256) {
      return {
        enabled: false,
        required: true,
        certPath,
        keyPath,
        caPath,
        error: 'gateway tls: unable to compute certificate fingerprint'
      };
    }

    return {
      enabled: true,
      required: true,
      certPath,
      keyPath,
      caPath,
      fingerprintSha256,
      tlsOptions: {
        cert,
        key,
        ca,
        minVersion: 'TLSv1.3'
      }
    };
  } catch (err) {
    return {
      enabled: false,
      required: true,
      certPath,
      keyPath,
      caPath,
      error: `gateway tls: failed to load cert (${String(err)})`
    };
  }
}
