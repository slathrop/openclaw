/**
 * @module system-prompt-params
 * Assembles system prompt parameters from config, repo, and environment.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  formatUserTime,
  resolveUserTimeFormat,
  resolveUserTimezone
} from './date-time.js';
function buildSystemPromptParams(params) {
  const repoRoot = resolveRepoRoot({
    config: params.config,
    workspaceDir: params.workspaceDir,
    cwd: params.cwd
  });
  const userTimezone = resolveUserTimezone(params.config?.agents?.defaults?.userTimezone);
  const userTimeFormat = resolveUserTimeFormat(params.config?.agents?.defaults?.timeFormat);
  const userTime = formatUserTime(/* @__PURE__ */ new Date(), userTimezone, userTimeFormat);
  return {
    runtimeInfo: {
      agentId: params.agentId,
      ...params.runtime,
      repoRoot
    },
    userTimezone,
    userTime,
    userTimeFormat
  };
}
function resolveRepoRoot(params) {
  const configured = params.config?.agents?.defaults?.repoRoot?.trim();
  if (configured) {
    try {
      const resolved = path.resolve(configured);
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        return resolved;
      }
    } catch {
    // intentionally ignored
    }
  }
  const candidates = [params.workspaceDir, params.cwd].map((value) => value?.trim()).filter(Boolean);
  const seen = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    const root = findGitRoot(resolved);
    if (root) {
      return root;
    }
  }
  return void 0;
}
function findGitRoot(startDir) {
  let current = path.resolve(startDir);
  for (let i = 0; i < 12; i += 1) {
    const gitPath = path.join(current, '.git');
    try {
      const stat = fs.statSync(gitPath);
      if (stat.isDirectory() || stat.isFile()) {
        return current;
      }
    } catch {
    // intentionally ignored
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}
export {
  buildSystemPromptParams
};
