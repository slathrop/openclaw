/**
 * OpenClaw package root resolution.
 *
 * Walks up the directory tree from various candidate locations
 * (module URL, argv[1], cwd) to find the nearest directory
 * containing a package.json with the "openclaw" package name.
 * Provides both async and sync variants.
 */
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const CORE_PACKAGE_NAMES = new Set(['openclaw']);

/**
 * Reads the "name" field from a package.json in the given directory.
 * @param {string} dir
 * @returns {Promise<string | null>}
 */
async function readPackageName(dir) {
  try {
    const raw = await fs.readFile(path.join(dir, 'package.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    return typeof parsed.name === 'string' ? parsed.name : null;
  } catch {
    return null;
  }
}

/**
 * Reads the "name" field from a package.json synchronously.
 * @param {string} dir
 * @returns {string | null}
 */
function readPackageNameSync(dir) {
  try {
    const raw = fsSync.readFileSync(path.join(dir, 'package.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    return typeof parsed.name === 'string' ? parsed.name : null;
  } catch {
    return null;
  }
}

/**
 * Walks up from startDir to find a directory with an "openclaw" package.json.
 * @param {string} startDir
 * @param {number} [maxDepth]
 * @returns {Promise<string | null>}
 */
async function findPackageRoot(startDir, maxDepth = 12) {
  let current = path.resolve(startDir);
  for (let i = 0; i < maxDepth; i += 1) {
    const name = await readPackageName(current);
    if (name && CORE_PACKAGE_NAMES.has(name)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

/**
 * Synchronous variant of findPackageRoot.
 * @param {string} startDir
 * @param {number} [maxDepth]
 * @returns {string | null}
 */
function findPackageRootSync(startDir, maxDepth = 12) {
  let current = path.resolve(startDir);
  for (let i = 0; i < maxDepth; i += 1) {
    const name = readPackageNameSync(current);
    if (name && CORE_PACKAGE_NAMES.has(name)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

/**
 * Generates candidate directories from argv[1], including .bin resolution.
 * @param {string} argv1
 * @returns {string[]}
 */
function candidateDirsFromArgv1(argv1) {
  const normalized = path.resolve(argv1);
  const candidates = [path.dirname(normalized)];
  const parts = normalized.split(path.sep);
  const binIndex = parts.lastIndexOf('.bin');
  if (binIndex > 0 && parts[binIndex - 1] === 'node_modules') {
    const binName = path.basename(normalized);
    const nodeModulesDir = parts.slice(0, binIndex).join(path.sep);
    candidates.push(path.join(nodeModulesDir, binName));
  }
  return candidates;
}

/**
 * Resolves the OpenClaw package root directory (async).
 * @param {{ cwd?: string, argv1?: string, moduleUrl?: string }} opts
 * @returns {Promise<string | null>}
 */
export async function resolveOpenClawPackageRoot(opts) {
  const candidates = [];

  if (opts.moduleUrl) {
    candidates.push(path.dirname(fileURLToPath(opts.moduleUrl)));
  }
  if (opts.argv1) {
    candidates.push(...candidateDirsFromArgv1(opts.argv1));
  }
  if (opts.cwd) {
    candidates.push(opts.cwd);
  }

  for (const candidate of candidates) {
    const found = await findPackageRoot(candidate);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * Resolves the OpenClaw package root directory (sync).
 * @param {{ cwd?: string, argv1?: string, moduleUrl?: string }} opts
 * @returns {string | null}
 */
export function resolveOpenClawPackageRootSync(opts) {
  const candidates = [];

  if (opts.moduleUrl) {
    candidates.push(path.dirname(fileURLToPath(opts.moduleUrl)));
  }
  if (opts.argv1) {
    candidates.push(...candidateDirsFromArgv1(opts.argv1));
  }
  if (opts.cwd) {
    candidates.push(opts.cwd);
  }

  for (const candidate of candidates) {
    const found = findPackageRootSync(candidate);
    if (found) {
      return found;
    }
  }

  return null;
}
