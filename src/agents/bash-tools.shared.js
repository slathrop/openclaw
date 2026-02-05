/**
 * @module bash-tools.shared
 * Shared bash tool sandbox configuration and utilities.
 * @typedef {object} BashSandboxConfig - Sandbox configuration for bash tools.
 * @property
 */

import { existsSync, statSync } from 'node:fs';
import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { sliceUtf16Safe } from '../utils.js';
import { assertSandboxPath } from './sandbox-paths.js';
import { killProcessTree } from './shell-utils.js';
const CHUNK_LIMIT = 8 * 1024;
function buildSandboxEnv(params) {
  const env = {
    PATH: params.defaultPath,
    HOME: params.containerWorkdir
  };
  for (const [key, value] of Object.entries(params.sandboxEnv ?? {})) {
    env[key] = value;
  }
  for (const [key, value] of Object.entries(params.paramsEnv ?? {})) {
    env[key] = value;
  }
  return env;
}
function coerceEnv(env) {
  const record = {};
  if (!env) {
    return record;
  }
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      record[key] = value;
    }
  }
  return record;
}
function buildDockerExecArgs(params) {
  const args = ['exec', '-i'];
  if (params.tty) {
    args.push('-t');
  }
  if (params.workdir) {
    args.push('-w', params.workdir);
  }
  for (const [key, value] of Object.entries(params.env)) {
    args.push('-e', `${key}=${value}`);
  }
  const hasCustomPath = typeof params.env.PATH === 'string' && params.env.PATH.length > 0;
  if (hasCustomPath) {
    args.push('-e', `OPENCLAW_PREPEND_PATH=${params.env.PATH}`);
  }
  const pathExport = hasCustomPath ? 'export PATH="${OPENCLAW_PREPEND_PATH}:$PATH"; unset OPENCLAW_PREPEND_PATH; ' : '';
  args.push(params.containerName, 'sh', '-lc', `${pathExport}${params.command}`);
  return args;
}
async function resolveSandboxWorkdir(params) {
  const fallback = params.sandbox.workspaceDir;
  try {
    const resolved = await assertSandboxPath({
      filePath: params.workdir,
      cwd: process.cwd(),
      root: params.sandbox.workspaceDir
    });
    const stats = await fs.stat(resolved.resolved);
    if (!stats.isDirectory()) {
      throw new Error('workdir is not a directory');
    }
    const relative = resolved.relative ? resolved.relative.split(path.sep).join(path.posix.sep) : '';
    const containerWorkdir = relative ? path.posix.join(params.sandbox.containerWorkdir, relative) : params.sandbox.containerWorkdir;
    return { hostWorkdir: resolved.resolved, containerWorkdir };
  } catch {
    params.warnings.push(
      `Warning: workdir "${params.workdir}" is unavailable; using "${fallback}".`
    );
    return {
      hostWorkdir: fallback,
      containerWorkdir: params.sandbox.containerWorkdir
    };
  }
}
function killSession(session) {
  const pid = session.pid ?? session.child?.pid;
  if (pid) {
    killProcessTree(pid);
  }
}
function resolveWorkdir(workdir, warnings) {
  const current = safeCwd();
  const fallback = current ?? homedir();
  try {
    const stats = statSync(workdir);
    if (stats.isDirectory()) {
      return workdir;
    }
  } catch { /* ignored */ }
  warnings.push(`Warning: workdir "${workdir}" is unavailable; using "${fallback}".`);
  return fallback;
}
function safeCwd() {
  try {
    const cwd = process.cwd();
    return existsSync(cwd) ? cwd : null;
  } catch {
    return null;
  }
}
function clampNumber(value, defaultValue, min, max) {
  if (value === void 0 || Number.isNaN(value)) {
    return defaultValue;
  }
  return Math.min(Math.max(value, min), max);
}
function readEnvInt(key) {
  const raw = process.env[key];
  if (!raw) {
    return void 0;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : void 0;
}
function chunkString(input, limit = CHUNK_LIMIT) {
  const chunks = [];
  for (let i = 0; i < input.length; i += limit) {
    chunks.push(input.slice(i, i + limit));
  }
  return chunks;
}
function truncateMiddle(str, max) {
  if (str.length <= max) {
    return str;
  }
  const half = Math.floor((max - 3) / 2);
  return `${sliceUtf16Safe(str, 0, half)}...${sliceUtf16Safe(str, -half)}`;
}
function sliceLogLines(text, offset, limit) {
  if (!text) {
    return { slice: '', totalLines: 0, totalChars: 0 };
  }
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  const totalLines = lines.length;
  const totalChars = text.length;
  let start = typeof offset === 'number' && Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  if (limit !== void 0 && offset === void 0) {
    const tailCount = Math.max(0, Math.floor(limit));
    start = Math.max(totalLines - tailCount, 0);
  }
  const end = typeof limit === 'number' && Number.isFinite(limit) ? start + Math.max(0, Math.floor(limit)) : void 0;
  return { slice: lines.slice(start, end).join('\n'), totalLines, totalChars };
}
function deriveSessionName(command) {
  const tokens = tokenizeCommand(command);
  if (tokens.length === 0) {
    return void 0;
  }
  const verb = tokens[0];
  let target = tokens.slice(1).find((t) => !t.startsWith('-'));
  if (!target) {
    target = tokens[1];
  }
  if (!target) {
    return verb;
  }
  const cleaned = truncateMiddle(stripQuotes(target), 48);
  return `${stripQuotes(verb)} ${cleaned}`;
}
function tokenizeCommand(command) {
  const matches = command.match(/(?:[^\s"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g) ?? [];
  return matches.map((token) => stripQuotes(token)).filter(Boolean);
}
function stripQuotes(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
function formatDuration(ms) {
  if (ms < 1e3) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1e3);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}m${rem.toString().padStart(2, '0')}s`;
}
function pad(str, width) {
  if (str.length >= width) {
    return str;
  }
  return str + ' '.repeat(width - str.length);
}
export {
  buildDockerExecArgs,
  buildSandboxEnv,
  chunkString,
  clampNumber,
  coerceEnv,
  deriveSessionName,
  formatDuration,
  killSession,
  pad,
  readEnvInt,
  resolveSandboxWorkdir,
  resolveWorkdir,
  sliceLogLines,
  truncateMiddle
};
