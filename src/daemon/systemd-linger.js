import os from 'node:os';
import { runCommandWithTimeout, runExec } from '../process/exec.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

function resolveLoginctlUser(env) {
  const fromEnv = env.USER?.trim() || env.LOGNAME?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  try {
    return os.userInfo().username;
  } catch {
    return null;
  }
}
async function readSystemdUserLingerStatus(env) {
  const user = resolveLoginctlUser(env);
  if (!user) {
    return null;
  }
  try {
    const { stdout } = await runExec('loginctl', ['show-user', user, '-p', 'Linger'], {
      timeoutMs: 5e3
    });
    const line = stdout.split('\n').map((entry) => entry.trim()).find((entry) => entry.startsWith('Linger='));
    const value = line?.split('=')[1]?.trim().toLowerCase();
    if (value === 'yes' || value === 'no') {
      return { user, linger: value };
    }
  } catch {
    // Intentionally ignored
  }
  return null;
}
async function enableSystemdUserLinger(params) {
  const user = params.user ?? resolveLoginctlUser(params.env);
  if (!user) {
    return { ok: false, stdout: '', stderr: 'Missing user', code: 1 };
  }
  const needsSudo = typeof process.getuid === 'function' ? process.getuid() !== 0 : true;
  const sudoArgs = needsSudo && params.sudoMode !== void 0 ? ['sudo', ...params.sudoMode === 'non-interactive' ? ['-n'] : []] : [];
  const argv = [...sudoArgs, 'loginctl', 'enable-linger', user];
  try {
    const result = await runCommandWithTimeout(argv, { timeoutMs: 3e4 });
    return {
      ok: result.code === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code ?? 1
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, stdout: '', stderr: message, code: 1 };
  }
}
export {
  enableSystemdUserLinger,
  readSystemdUserLingerStatus
};
