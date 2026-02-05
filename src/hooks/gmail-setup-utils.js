import fs from 'node:fs';
import path from 'node:path';
import { hasBinary } from '../agents/skills.js';
import { runCommandWithTimeout } from '../process/exec.js';
import { resolveUserPath } from '../utils.js';
import { normalizeServePath } from './gmail.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

let cachedPythonPath;
const MAX_OUTPUT_CHARS = 800;
function trimOutput(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.length <= MAX_OUTPUT_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_OUTPUT_CHARS)}\u2026`;
}
function formatCommandFailure(command, result) {
  const code = result.code ?? 'null';
  const signal = result.signal ? `, signal=${result.signal}` : '';
  const killed = result.killed ? ', killed=true' : '';
  const stderr = trimOutput(result.stderr);
  const stdout = trimOutput(result.stdout);
  const lines = [`${command} failed (code=${code}${signal}${killed})`];
  if (stderr) {
    lines.push(`stderr: ${stderr}`);
  }
  if (stdout) {
    lines.push(`stdout: ${stdout}`);
  }
  return lines.join('\n');
}
function formatCommandResult(command, result) {
  const code = result.code ?? 'null';
  const signal = result.signal ? `, signal=${result.signal}` : '';
  const killed = result.killed ? ', killed=true' : '';
  const stderr = trimOutput(result.stderr);
  const stdout = trimOutput(result.stdout);
  const lines = [`${command} exited (code=${code}${signal}${killed})`];
  if (stderr) {
    lines.push(`stderr: ${stderr}`);
  }
  if (stdout) {
    lines.push(`stdout: ${stdout}`);
  }
  return lines.join('\n');
}
function formatJsonParseFailure(command, result, err) {
  const reason = err instanceof Error ? err.message : String(err);
  return `${command} returned invalid JSON: ${reason}
${formatCommandResult(command, result)}`;
}
function formatCommand(command, args) {
  return [command, ...args].join(' ');
}
function findExecutablesOnPath(bins) {
  const pathEnv = process.env.PATH ?? '';
  const parts = pathEnv.split(path.delimiter).filter(Boolean);
  const seen = /* @__PURE__ */ new Set();
  const matches = [];
  for (const part of parts) {
    for (const bin of bins) {
      const candidate = path.join(part, bin);
      if (seen.has(candidate)) {
        continue;
      }
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        matches.push(candidate);
        seen.add(candidate);
      } catch {
        // Intentionally ignored
      }
    }
  }
  return matches;
}
function ensurePathIncludes(dirPath, position) {
  const pathEnv = process.env.PATH ?? '';
  const parts = pathEnv.split(path.delimiter).filter(Boolean);
  if (parts.includes(dirPath)) {
    return;
  }
  const next = position === 'prepend' ? [dirPath, ...parts] : [...parts, dirPath];
  process.env.PATH = next.join(path.delimiter);
}
function ensureGcloudOnPath() {
  if (hasBinary('gcloud')) {
    return true;
  }
  const candidates = [
    '/opt/homebrew/share/google-cloud-sdk/bin/gcloud',
    '/usr/local/share/google-cloud-sdk/bin/gcloud',
    '/opt/homebrew/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin/gcloud',
    '/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin/gcloud'
  ];
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      ensurePathIncludes(path.dirname(candidate), 'append');
      return true;
    } catch {
      // Intentionally ignored
    }
  }
  return false;
}
async function resolvePythonExecutablePath() {
  if (cachedPythonPath !== void 0) {
    return cachedPythonPath ?? void 0;
  }
  const candidates = findExecutablesOnPath(['python3', 'python']);
  for (const candidate of candidates) {
    const res = await runCommandWithTimeout(
      [candidate, '-c', 'import os, sys; print(os.path.realpath(sys.executable))'],
      { timeoutMs: 2e3 }
    );
    if (res.code !== 0) {
      continue;
    }
    const resolved = res.stdout.trim().split(/\s+/)[0];
    if (!resolved) {
      continue;
    }
    try {
      fs.accessSync(resolved, fs.constants.X_OK);
      cachedPythonPath = resolved;
      return resolved;
    } catch {
      // Intentionally ignored
    }
  }
  cachedPythonPath = null;
  return void 0;
}
async function gcloudEnv() {
  if (process.env.CLOUDSDK_PYTHON) {
    return void 0;
  }
  const pythonPath = await resolvePythonExecutablePath();
  if (!pythonPath) {
    return void 0;
  }
  return { CLOUDSDK_PYTHON: pythonPath };
}
async function runGcloudCommand(args, timeoutMs) {
  return await runCommandWithTimeout(['gcloud', ...args], {
    timeoutMs,
    env: await gcloudEnv()
  });
}
async function ensureDependency(bin, brewArgs) {
  if (bin === 'gcloud' && ensureGcloudOnPath()) {
    return;
  }
  if (hasBinary(bin)) {
    return;
  }
  if (process.platform !== 'darwin') {
    throw new Error(`${bin} not installed; install it and retry`);
  }
  if (!hasBinary('brew')) {
    throw new Error('Homebrew not installed (install brew and retry)');
  }
  const brewEnv = bin === 'gcloud' ? await gcloudEnv() : void 0;
  const result = await runCommandWithTimeout(['brew', 'install', ...brewArgs], {
    timeoutMs: 6e5,
    env: brewEnv
  });
  if (result.code !== 0) {
    throw new Error(`brew install failed for ${bin}: ${result.stderr || result.stdout}`);
  }
  if (!hasBinary(bin)) {
    throw new Error(`${bin} still not available after brew install`);
  }
}
async function ensureGcloudAuth() {
  const res = await runGcloudCommand(
    ['auth', 'list', '--filter', 'status:ACTIVE', '--format', 'value(account)'],
    3e4
  );
  if (res.code === 0 && res.stdout.trim()) {
    return;
  }
  const login = await runGcloudCommand(['auth', 'login'], 6e5);
  if (login.code !== 0) {
    throw new Error(login.stderr || 'gcloud auth login failed');
  }
}
async function runGcloud(args) {
  const result = await runGcloudCommand(args, 12e4);
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || 'gcloud command failed');
  }
  return result;
}
async function ensureTopic(projectId, topicName) {
  const describe = await runGcloudCommand(
    ['pubsub', 'topics', 'describe', topicName, '--project', projectId],
    3e4
  );
  if (describe.code === 0) {
    return;
  }
  await runGcloud(['pubsub', 'topics', 'create', topicName, '--project', projectId]);
}
async function ensureSubscription(projectId, subscription, topicName, pushEndpoint) {
  const describe = await runGcloudCommand(
    ['pubsub', 'subscriptions', 'describe', subscription, '--project', projectId],
    3e4
  );
  if (describe.code === 0) {
    await runGcloud([
      'pubsub',
      'subscriptions',
      'update',
      subscription,
      '--project',
      projectId,
      '--push-endpoint',
      pushEndpoint
    ]);
    return;
  }
  await runGcloud([
    'pubsub',
    'subscriptions',
    'create',
    subscription,
    '--project',
    projectId,
    '--topic',
    topicName,
    '--push-endpoint',
    pushEndpoint
  ]);
}
async function ensureTailscaleEndpoint(params) {
  if (params.mode === 'off') {
    return '';
  }
  const statusArgs = ['status', '--json'];
  const statusCommand = formatCommand('tailscale', statusArgs);
  const status = await runCommandWithTimeout(['tailscale', ...statusArgs], {
    timeoutMs: 3e4
  });
  if (status.code !== 0) {
    throw new Error(formatCommandFailure(statusCommand, status));
  }
  let parsed;
  try {
    parsed = JSON.parse(status.stdout);
  } catch (err) {
    throw new Error(formatJsonParseFailure(statusCommand, status, err), { cause: err });
  }
  const dnsName = parsed.Self?.DNSName?.replace(/\.$/, '');
  if (!dnsName) {
    throw new Error('tailscale DNS name missing; run tailscale up');
  }
  const target = typeof params.target === 'string' && params.target.trim().length > 0 ? params.target.trim() : params.port ? String(params.port) : '';
  if (!target) {
    throw new Error('tailscale target missing; set a port or target URL');
  }
  const pathArg = normalizeServePath(params.path);
  const funnelArgs = [params.mode, '--bg', '--set-path', pathArg, '--yes', target];
  const funnelCommand = formatCommand('tailscale', funnelArgs);
  const funnelResult = await runCommandWithTimeout(['tailscale', ...funnelArgs], {
    timeoutMs: 3e4
  });
  if (funnelResult.code !== 0) {
    throw new Error(formatCommandFailure(funnelCommand, funnelResult));
  }
  const baseUrl = `https://${dnsName}${pathArg}`;
  return params.token ? `${baseUrl}?token=${params.token}` : baseUrl;
}
async function resolveProjectIdFromGogCredentials() {
  const candidates = gogCredentialsPaths();
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }
    try {
      const raw = fs.readFileSync(candidate, 'utf-8');
      const parsed = JSON.parse(raw);
      const clientId = extractGogClientId(parsed);
      const projectNumber = extractProjectNumber(clientId);
      if (!projectNumber) {
        continue;
      }
      const res = await runGcloudCommand(
        [
          'projects',
          'list',
          '--filter',
          `projectNumber=${projectNumber}`,
          '--format',
          'value(projectId)'
        ],
        3e4
      );
      if (res.code !== 0) {
        continue;
      }
      const projectId = res.stdout.trim().split(/\s+/)[0];
      if (projectId) {
        return projectId;
      }
    } catch {
      // Intentionally ignored
    }
  }
  return null;
}
function gogCredentialsPaths() {
  const paths = [];
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) {
    paths.push(path.join(xdg, 'gogcli', 'credentials.json'));
  }
  paths.push(resolveUserPath('~/.config/gogcli/credentials.json'));
  if (process.platform === 'darwin') {
    paths.push(resolveUserPath('~/Library/Application Support/gogcli/credentials.json'));
  }
  return paths;
}
function extractGogClientId(parsed) {
  const installed = parsed.installed;
  const web = parsed.web;
  const candidate = installed?.client_id || web?.client_id || parsed.client_id || '';
  return typeof candidate === 'string' ? candidate : null;
}
function extractProjectNumber(clientId) {
  if (!clientId) {
    return null;
  }
  const match = clientId.match(/^(\d+)-/);
  return match?.[1] ?? null;
}
export {
  ensureDependency,
  ensureGcloudAuth,
  ensureSubscription,
  ensureTailscaleEndpoint,
  ensureTopic,
  resolveProjectIdFromGogCredentials,
  resolvePythonExecutablePath,
  runGcloud
};
