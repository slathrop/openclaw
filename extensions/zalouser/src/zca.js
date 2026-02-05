import { spawn } from 'node:child_process';
const ZCA_BINARY = 'zca';
const DEFAULT_TIMEOUT = 3e4;
function buildArgs(args, options) {
  const result = [];
  const profile = options?.profile || process.env.ZCA_PROFILE;
  if (profile) {
    result.push('--profile', profile);
  }
  result.push(...args);
  return result;
}
async function runZca(args, options) {
  const fullArgs = buildArgs(args, options);
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  return new Promise((resolve) => {
    const spawnOpts = {
      cwd: options?.cwd,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    };
    const proc = spawn(ZCA_BINARY, fullArgs, spawnOpts);
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);
    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({
          ok: false,
          stdout,
          stderr: stderr || 'Command timed out',
          exitCode: code ?? 124
        });
        return;
      }
      resolve({
        ok: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 1
      });
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        stdout: '',
        stderr: err.message,
        exitCode: 1
      });
    });
  });
}
function runZcaInteractive(args, options) {
  const fullArgs = buildArgs(args, options);
  return new Promise((resolve) => {
    const spawnOpts = {
      cwd: options?.cwd,
      env: { ...process.env },
      stdio: 'inherit'
    };
    const proc = spawn(ZCA_BINARY, fullArgs, spawnOpts);
    proc.on('close', (code) => {
      resolve({
        ok: code === 0,
        stdout: '',
        stderr: '',
        exitCode: code ?? 1
      });
    });
    proc.on('error', (err) => {
      resolve({
        ok: false,
        stdout: '',
        stderr: err.message,
        exitCode: 1
      });
    });
  });
}
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}
function parseJsonOutput(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    const cleaned = stripAnsi(stdout);
    try {
      return JSON.parse(cleaned);
    } catch {
      const lines = cleaned.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('{') || line.startsWith('[')) {
          const jsonCandidate = lines.slice(i).join('\n').trim();
          try {
            return JSON.parse(jsonCandidate);
          } catch {
            continue;
          }
        }
      }
      return null;
    }
  }
}
async function checkZcaInstalled() {
  const result = await runZca(['--version'], { timeout: 5e3 });
  return result.ok;
}
function runZcaStreaming(args, options) {
  const fullArgs = buildArgs(args, options);
  const spawnOpts = {
    cwd: options?.cwd,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe']
  };
  const proc = spawn(ZCA_BINARY, fullArgs, spawnOpts);
  let stdout = '';
  let stderr = '';
  proc.stdout?.on('data', (data) => {
    const text = data.toString();
    stdout += text;
    options?.onData?.(text);
  });
  proc.stderr?.on('data', (data) => {
    stderr += data.toString();
  });
  const promise = new Promise((resolve) => {
    proc.on('close', (code) => {
      resolve({
        ok: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 1
      });
    });
    proc.on('error', (err) => {
      options?.onError?.(err);
      resolve({
        ok: false,
        stdout: '',
        stderr: err.message,
        exitCode: 1
      });
    });
  });
  return { proc, promise };
}
export {
  checkZcaInstalled,
  parseJsonOutput,
  runZca,
  runZcaInteractive,
  runZcaStreaming
};
