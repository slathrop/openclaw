/**
 * WSL (Windows Subsystem for Linux) detection.
 *
 * Detects WSL via environment variables (WSL_INTEROP, WSL_DISTRO_NAME,
 * WSLENV) and /proc/sys/kernel/osrelease content. Result is cached.
 */
import fs from 'node:fs/promises';

let wslCached = null;

/**
 * Checks WSL-specific environment variables (sync).
 * @returns {boolean}
 */
export function isWSLEnv() {
  if (process.env.WSL_INTEROP || process.env.WSL_DISTRO_NAME || process.env.WSLENV) {
    return true;
  }
  return false;
}

/**
 * Detects whether running inside WSL (async, cached).
 * @returns {Promise<boolean>}
 */
export async function isWSL() {
  if (wslCached !== null) {
    return wslCached;
  }
  if (isWSLEnv()) {
    wslCached = true;
    return wslCached;
  }
  try {
    const release = await fs.readFile('/proc/sys/kernel/osrelease', 'utf8');
    wslCached =
      release.toLowerCase().includes('microsoft') || release.toLowerCase().includes('wsl');
  } catch {
    wslCached = false;
  }
  return wslCached;
}
