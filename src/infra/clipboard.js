/**
 * Cross-platform clipboard copy utility.
 *
 * Tries multiple clipboard commands in order (pbcopy, xclip,
 * wl-copy, clip.exe, PowerShell) until one succeeds.
 */
import {runCommandWithTimeout} from '../process/exec.js';

/**
 * Copies a string value to the system clipboard.
 * @param {string} value
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(value) {
  const attempts = [
    {argv: ['pbcopy']},
    {argv: ['xclip', '-selection', 'clipboard']},
    {argv: ['wl-copy']},
    {argv: ['clip.exe']}, // WSL / Windows
    {argv: ['powershell', '-NoProfile', '-Command', 'Set-Clipboard']}
  ];
  for (const attempt of attempts) {
    try {
      const result = await runCommandWithTimeout(attempt.argv, {
        timeoutMs: 3_000,
        input: value
      });
      if (result.code === 0 && !result.killed) {
        return true;
      }
    } catch {
      // keep trying the next fallback
    }
  }
  return false;
}
