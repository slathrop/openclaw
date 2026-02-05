/**
 * @module shell-utils
 * Shell path resolution for PowerShell and platform-specific shells.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
function resolvePowerShellPath() {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR;
  if (systemRoot) {
    const candidate = path.join(
      systemRoot,
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe'
    );
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return 'powershell.exe';
}
function getShellConfig() {
  if (process.platform === 'win32') {
    return {
      shell: resolvePowerShellPath(),
      args: ['-NoProfile', '-NonInteractive', '-Command']
    };
  }
  const envShell = process.env.SHELL?.trim();
  const shellName = envShell ? path.basename(envShell) : '';
  if (shellName === 'fish') {
    const bash = resolveShellFromPath('bash');
    if (bash) {
      return { shell: bash, args: ['-c'] };
    }
    const sh = resolveShellFromPath('sh');
    if (sh) {
      return { shell: sh, args: ['-c'] };
    }
  }
  const shell = envShell && envShell.length > 0 ? envShell : 'sh';
  return { shell, args: ['-c'] };
}
function resolveShellFromPath(name) {
  const envPath = process.env.PATH ?? '';
  if (!envPath) {
    return void 0;
  }
  const entries = envPath.split(path.delimiter).filter(Boolean);
  for (const entry of entries) {
    const candidate = path.join(entry, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
    // intentionally ignored
    }
  }
  return void 0;
}
function sanitizeBinaryOutput(text) {
  const scrubbed = text.replace(/[\p{Format}\p{Surrogate}]/gu, '');
  if (!scrubbed) {
    return scrubbed;
  }
  const chunks = [];
  for (const char of scrubbed) {
    const code = char.codePointAt(0);
    if (code === null || code === undefined) {
      continue;
    }
    if (code === 9 || code === 10 || code === 13) {
      chunks.push(char);
      continue;
    }
    if (code < 32) {
      continue;
    }
    chunks.push(char);
  }
  return chunks.join('');
}
function killProcessTree(pid) {
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/F', '/T', '/PID', String(pid)], {
        stdio: 'ignore',
        detached: true
      });
    } catch {
    // intentionally ignored
    }
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
    // intentionally ignored
    }
  }
}
export {
  getShellConfig,
  killProcessTree,
  sanitizeBinaryOutput
};
