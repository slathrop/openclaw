/**
 * Machine display name resolution for device identification.
 *
 * On macOS, queries scutil for ComputerName/LocalHostName.
 * Falls back to os.hostname() with ".local" suffix stripped.
 * Result is cached after first resolution.
 */
import {execFile} from 'node:child_process';
import os from 'node:os';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);

let cachedPromise = null;

/**
 * Tries to read a scutil key (macOS only).
 * @param {"ComputerName" | "LocalHostName"} key
 * @returns {Promise<string | null>}
 */
async function tryScutil(key) {
  try {
    const {stdout} = await execFileAsync('/usr/sbin/scutil', ['--get', key], {
      timeout: 1000,
      windowsHide: true
    });
    const value = String(stdout ?? '').trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Returns hostname with ".local" suffix stripped.
 * @returns {string}
 */
function fallbackHostName() {
  return (
    os
      .hostname()
      .replace(/\.local$/i, '')
      .trim() || 'openclaw'
  );
}

/**
 * Resolves a human-readable display name for the current machine.
 * @returns {Promise<string>}
 */
export async function getMachineDisplayName() {
  if (cachedPromise) {
    return cachedPromise;
  }
  cachedPromise = (async () => {
    if (process.env.VITEST || process.env.NODE_ENV === 'test') {
      return fallbackHostName();
    }
    if (process.platform === 'darwin') {
      const computerName = await tryScutil('ComputerName');
      if (computerName) {
        return computerName;
      }
      const localHostName = await tryScutil('LocalHostName');
      if (localHostName) {
        return localHostName;
      }
    }
    return fallbackHostName();
  })();
  return cachedPromise;
}
