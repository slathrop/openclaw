/**
 * PATH environment bootstrap for OpenClaw CLI.
 *
 * Ensures the openclaw CLI binary is available on PATH even
 * when running under minimal environments like launchd or
 * inside a macOS app bundle.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {resolveBrewPathDirs} from './brew.js';
import {isTruthyEnvValue} from './env.js';

/**
 * Checks if a file is executable.
 * @param {string} filePath
 * @returns {boolean}
 */
function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a path is a directory.
 * @param {string} dirPath
 * @returns {boolean}
 */
function isDirectory(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Merges PATH entries, prepending new dirs and deduplicating.
 * @param {{ existing: string, prepend: string[] }} params
 * @returns {string}
 */
function mergePath(params) {
  const partsExisting = params.existing
    .split(path.delimiter)
    .map((part) => part.trim())
    .filter(Boolean);
  const partsPrepend = params.prepend.map((part) => part.trim()).filter(Boolean);

  const seen = new Set();
  const merged = [];
  for (const part of [...partsPrepend, ...partsExisting]) {
    if (!seen.has(part)) {
      seen.add(part);
      merged.push(part);
    }
  }
  return merged.join(path.delimiter);
}

/**
 * Discovers candidate bin directories for the openclaw CLI.
 * @param {{ execPath?: string, cwd?: string, homeDir?: string, platform?: NodeJS.Platform, pathEnv?: string }} opts
 * @returns {string[]}
 */
function candidateBinDirs(opts) {
  const execPath = opts.execPath ?? process.execPath;
  const cwd = opts.cwd ?? process.cwd();
  const homeDir = opts.homeDir ?? os.homedir();
  const platform = opts.platform ?? process.platform;

  const candidates = [];

  // Bundled macOS app: openclaw lives next to the executable
  try {
    const execDir = path.dirname(execPath);
    const siblingCli = path.join(execDir, 'openclaw');
    if (isExecutable(siblingCli)) {
      candidates.push(execDir);
    }
  } catch {
    // ignore
  }

  // Project-local installs
  const localBinDir = path.join(cwd, 'node_modules', '.bin');
  if (isExecutable(path.join(localBinDir, 'openclaw'))) {
    candidates.push(localBinDir);
  }

  const miseDataDir = process.env.MISE_DATA_DIR ?? path.join(homeDir, '.local', 'share', 'mise');
  const miseShims = path.join(miseDataDir, 'shims');
  if (isDirectory(miseShims)) {
    candidates.push(miseShims);
  }

  candidates.push(...resolveBrewPathDirs({homeDir}));

  // Common global install locations (macOS first)
  if (platform === 'darwin') {
    candidates.push(path.join(homeDir, 'Library', 'pnpm'));
  }
  if (process.env.XDG_BIN_HOME) {
    candidates.push(process.env.XDG_BIN_HOME);
  }
  candidates.push(path.join(homeDir, '.local', 'bin'));
  candidates.push(path.join(homeDir, '.local', 'share', 'pnpm'));
  candidates.push(path.join(homeDir, '.bun', 'bin'));
  candidates.push(path.join(homeDir, '.yarn', 'bin'));
  candidates.push('/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin');

  return candidates.filter(isDirectory);
}

/**
 * Best-effort PATH bootstrap so skills that require the openclaw CLI can run
 * under launchd/minimal environments (and inside the macOS app bundle).
 * @param {{ execPath?: string, cwd?: string, homeDir?: string, platform?: NodeJS.Platform, pathEnv?: string }} [opts]
 */
export function ensureOpenClawCliOnPath(opts = {}) {
  if (isTruthyEnvValue(process.env.OPENCLAW_PATH_BOOTSTRAPPED)) {
    return;
  }
  process.env.OPENCLAW_PATH_BOOTSTRAPPED = '1';

  const existing = opts.pathEnv ?? process.env.PATH ?? '';
  const prepend = candidateBinDirs(opts);
  if (prepend.length === 0) {
    return;
  }

  const merged = mergePath({existing, prepend});
  if (merged) {
    process.env.PATH = merged;
  }
}
