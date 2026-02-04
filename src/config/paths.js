/**
 * Config and state directory path resolution.
 *
 * Resolves filesystem paths for config files, state directories,
 * gateway locks, and OAuth credentials. Supports legacy directory
 * names (.clawdbot, .moltbot, .moldbot) with fallback to the
 * current .openclaw directory.
 *
 * SECURITY: These paths determine where credentials and secrets are stored on disk.
 * Changes to resolution logic affect the location of sensitive data including
 * OAuth tokens, API keys, and session files.
 *
 * Path precedence:
 * 1. Explicit env var overrides (OPENCLAW_CONFIG_PATH, OPENCLAW_STATE_DIR)
 * 2. Legacy env var overrides (CLAWDBOT_CONFIG_PATH, CLAWDBOT_STATE_DIR)
 * 3. Existing directories (new .openclaw first, then legacy names)
 * 4. Default: ~/.openclaw
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Nix mode detection: When OPENCLAW_NIX_MODE=1, the gateway is running under Nix.
 * In this mode:
 * - No auto-install flows should be attempted
 * - Missing dependencies should produce actionable Nix-specific error messages
 * - Config is managed externally (read-only from Nix perspective)
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function resolveIsNixMode(env = process.env) {
  return env.OPENCLAW_NIX_MODE === '1';
}

export const isNixMode = resolveIsNixMode();

const LEGACY_STATE_DIRNAMES = ['.clawdbot', '.moltbot', '.moldbot'];
const NEW_STATE_DIRNAME = '.openclaw';
const CONFIG_FILENAME = 'openclaw.json';
const LEGACY_CONFIG_FILENAMES = ['clawdbot.json', 'moltbot.json', 'moldbot.json'];

/** @param {() => string} [homedir] */
function legacyStateDirs(homedir = os.homedir) {
  return LEGACY_STATE_DIRNAMES.map((dir) => path.join(homedir(), dir));
}

/** @param {() => string} [homedir] */
function newStateDir(homedir = os.homedir) {
  return path.join(homedir(), NEW_STATE_DIRNAME);
}

/**
 * @param {() => string} [homedir]
 * @returns {string}
 */
export function resolveLegacyStateDir(homedir = os.homedir) {
  return legacyStateDirs(homedir)[0] ?? newStateDir(homedir);
}

/**
 * @param {() => string} [homedir]
 * @returns {string[]}
 */
export function resolveLegacyStateDirs(homedir = os.homedir) {
  return legacyStateDirs(homedir);
}

/**
 * @param {() => string} [homedir]
 * @returns {string}
 */
export function resolveNewStateDir(homedir = os.homedir) {
  return newStateDir(homedir);
}

/**
 * State directory for mutable data (sessions, logs, caches).
 * Can be overridden via OPENCLAW_STATE_DIR.
 * Default: ~/.openclaw
 * @param {NodeJS.ProcessEnv} [env]
 * @param {() => string} [homedir]
 * @returns {string}
 */
export function resolveStateDir(env = process.env, homedir = os.homedir) {
  const override = env.OPENCLAW_STATE_DIR?.trim() || env.CLAWDBOT_STATE_DIR?.trim();
  if (override) {
    return resolveUserPath(override);
  }
  const newDir = newStateDir(homedir);
  const legacyDirs = legacyStateDirs(homedir);
  const hasNew = fs.existsSync(newDir);
  if (hasNew) {
    return newDir;
  }
  const existingLegacy = legacyDirs.find((dir) => {
    try {
      return fs.existsSync(dir);
    } catch {
      return false;
    }
  });
  if (existingLegacy) {
    return existingLegacy;
  }
  return newDir;
}

/**
 * @param {string} input
 * @returns {string}
 */
function resolveUserPath(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith('~')) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
}

export const STATE_DIR = resolveStateDir();

/**
 * Config file path (JSON5).
 * Can be overridden via OPENCLAW_CONFIG_PATH.
 * Default: ~/.openclaw/openclaw.json (or $OPENCLAW_STATE_DIR/openclaw.json)
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [stateDir]
 * @returns {string}
 */
export function resolveCanonicalConfigPath(
  env = process.env,
  stateDir = resolveStateDir(env, os.homedir)
) {
  const override = env.OPENCLAW_CONFIG_PATH?.trim() || env.CLAWDBOT_CONFIG_PATH?.trim();
  if (override) {
    return resolveUserPath(override);
  }
  return path.join(stateDir, CONFIG_FILENAME);
}

/**
 * Resolve the active config path by preferring existing config candidates
 * before falling back to the canonical path.
 * @param {NodeJS.ProcessEnv} [env]
 * @param {() => string} [homedir]
 * @returns {string}
 */
export function resolveConfigPathCandidate(env = process.env, homedir = os.homedir) {
  const candidates = resolveDefaultConfigCandidates(env, homedir);
  const existing = candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
  if (existing) {
    return existing;
  }
  return resolveCanonicalConfigPath(env, resolveStateDir(env, homedir));
}

/**
 * Active config path (prefers existing config files).
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [stateDir]
 * @param {() => string} [homedir]
 * @returns {string}
 */
export function resolveConfigPath(
  env = process.env,
  stateDir = resolveStateDir(env, os.homedir),
  homedir = os.homedir
) {
  const override = env.OPENCLAW_CONFIG_PATH?.trim();
  if (override) {
    return resolveUserPath(override);
  }
  const stateOverride = env.OPENCLAW_STATE_DIR?.trim();
  const candidates = [
    path.join(stateDir, CONFIG_FILENAME),
    ...LEGACY_CONFIG_FILENAMES.map((name) => path.join(stateDir, name))
  ];
  const existing = candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
  if (existing) {
    return existing;
  }
  if (stateOverride) {
    return path.join(stateDir, CONFIG_FILENAME);
  }
  const defaultStateDir = resolveStateDir(env, homedir);
  if (path.resolve(stateDir) === path.resolve(defaultStateDir)) {
    return resolveConfigPathCandidate(env, homedir);
  }
  return path.join(stateDir, CONFIG_FILENAME);
}

export const CONFIG_PATH = resolveConfigPathCandidate();

/**
 * Resolve default config path candidates across default locations.
 * Order: explicit config path -> state-dir-derived paths -> new default.
 * @param {NodeJS.ProcessEnv} [env]
 * @param {() => string} [homedir]
 * @returns {string[]}
 */
export function resolveDefaultConfigCandidates(env = process.env, homedir = os.homedir) {
  const explicit = env.OPENCLAW_CONFIG_PATH?.trim() || env.CLAWDBOT_CONFIG_PATH?.trim();
  if (explicit) {
    return [resolveUserPath(explicit)];
  }

  const candidates = [];
  const openclawStateDir = env.OPENCLAW_STATE_DIR?.trim() || env.CLAWDBOT_STATE_DIR?.trim();
  if (openclawStateDir) {
    const resolved = resolveUserPath(openclawStateDir);
    candidates.push(path.join(resolved, CONFIG_FILENAME));
    candidates.push(...LEGACY_CONFIG_FILENAMES.map((name) => path.join(resolved, name)));
  }

  const defaultDirs = [newStateDir(homedir), ...legacyStateDirs(homedir)];
  for (const dir of defaultDirs) {
    candidates.push(path.join(dir, CONFIG_FILENAME));
    candidates.push(...LEGACY_CONFIG_FILENAMES.map((name) => path.join(dir, name)));
  }
  return candidates;
}

export const DEFAULT_GATEWAY_PORT = 18789;

/**
 * Gateway lock directory (ephemeral).
 * Default: os.tmpdir()/openclaw-<uid> (uid suffix when available).
 * @param {() => string} [tmpdir]
 * @returns {string}
 */
export function resolveGatewayLockDir(tmpdir = os.tmpdir) {
  const base = tmpdir();
  const uid = typeof process.getuid === 'function' ? process.getuid() : undefined;
  const suffix = uid !== null && uid !== undefined ? `openclaw-${uid}` : 'openclaw';
  return path.join(base, suffix);
}

const OAUTH_FILENAME = 'oauth.json';

/**
 * OAuth credentials storage directory.
 *
 * SECURITY: This directory contains OAuth tokens and credentials.
 *
 * Precedence:
 * - `OPENCLAW_OAUTH_DIR` (explicit override)
 * - `$*_STATE_DIR/credentials` (canonical server/default)
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [stateDir]
 * @returns {string}
 */
export function resolveOAuthDir(
  env = process.env,
  stateDir = resolveStateDir(env, os.homedir)
) {
  const override = env.OPENCLAW_OAUTH_DIR?.trim();
  if (override) {
    return resolveUserPath(override);
  }
  return path.join(stateDir, 'credentials');
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [stateDir]
 * @returns {string}
 */
export function resolveOAuthPath(
  env = process.env,
  stateDir = resolveStateDir(env, os.homedir)
) {
  return path.join(resolveOAuthDir(env, stateDir), OAUTH_FILENAME);
}

/**
 * Resolves the gateway port from config and env.
 * @param {import('./types.js').OpenClawConfig} [cfg]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function resolveGatewayPort(cfg, env = process.env) {
  const envRaw = env.OPENCLAW_GATEWAY_PORT?.trim() || env.CLAWDBOT_GATEWAY_PORT?.trim();
  if (envRaw) {
    const parsed = Number.parseInt(envRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  const configPort = cfg?.gateway?.port;
  if (typeof configPort === 'number' && Number.isFinite(configPort)) {
    if (configPort > 0) {
      return configPort;
    }
  }
  return DEFAULT_GATEWAY_PORT;
}
