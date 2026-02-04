/**
 * lsof command resolution for port inspection.
 *
 * Finds the lsof binary from platform-specific standard paths,
 * with async and sync variants.
 */
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';

const LSOF_CANDIDATES =
  process.platform === 'darwin'
    ? ['/usr/sbin/lsof', '/usr/bin/lsof']
    : ['/usr/bin/lsof', '/usr/sbin/lsof'];

/**
 * Checks if a file is executable.
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function canExecute(filePath) {
  try {
    await fsPromises.access(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the lsof command path (async).
 * @returns {Promise<string>}
 */
export async function resolveLsofCommand() {
  for (const candidate of LSOF_CANDIDATES) {
    if (await canExecute(candidate)) {
      return candidate;
    }
  }
  return 'lsof';
}

/**
 * Resolves the lsof command path (sync).
 * @returns {string}
 */
export function resolveLsofCommandSync() {
  for (const candidate of LSOF_CANDIDATES) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // keep trying
    }
  }
  return 'lsof';
}
