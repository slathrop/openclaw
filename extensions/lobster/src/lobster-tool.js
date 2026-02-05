import { Type } from '@sinclair/typebox';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
function resolveExecutablePath(lobsterPathRaw) {
  const lobsterPath = lobsterPathRaw?.trim() || 'lobster';
  if (lobsterPath !== 'lobster') {
    if (!path.isAbsolute(lobsterPath)) {
      throw new Error('lobsterPath must be an absolute path (or omit to use PATH)');
    }
    const base = path.basename(lobsterPath).toLowerCase();
    const allowed = process.platform === 'win32' ? ['lobster.exe', 'lobster.cmd', 'lobster.bat'] : ['lobster'];
    if (!allowed.includes(base)) {
      throw new Error('lobsterPath must point to the lobster executable');
    }
    let stat;
    try {
      stat = fs.statSync(lobsterPath);
    } catch {
      throw new Error('lobsterPath must exist');
    }
    if (!stat.isFile()) {
      throw new Error('lobsterPath must point to a file');
    }
    if (process.platform !== 'win32') {
      try {
        fs.accessSync(lobsterPath, fs.constants.X_OK);
      } catch {
        throw new Error('lobsterPath must be executable');
      }
    }
  }
  return lobsterPath;
}
function normalizeForCwdSandbox(p) {
  const normalized = path.normalize(p);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}
function resolveCwd(cwdRaw) {
  if (typeof cwdRaw !== 'string' || !cwdRaw.trim()) {
    return process.cwd();
  }
  const cwd = cwdRaw.trim();
  if (path.isAbsolute(cwd)) {
    throw new Error('cwd must be a relative path');
  }
  const base = process.cwd();
  const resolved = path.resolve(base, cwd);
  const rel = path.relative(normalizeForCwdSandbox(base), normalizeForCwdSandbox(resolved));
  if (rel === '' || rel === '.') {
    return resolved;
  }
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('cwd must stay within the gateway working directory');
  }
  return resolved;
}
function isWindowsSpawnErrorThatCanUseShell(err) {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const code = err.code;
  return code === 'EINVAL' || code === 'ENOENT';
}
async function runLobsterSubprocessOnce(params, useShell) {
  const { execPath, argv, cwd } = params;
  const timeoutMs = Math.max(200, params.timeoutMs);
  const maxStdoutBytes = Math.max(1024, params.maxStdoutBytes);
  const env = { ...process.env, LOBSTER_MODE: 'tool' };
  const nodeOptions = env.NODE_OPTIONS ?? '';
  if (nodeOptions.includes('--inspect')) {
    delete env.NODE_OPTIONS;
  }
  return await new Promise((resolve, reject) => {
    const child = spawn(execPath, argv, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
      shell: useShell,
      windowsHide: useShell ? true : void 0
    });
    let stdout = '';
    let stdoutBytes = 0;
    let stderr = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      const str = String(chunk);
      stdoutBytes += Buffer.byteLength(str, 'utf8');
      if (stdoutBytes > maxStdoutBytes) {
        try {
          child.kill('SIGKILL');
        } finally {
          reject(new Error('lobster output exceeded maxStdoutBytes'));
        }
        return;
      }
      stdout += str;
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } finally {
        reject(new Error('lobster subprocess timed out'));
      }
    }, timeoutMs);
    child.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`lobster failed (${code ?? '?'}): ${stderr.trim() || stdout.trim()}`));
        return;
      }
      resolve({ stdout });
    });
  });
}
async function runLobsterSubprocess(params) {
  try {
    return await runLobsterSubprocessOnce(params, false);
  } catch (err) {
    if (process.platform === 'win32' && isWindowsSpawnErrorThatCanUseShell(err)) {
      return await runLobsterSubprocessOnce(params, true);
    }
    throw err;
  }
}
function parseEnvelope(stdout) {
  const trimmed = stdout.trim();
  const tryParse = (input) => {
    try {
      return JSON.parse(input);
    } catch {
      return void 0;
    }
  };
  let parsed = tryParse(trimmed);
  if (parsed === void 0) {
    const suffixMatch = trimmed.match(/({[\s\S]*}|\[[\s\S]*])\s*$/);
    if (suffixMatch?.[1]) {
      parsed = tryParse(suffixMatch[1]);
    }
  }
  if (parsed === void 0) {
    throw new Error('lobster returned invalid JSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('lobster returned invalid JSON envelope');
  }
  const ok = parsed.ok;
  if (ok === true || ok === false) {
    return parsed;
  }
  throw new Error('lobster returned invalid JSON envelope');
}
function createLobsterTool(api) {
  return {
    name: 'lobster',
    description: 'Run Lobster pipelines as a local-first workflow runtime (typed JSON envelope + resumable approvals).',
    parameters: Type.Object({
      // NOTE: Prefer string enums in tool schemas; some providers reject unions/anyOf.
      action: Type.Unsafe({ type: 'string', enum: ['run', 'resume'] }),
      pipeline: Type.Optional(Type.String()),
      argsJson: Type.Optional(Type.String()),
      token: Type.Optional(Type.String()),
      approve: Type.Optional(Type.Boolean()),
      // SECURITY: Do not allow the agent to choose an executable path.
      // Host can configure the lobster binary via plugin config.
      lobsterPath: Type.Optional(
        Type.String({ description: '(deprecated) Use plugin config instead.' })
      ),
      cwd: Type.Optional(
        Type.String({
          description: 'Relative working directory (optional). Must stay within the gateway working directory.'
        })
      ),
      timeoutMs: Type.Optional(Type.Number()),
      maxStdoutBytes: Type.Optional(Type.Number())
    }),
    async execute(_id, params) {
      const action = typeof params.action === 'string' ? params.action.trim() : '';
      if (!action) {
        throw new Error('action required');
      }
      if (typeof params.lobsterPath === 'string' && params.lobsterPath.trim()) {
        resolveExecutablePath(params.lobsterPath);
      }
      const execPath = resolveExecutablePath(
        typeof api.pluginConfig?.lobsterPath === 'string' ? api.pluginConfig.lobsterPath : void 0
      );
      const cwd = resolveCwd(params.cwd);
      const timeoutMs = typeof params.timeoutMs === 'number' ? params.timeoutMs : 2e4;
      const maxStdoutBytes = typeof params.maxStdoutBytes === 'number' ? params.maxStdoutBytes : 512e3;
      const argv = (() => {
        if (action === 'run') {
          const pipeline = typeof params.pipeline === 'string' ? params.pipeline : '';
          if (!pipeline.trim()) {
            throw new Error('pipeline required');
          }
          const argv2 = ['run', '--mode', 'tool', pipeline];
          const argsJson = typeof params.argsJson === 'string' ? params.argsJson : '';
          if (argsJson.trim()) {
            argv2.push('--args-json', argsJson);
          }
          return argv2;
        }
        if (action === 'resume') {
          const token = typeof params.token === 'string' ? params.token : '';
          if (!token.trim()) {
            throw new Error('token required');
          }
          const approve = params.approve;
          if (typeof approve !== 'boolean') {
            throw new Error('approve required');
          }
          return ['resume', '--token', token, '--approve', approve ? 'yes' : 'no'];
        }
        throw new Error(`Unknown action: ${action}`);
      })();
      if (api.runtime?.version && api.logger?.debug) {
        api.logger.debug(`lobster plugin runtime=${api.runtime.version}`);
      }
      const { stdout } = await runLobsterSubprocess({
        execPath,
        argv,
        cwd,
        timeoutMs,
        maxStdoutBytes
      });
      const envelope = parseEnvelope(stdout);
      return {
        content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
        details: envelope
      };
    }
  };
}
export {
  createLobsterTool
};
