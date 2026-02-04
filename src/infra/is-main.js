/**
 * Determines whether the current module is the main entry point.
 *
 * Supports standard Node.js argv detection, PM2 process manager
 * (via pm_exec_path), and basename fallback for symlinked binaries.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Normalizes a path candidate by resolving and following realpaths.
 * @param {string | undefined} candidate
 * @param {string} cwd
 * @returns {string | undefined}
 */
function normalizePathCandidate(candidate, cwd) {
  if (!candidate) {
    return undefined;
  }

  const resolved = path.resolve(cwd, candidate);
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

/**
 * Checks whether the current file is the main module.
 * @param {{
 *   currentFile: string,
 *   argv?: string[],
 *   env?: NodeJS.ProcessEnv,
 *   cwd?: string
 * }} options
 * @returns {boolean}
 */
export function isMainModule({
  currentFile,
  argv = process.argv,
  env = process.env,
  cwd = process.cwd()
}) {
  const normalizedCurrent = normalizePathCandidate(currentFile, cwd);
  const normalizedArgv1 = normalizePathCandidate(argv[1], cwd);

  if (normalizedCurrent && normalizedArgv1 && normalizedCurrent === normalizedArgv1) {
    return true;
  }

  // PM2 runs the script via an internal wrapper; `argv[1]` points at the wrapper.
  // PM2 exposes the actual script path in `pm_exec_path`.
  const normalizedPmExecPath = normalizePathCandidate(env.pm_exec_path, cwd);
  if (normalizedCurrent && normalizedPmExecPath && normalizedCurrent === normalizedPmExecPath) {
    return true;
  }

  // Fallback: basename match (relative paths, symlinked bins).
  if (
    normalizedCurrent &&
    normalizedArgv1 &&
    path.basename(normalizedCurrent) === path.basename(normalizedArgv1)
  ) {
    return true;
  }

  return false;
}
