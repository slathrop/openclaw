/**
 * Control UI asset resolution and build automation.
 *
 * Locates the control-ui dist directory from various entry point
 * configurations (repo root, dist bundle, .bin symlink, packaged app).
 * Triggers automatic builds when assets are missing in development.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runCommandWithTimeout} from '../process/exec.js';
import {defaultRuntime} from '../runtime.js';
import {resolveOpenClawPackageRoot, resolveOpenClawPackageRootSync} from './openclaw-root.js';

/**
 * Resolves the repo root from argv1 by looking for ui/vite.config.ts.
 * @param {string} [argv1]
 * @returns {string | null}
 */
export function resolveControlUiRepoRoot(argv1 = process.argv[1]) {
  if (!argv1) {
    return null;
  }
  const normalized = path.resolve(argv1);
  const parts = normalized.split(path.sep);
  const srcIndex = parts.lastIndexOf('src');
  if (srcIndex !== -1) {
    const root = parts.slice(0, srcIndex).join(path.sep);
    if (fs.existsSync(path.join(root, 'ui', 'vite.config.ts'))) {
      return root;
    }
  }

  let dir = path.dirname(normalized);
  for (let i = 0; i < 8; i++) {
    if (
      fs.existsSync(path.join(dir, 'package.json')) &&
      fs.existsSync(path.join(dir, 'ui', 'vite.config.ts'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return null;
}

/**
 * Resolves the dist control-ui index.html path from argv1.
 * @param {string} [argv1]
 * @returns {Promise<string | null>}
 */
export async function resolveControlUiDistIndexPath(argv1 = process.argv[1]) {
  if (!argv1) {
    return null;
  }
  const normalized = path.resolve(argv1);

  // Case 1: entrypoint is directly inside dist/ (e.g., dist/entry.js)
  const distDir = path.dirname(normalized);
  if (path.basename(distDir) === 'dist') {
    return path.join(distDir, 'control-ui', 'index.html');
  }

  const packageRoot = await resolveOpenClawPackageRoot({argv1: normalized});
  if (!packageRoot) {
    return null;
  }
  return path.join(packageRoot, 'dist', 'control-ui', 'index.html');
}

/**
 * @param {Set<string>} candidates
 * @param {string | null} value
 */
function addCandidate(candidates, value) {
  if (!value) {
    return;
  }
  candidates.add(path.resolve(value));
}

/**
 * Resolves a control-ui root from an explicit override path.
 * @param {string} rootOverride
 * @returns {string | null}
 */
export function resolveControlUiRootOverrideSync(rootOverride) {
  const resolved = path.resolve(rootOverride);
  try {
    const stats = fs.statSync(resolved);
    if (stats.isFile()) {
      return path.basename(resolved) === 'index.html' ? path.dirname(resolved) : null;
    }
    if (stats.isDirectory()) {
      const indexPath = path.join(resolved, 'index.html');
      return fs.existsSync(indexPath) ? resolved : null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Resolves the control-ui root directory synchronously.
 * Searches multiple candidate locations based on argv1, moduleUrl, cwd, and execPath.
 * @param {{
 *   argv1?: string,
 *   moduleUrl?: string,
 *   cwd?: string,
 *   execPath?: string
 * }} [opts]
 * @returns {string | null}
 */
export function resolveControlUiRootSync(opts = {}) {
  const candidates = new Set();
  const argv1 = opts.argv1 ?? process.argv[1];
  const cwd = opts.cwd ?? process.cwd();
  const moduleDir = opts.moduleUrl ? path.dirname(fileURLToPath(opts.moduleUrl)) : null;
  const argv1Dir = argv1 ? path.dirname(path.resolve(argv1)) : null;
  const execDir = (() => {
    try {
      const execPath = opts.execPath ?? process.execPath;
      return path.dirname(fs.realpathSync(execPath));
    } catch {
      return null;
    }
  })();
  const packageRoot = resolveOpenClawPackageRootSync({
    argv1,
    moduleUrl: opts.moduleUrl,
    cwd
  });

  // Packaged app: control-ui lives alongside the executable.
  addCandidate(candidates, execDir ? path.join(execDir, 'control-ui') : null);
  if (moduleDir) {
    // dist/<bundle>.js -> dist/control-ui
    addCandidate(candidates, path.join(moduleDir, 'control-ui'));
    // dist/gateway/control-ui.js -> dist/control-ui
    addCandidate(candidates, path.join(moduleDir, '../control-ui'));
    // src/gateway/control-ui.ts -> dist/control-ui
    addCandidate(candidates, path.join(moduleDir, '../../dist/control-ui'));
  }
  if (argv1Dir) {
    // openclaw.mjs or dist/<bundle>.js
    addCandidate(candidates, path.join(argv1Dir, 'dist', 'control-ui'));
    addCandidate(candidates, path.join(argv1Dir, 'control-ui'));
  }
  if (packageRoot) {
    addCandidate(candidates, path.join(packageRoot, 'dist', 'control-ui'));
  }
  addCandidate(candidates, path.join(cwd, 'dist', 'control-ui'));

  for (const dir of candidates) {
    const indexPath = path.join(dir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return dir;
    }
  }
  return null;
}

/**
 * @param {string} text
 * @returns {string | undefined}
 */
function summarizeCommandOutput(text) {
  const lines = text
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) {
    return undefined;
  }
  const last = lines.at(-1);
  if (!last) {
    return undefined;
  }
  return last.length > 240 ? `${last.slice(0, 239)}...` : last;
}

/**
 * Ensures control-ui assets are built, triggering a build if needed.
 * @param {import('../runtime.js').RuntimeEnv} [runtime]
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ ok: boolean, built: boolean, message?: string }>}
 */
export async function ensureControlUiAssetsBuilt(
  runtime = defaultRuntime,
  opts
) {
  const indexFromDist = await resolveControlUiDistIndexPath(process.argv[1]);
  if (indexFromDist && fs.existsSync(indexFromDist)) {
    return {ok: true, built: false};
  }

  const repoRoot = resolveControlUiRepoRoot(process.argv[1]);
  if (!repoRoot) {
    const hint = indexFromDist
      ? `Missing Control UI assets at ${indexFromDist}`
      : 'Missing Control UI assets';
    return {
      ok: false,
      built: false,
      message: `${hint}. Build them with \`pnpm ui:build\` (auto-installs UI deps).`
    };
  }

  const indexPath = path.join(repoRoot, 'dist', 'control-ui', 'index.html');
  if (fs.existsSync(indexPath)) {
    return {ok: true, built: false};
  }

  const uiScript = path.join(repoRoot, 'scripts', 'ui.js');
  if (!fs.existsSync(uiScript)) {
    return {
      ok: false,
      built: false,
      message: `Control UI assets missing but ${uiScript} is unavailable.`
    };
  }

  runtime.log('Control UI assets missing; building (ui:build, auto-installs UI deps)...');

  const build = await runCommandWithTimeout([process.execPath, uiScript, 'build'], {
    cwd: repoRoot,
    timeoutMs: opts?.timeoutMs ?? 10 * 60_000
  });
  if (build.code !== 0) {
    return {
      ok: false,
      built: false,
      message: `Control UI build failed: ${summarizeCommandOutput(build.stderr) ?? `exit ${build.code}`}`
    };
  }

  if (!fs.existsSync(indexPath)) {
    return {
      ok: false,
      built: true,
      message: `Control UI build completed but ${indexPath} is still missing.`
    };
  }

  return {ok: true, built: true};
}
