/**
 * OS platform summary for diagnostics and reporting.
 *
 * Resolves platform, architecture, and release information
 * with a human-readable label (e.g., "macos 14.0 (arm64)").
 */
import {spawnSync} from 'node:child_process';
import os from 'node:os';

/**
 * @typedef {{
 *   platform: string,
 *   arch: string,
 *   release: string,
 *   label: string
 * }} OsSummary
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function safeTrim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @returns {string}
 */
function macosVersion() {
  const res = spawnSync('sw_vers', ['-productVersion'], {encoding: 'utf-8'});
  const out = safeTrim(res.stdout);
  return out || os.release();
}

/**
 * Resolves a summary of the current OS platform.
 * @returns {OsSummary}
 */
export function resolveOsSummary() {
  const platform = os.platform();
  const release = os.release();
  const arch = os.arch();
  const label = (() => {
    if (platform === 'darwin') {
      return `macos ${macosVersion()} (${arch})`;
    }
    if (platform === 'win32') {
      return `windows ${release} (${arch})`;
    }
    return `${platform} ${release} (${arch})`;
  })();
  return {platform, arch, release, label};
}
