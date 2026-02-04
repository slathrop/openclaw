/**
 * SSH config resolution via `ssh -G`.
 *
 * Resolves effective SSH configuration for a target host by invoking
 * `ssh -G` and parsing its output for user, hostname, port, and identity files.
 *
 * SECURITY: Uses '--' separator before user@host to prevent option injection.
 */
import {spawn} from 'node:child_process';

/**
 * @typedef {{
 *   user?: string,
 *   host?: string,
 *   port?: number,
 *   identityFiles: string[]
 * }} SshResolvedConfig
 */

/**
 * @param {string | undefined} value
 * @returns {number | undefined}
 */
function parsePort(value) {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

/**
 * Parse the output of `ssh -G` into structured config.
 * @param {string} output
 * @returns {SshResolvedConfig}
 */
export function parseSshConfigOutput(output) {
  /** @type {SshResolvedConfig} */
  const result = {identityFiles: []};
  const lines = output.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    const [key, ...rest] = line.split(/\s+/);
    const value = rest.join(' ').trim();
    if (!key || !value) {
      continue;
    }
    switch (key) {
      case 'user':
        result.user = value;
        break;
      case 'hostname':
        result.host = value;
        break;
      case 'port':
        result.port = parsePort(value);
        break;
      case 'identityfile':
        if (value !== 'none') {
          result.identityFiles.push(value);
        }
        break;
      default:
        break;
    }
  }
  return result;
}

/**
 * Resolve effective SSH config for a target by running `ssh -G`.
 * SECURITY: Uses '--' separator before user@host to prevent option injection.
 * @param {import('./ssh-tunnel.js').SshParsedTarget} target
 * @param {{ identity?: string, timeoutMs?: number }} [opts]
 * @returns {Promise<SshResolvedConfig | null>}
 */
export async function resolveSshConfig(target, opts = {}) {
  const sshPath = '/usr/bin/ssh';
  const args = ['-G'];
  if (target.port > 0 && target.port !== 22) {
    args.push('-p', String(target.port));
  }
  if (opts.identity?.trim()) {
    args.push('-i', opts.identity.trim());
  }
  const userHost = target.user ? `${target.user}@${target.host}` : target.host;
  // SECURITY: Use "--" so userHost can't be parsed as an ssh option.
  args.push('--', userHost);

  return await new Promise((resolve) => {
    const child = spawn(sshPath, args, {
      stdio: ['ignore', 'pipe', 'ignore']
    });
    let stdout = '';
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });

    const timeoutMs = Math.max(200, opts.timeoutMs ?? 800);
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } finally {
        resolve(null);
      }
    }, timeoutMs);

    child.once('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0 || !stdout.trim()) {
        resolve(null);
        return;
      }
      resolve(parseSshConfigOutput(stdout));
    });
  });
}
