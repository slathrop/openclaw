/**
 * Gateway lock file mechanism with PID-based ownership.
 *
 * Provides exclusive lock acquisition for the gateway process using atomic
 * file creation, stale lock detection via /proc on Linux, and configurable
 * timeout-based polling.
 */
import {createHash} from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {resolveConfigPath, resolveGatewayLockDir, resolveStateDir} from '../config/paths.js';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_STALE_MS = 30_000;

/**
 * @typedef {{
 *   pid: number,
 *   createdAt: string,
 *   configPath: string,
 *   startTime?: number
 * }} LockPayload
 */

/**
 * @typedef {{
 *   lockPath: string,
 *   configPath: string,
 *   release: () => Promise<void>
 * }} GatewayLockHandle
 */

/**
 * @typedef {{
 *   env?: NodeJS.ProcessEnv,
 *   timeoutMs?: number,
 *   pollIntervalMs?: number,
 *   staleMs?: number,
 *   allowInTests?: boolean,
 *   platform?: NodeJS.Platform
 * }} GatewayLockOptions
 */

export class GatewayLockError extends Error {
  /**
   * @param {string} message
   * @param {unknown} [cause]
   */
  constructor(message, cause) {
    super(message);
    this.name = 'GatewayLockError';
    /** @type {unknown} */
    this.cause = cause;
  }
}

/** @typedef {'alive' | 'dead' | 'unknown'} LockOwnerStatus */

/**
 * @param {number} pid
 * @returns {boolean}
 */
function isAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} arg
 * @returns {string}
 */
function normalizeProcArg(arg) {
  return arg.replaceAll('\\', '/').toLowerCase();
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
function parseProcCmdline(raw) {
  return raw
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * @param {string[]} args
 * @returns {boolean}
 */
function isGatewayArgv(args) {
  const normalized = args.map(normalizeProcArg);
  if (!normalized.includes('gateway')) {
    return false;
  }

  const entryCandidates = [
    'dist/index.js',
    'dist/entry.js',
    'openclaw.mjs',
    'scripts/run-node.mjs',
    'src/index.ts'
  ];
  if (normalized.some((arg) => entryCandidates.some((entry) => arg.endsWith(entry)))) {
    return true;
  }

  const exe = normalized[0] ?? '';
  return exe.endsWith('/openclaw') || exe === 'openclaw';
}

/**
 * @param {number} pid
 * @returns {string[] | null}
 */
function readLinuxCmdline(pid) {
  try {
    const raw = fsSync.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
    return parseProcCmdline(raw);
  } catch {
    return null;
  }
}

/**
 * @param {number} pid
 * @returns {number | null}
 */
function readLinuxStartTime(pid) {
  try {
    const raw = fsSync.readFileSync(`/proc/${pid}/stat`, 'utf8').trim();
    const closeParen = raw.lastIndexOf(')');
    if (closeParen < 0) {
      return null;
    }
    const rest = raw.slice(closeParen + 1).trim();
    const fields = rest.split(/\s+/);
    const startTime = Number.parseInt(fields[19] ?? '', 10);
    return Number.isFinite(startTime) ? startTime : null;
  } catch {
    return null;
  }
}

/**
 * Determine whether the process holding the lock is still the original
 * gateway process or a recycled PID.
 * @param {number} pid
 * @param {LockPayload | null} payload
 * @param {NodeJS.Platform} platform
 * @returns {LockOwnerStatus}
 */
function resolveGatewayOwnerStatus(pid, payload, platform) {
  if (!isAlive(pid)) {
    return 'dead';
  }
  if (platform !== 'linux') {
    return 'alive';
  }

  const payloadStartTime = payload?.startTime;
  if (Number.isFinite(payloadStartTime)) {
    const currentStartTime = readLinuxStartTime(pid);
    if (currentStartTime === null || currentStartTime === undefined) {
      return 'unknown';
    }
    return currentStartTime === payloadStartTime ? 'alive' : 'dead';
  }

  const args = readLinuxCmdline(pid);
  if (!args) {
    return 'unknown';
  }
  return isGatewayArgv(args) ? 'alive' : 'dead';
}

/**
 * @param {string} lockPath
 * @returns {Promise<LockPayload | null>}
 */
async function readLockPayload(lockPath) {
  try {
    const raw = await fs.readFile(lockPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.pid !== 'number') {
      return null;
    }
    if (typeof parsed.createdAt !== 'string') {
      return null;
    }
    if (typeof parsed.configPath !== 'string') {
      return null;
    }
    const startTime = typeof parsed.startTime === 'number' ? parsed.startTime : undefined;
    return {
      pid: parsed.pid,
      createdAt: parsed.createdAt,
      configPath: parsed.configPath,
      startTime
    };
  } catch {
    return null;
  }
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ lockPath: string, configPath: string }}
 */
function resolveGatewayLockPath(env) {
  const stateDir = resolveStateDir(env);
  const configPath = resolveConfigPath(env, stateDir);
  const hash = createHash('sha1').update(configPath).digest('hex').slice(0, 8);
  const lockDir = resolveGatewayLockDir();
  const lockPath = path.join(lockDir, `gateway.${hash}.lock`);
  return {lockPath, configPath};
}

/**
 * Acquire an exclusive gateway lock. Returns null when skipped (test env
 * or multi-gateway mode). Throws GatewayLockError on timeout or I/O failure.
 * @param {GatewayLockOptions} [opts]
 * @returns {Promise<GatewayLockHandle | null>}
 */
export async function acquireGatewayLock(opts = {}) {
  const env = opts.env ?? process.env;
  const allowInTests = opts.allowInTests === true;
  if (
    env.OPENCLAW_ALLOW_MULTI_GATEWAY === '1' ||
    (!allowInTests && (env.VITEST || env.NODE_ENV === 'test'))
  ) {
    return null;
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const staleMs = opts.staleMs ?? DEFAULT_STALE_MS;
  const platform = opts.platform ?? process.platform;
  const {lockPath, configPath} = resolveGatewayLockPath(env);
  await fs.mkdir(path.dirname(lockPath), {recursive: true});

  const startedAt = Date.now();
  /** @type {LockPayload | null} */
  let lastPayload = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const handle = await fs.open(lockPath, 'wx');
      const startTime = platform === 'linux' ? readLinuxStartTime(process.pid) : null;
      /** @type {LockPayload} */
      const payload = {
        pid: process.pid,
        createdAt: new Date().toISOString(),
        configPath
      };
      if (typeof startTime === 'number' && Number.isFinite(startTime)) {
        payload.startTime = startTime;
      }
      await handle.writeFile(JSON.stringify(payload), 'utf8');
      return {
        lockPath,
        configPath,
        release: async () => {
          await handle.close().catch(() => undefined);
          await fs.rm(lockPath, {force: true});
        }
      };
    } catch (err) {
      const code = /** @type {{ code?: unknown }} */ (err).code;
      if (code !== 'EEXIST') {
        throw new GatewayLockError(`failed to acquire gateway lock at ${lockPath}`, err);
      }

      lastPayload = await readLockPayload(lockPath);
      const ownerPid = lastPayload?.pid;
      const ownerStatus = ownerPid
        ? resolveGatewayOwnerStatus(ownerPid, lastPayload, platform)
        : 'unknown';
      if (ownerStatus === 'dead' && ownerPid) {
        await fs.rm(lockPath, {force: true});
        continue;
      }
      if (ownerStatus !== 'alive') {
        let stale = false;
        if (lastPayload?.createdAt) {
          const createdAt = Date.parse(lastPayload.createdAt);
          stale = Number.isFinite(createdAt) ? Date.now() - createdAt > staleMs : false;
        }
        if (!stale) {
          try {
            const st = await fs.stat(lockPath);
            stale = Date.now() - st.mtimeMs > staleMs;
          } catch {
            stale = true;
          }
        }
        if (stale) {
          await fs.rm(lockPath, {force: true});
          continue;
        }
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  }

  const owner = lastPayload?.pid ? ` (pid ${lastPayload.pid})` : '';
  throw new GatewayLockError(`gateway already running${owner}; lock timeout after ${timeoutMs}ms`);
}
