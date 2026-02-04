/**
 * Platform-aware shell command builder for child process spawning.
 *
 * Returns cmd.exe args on Windows, /bin/sh -lc on Unix.
 */

/**
 * Builds a platform-appropriate shell command array.
 * @param {string} command
 * @param {string | null} [platform]
 * @returns {string[]}
 */
export function buildNodeShellCommand(command, platform) {
  const normalized = String(platform ?? '')
    .trim()
    .toLowerCase();
  if (normalized.startsWith('win')) {
    return ['cmd.exe', '/d', '/s', '/c', command];
  }
  return ['/bin/sh', '-lc', command];
}
