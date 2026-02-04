/**
 * Git commit hash resolution for build identification.
 *
 * Resolves the current git commit from multiple sources in priority order:
 * environment variables, build-info.json, package.json gitHead,
 * and finally reading .git/HEAD directly.
 * Result is cached after first resolution.
 */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

/**
 * Formats a commit hash to 7 characters.
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
const formatCommit = (value) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > 7 ? trimmed.slice(0, 7) : trimmed;
};

/**
 * Walks up from startDir to find the .git/HEAD file.
 * @param {string} startDir
 * @returns {string | null}
 */
const resolveGitHead = (startDir) => {
  let current = startDir;
  for (let i = 0; i < 12; i += 1) {
    const gitPath = path.join(current, '.git');
    try {
      const stat = fs.statSync(gitPath);
      if (stat.isDirectory()) {
        return path.join(gitPath, 'HEAD');
      }
      if (stat.isFile()) {
        const raw = fs.readFileSync(gitPath, 'utf-8');
        const match = raw.match(/gitdir:\s*(.+)/i);
        if (match?.[1]) {
          const resolved = path.resolve(current, match[1].trim());
          return path.join(resolved, 'HEAD');
        }
      }
    } catch {
      // ignore missing .git at this level
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
};

let cachedCommit;

const readCommitFromPackageJson = () => {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../../package.json');
    return formatCommit(pkg.gitHead ?? pkg.githead ?? null);
  } catch {
    return null;
  }
};

const readCommitFromBuildInfo = () => {
  try {
    const require = createRequire(import.meta.url);
    const candidates = ['../build-info.json', './build-info.json'];
    for (const candidate of candidates) {
      try {
        const info = require(candidate);
        const formatted = formatCommit(info.commit ?? null);
        if (formatted) {
          return formatted;
        }
      } catch {
        // ignore missing candidate
      }
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Resolves the current git commit hash (7 chars).
 * Checks env vars, build-info.json, package.json, then .git/HEAD.
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv }} [options]
 * @returns {string | null}
 */
export const resolveCommitHash = (options = {}) => {
  if (cachedCommit !== undefined) {
    return cachedCommit;
  }
  const env = options.env ?? process.env;
  const envCommit = env.GIT_COMMIT?.trim() || env.GIT_SHA?.trim();
  const normalized = formatCommit(envCommit);
  if (normalized) {
    cachedCommit = normalized;
    return cachedCommit;
  }
  const buildInfoCommit = readCommitFromBuildInfo();
  if (buildInfoCommit) {
    cachedCommit = buildInfoCommit;
    return cachedCommit;
  }
  const pkgCommit = readCommitFromPackageJson();
  if (pkgCommit) {
    cachedCommit = pkgCommit;
    return cachedCommit;
  }
  try {
    const headPath = resolveGitHead(options.cwd ?? process.cwd());
    if (!headPath) {
      cachedCommit = null;
      return cachedCommit;
    }
    const head = fs.readFileSync(headPath, 'utf-8').trim();
    if (!head) {
      cachedCommit = null;
      return cachedCommit;
    }
    if (head.startsWith('ref:')) {
      const ref = head.replace(/^ref:\s*/i, '').trim();
      const refPath = path.resolve(path.dirname(headPath), ref);
      const refHash = fs.readFileSync(refPath, 'utf-8').trim();
      cachedCommit = formatCommit(refHash);
      return cachedCommit;
    }
    cachedCommit = formatCommit(head);
    return cachedCommit;
  } catch {
    cachedCommit = null;
    return cachedCommit;
  }
};
