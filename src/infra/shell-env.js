/**
 * Shell environment fallback for login-shell env loading.
 *
 * Detects the user's login shell and runs it to capture environment
 * variables (e.g. API keys) that may not be set in the current
 * process. Used by the gateway and CLI to inherit vars from the
 * user's shell profile.
 */

import {execFileSync} from 'node:child_process';
import {isTruthyEnvValue} from './env.js';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BUFFER_BYTES = 2 * 1024 * 1024;
let lastAppliedKeys = [];
let cachedShellPath;

/**
 * @typedef {{ ok: true, applied: string[], skippedReason?: never } | { ok: true, applied: [], skippedReason: 'already-has-keys' | 'disabled' } | { ok: false, error: string, applied: [] }} ShellEnvFallbackResult
 */

/**
 * @typedef {object} ShellEnvFallbackOptions
 * @property {boolean} enabled
 * @property {NodeJS.ProcessEnv} env
 * @property {string[]} expectedKeys
 * @property {Pick<typeof console, 'warn'>} [logger]
 * @property {number} [timeoutMs]
 * @property {typeof execFileSync} [exec]
 */

/**
 * Resolves the user's login shell from SHELL env var.
 * @param {NodeJS.ProcessEnv} env
 * @returns {string}
 */
function resolveShell(env) {
  const shell = env.SHELL?.trim();
  return shell && shell.length > 0 ? shell : '/bin/sh';
}

/**
 * Parses null-delimited env output from a login shell.
 * @param {Buffer} stdout
 * @returns {Map<string, string>}
 */
function parseShellEnv(stdout) {
  const shellEnv = new Map();
  const parts = stdout.toString('utf8').split('\0');
  for (const part of parts) {
    if (!part) {
      continue;
    }
    const eq = part.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (!key) {
      continue;
    }
    shellEnv.set(key, value);
  }
  return shellEnv;
}

/**
 * Loads missing env vars from the user's login shell.
 * @param {ShellEnvFallbackOptions} opts
 * @returns {ShellEnvFallbackResult}
 */
export function loadShellEnvFallback(opts) {
  const logger = opts.logger ?? console;
  const exec = opts.exec ?? execFileSync;

  if (!opts.enabled) {
    lastAppliedKeys = [];
    return {ok: true, applied: [], skippedReason: 'disabled'};
  }

  const hasAnyKey = opts.expectedKeys.some((key) => Boolean(opts.env[key]?.trim()));
  if (hasAnyKey) {
    lastAppliedKeys = [];
    return {ok: true, applied: [], skippedReason: 'already-has-keys'};
  }

  const timeoutMs =
    typeof opts.timeoutMs === 'number' && Number.isFinite(opts.timeoutMs) ?
      Math.max(0, opts.timeoutMs) :
      DEFAULT_TIMEOUT_MS;

  const shell = resolveShell(opts.env);

  let stdout;
  try {
    stdout = exec(shell, ['-l', '-c', 'env -0'], {
      encoding: 'buffer',
      timeout: timeoutMs,
      maxBuffer: DEFAULT_MAX_BUFFER_BYTES,
      env: opts.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[openclaw] shell env fallback failed: ${msg}`);
    lastAppliedKeys = [];
    return {ok: false, error: msg, applied: []};
  }

  const shellEnv = parseShellEnv(stdout);

  const applied = [];
  for (const key of opts.expectedKeys) {
    if (opts.env[key]?.trim()) {
      continue;
    }
    const value = shellEnv.get(key);
    if (!value?.trim()) {
      continue;
    }
    opts.env[key] = value;
    applied.push(key);
  }

  lastAppliedKeys = applied;
  return {ok: true, applied};
}

/**
 * Returns whether shell env fallback is enabled via env var.
 * @param {NodeJS.ProcessEnv} env
 * @returns {boolean}
 */
export function shouldEnableShellEnvFallback(env) {
  return isTruthyEnvValue(env.OPENCLAW_LOAD_SHELL_ENV);
}

/**
 * Returns whether shell env fallback should be deferred.
 * @param {NodeJS.ProcessEnv} env
 * @returns {boolean}
 */
export function shouldDeferShellEnvFallback(env) {
  return isTruthyEnvValue(env.OPENCLAW_DEFER_SHELL_ENV_FALLBACK);
}

/**
 * Resolves the shell env fallback timeout from env var.
 * @param {NodeJS.ProcessEnv} env
 * @returns {number}
 */
export function resolveShellEnvFallbackTimeoutMs(env) {
  const raw = env.OPENCLAW_SHELL_ENV_TIMEOUT_MS?.trim();
  if (!raw) {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(0, parsed);
}

/**
 * Gets the PATH from a login shell (cached after first call).
 * @param {{ env: NodeJS.ProcessEnv, timeoutMs?: number, exec?: typeof execFileSync }} opts
 * @returns {string | null}
 */
export function getShellPathFromLoginShell(opts) {
  if (cachedShellPath !== undefined) {
    return cachedShellPath;
  }
  if (process.platform === 'win32') {
    cachedShellPath = null;
    return cachedShellPath;
  }

  const exec = opts.exec ?? execFileSync;
  const timeoutMs =
    typeof opts.timeoutMs === 'number' && Number.isFinite(opts.timeoutMs) ?
      Math.max(0, opts.timeoutMs) :
      DEFAULT_TIMEOUT_MS;
  const shell = resolveShell(opts.env);

  let stdout;
  try {
    stdout = exec(shell, ['-l', '-c', 'env -0'], {
      encoding: 'buffer',
      timeout: timeoutMs,
      maxBuffer: DEFAULT_MAX_BUFFER_BYTES,
      env: opts.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch {
    cachedShellPath = null;
    return cachedShellPath;
  }

  const shellEnv = parseShellEnv(stdout);
  const shellPath = shellEnv.get('PATH')?.trim();
  cachedShellPath = shellPath && shellPath.length > 0 ? shellPath : null;
  return cachedShellPath;
}

/**
 * Resets the cached shell PATH for testing.
 */
export function resetShellPathCacheForTests() {
  cachedShellPath = undefined;
}

/**
 * Returns the list of env keys that were applied by the last fallback.
 * @returns {string[]}
 */
export function getShellEnvAppliedKeys() {
  return [...lastAppliedKeys];
}
