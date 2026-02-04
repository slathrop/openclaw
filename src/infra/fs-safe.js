/**
 * Safe file operations within a root directory boundary.
 *
 * Opens files with path traversal prevention, symlink blocking,
 * and inode verification to ensure reads stay within the root.
 * SECURITY: Prevents path traversal attacks via symlinks and relative paths.
 */
import {constants as fsConstants} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {"invalid-path" | "not-found"} SafeOpenErrorCode
 */

/**
 * @typedef {{
 *   handle: import('node:fs/promises').FileHandle,
 *   realPath: string,
 *   stat: import('node:fs').Stats
 * }} SafeOpenResult
 */

export class SafeOpenError extends Error {
  /**
   * @param {SafeOpenErrorCode} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'SafeOpenError';
  }
}

const NOT_FOUND_CODES = new Set(['ENOENT', 'ENOTDIR']);

/** @param {string} value */
const ensureTrailingSep = (value) => (value.endsWith(path.sep) ? value : value + path.sep);

/**
 * Checks if an error is a Node.js errno exception.
 * @param {unknown} err
 * @returns {boolean}
 */
const isNodeError = (err) =>
  Boolean(err && typeof err === 'object' && 'code' in err);

/** @param {unknown} err */
const isNotFoundError = (err) =>
  isNodeError(err) && typeof err.code === 'string' && NOT_FOUND_CODES.has(err.code);

/** @param {unknown} err */
const isSymlinkOpenError = (err) =>
  isNodeError(err) && (err.code === 'ELOOP' || err.code === 'EINVAL' || err.code === 'ENOTSUP');

/**
 * Opens a file within a root directory, preventing path traversal.
 * SECURITY: Validates realpath stays within root, blocks symlinks,
 * and verifies inode consistency.
 * @param {{ rootDir: string, relativePath: string }} params
 * @returns {Promise<SafeOpenResult>}
 */
export async function openFileWithinRoot(params) {
  let rootReal;
  try {
    rootReal = await fs.realpath(params.rootDir);
  } catch (err) {
    if (isNotFoundError(err)) {
      throw new SafeOpenError('not-found', 'root dir not found');
    }
    throw err;
  }
  const rootWithSep = ensureTrailingSep(rootReal);
  const resolved = path.resolve(rootWithSep, params.relativePath);
  if (!resolved.startsWith(rootWithSep)) {
    throw new SafeOpenError('invalid-path', 'path escapes root');
  }

  const supportsNoFollow = process.platform !== 'win32' && 'O_NOFOLLOW' in fsConstants;
  const flags = fsConstants.O_RDONLY | (supportsNoFollow ? fsConstants.O_NOFOLLOW : 0);

  let handle;
  try {
    handle = await fs.open(resolved, flags);
  } catch (err) {
    if (isNotFoundError(err)) {
      throw new SafeOpenError('not-found', 'file not found');
    }
    if (isSymlinkOpenError(err)) {
      throw new SafeOpenError('invalid-path', 'symlink open blocked');
    }
    throw err;
  }

  try {
    const lstat = await fs.lstat(resolved).catch(() => null);
    if (lstat?.isSymbolicLink()) {
      throw new SafeOpenError('invalid-path', 'symlink not allowed');
    }

    const realPath = await fs.realpath(resolved);
    if (!realPath.startsWith(rootWithSep)) {
      throw new SafeOpenError('invalid-path', 'path escapes root');
    }

    const stat = await handle.stat();
    if (!stat.isFile()) {
      throw new SafeOpenError('invalid-path', 'not a file');
    }

    const realStat = await fs.stat(realPath);
    if (stat.ino !== realStat.ino || stat.dev !== realStat.dev) {
      throw new SafeOpenError('invalid-path', 'path mismatch');
    }

    return {handle, realPath, stat};
  } catch (err) {
    await handle.close().catch(() => {});
    if (err instanceof SafeOpenError) {
      throw err;
    }
    if (isNotFoundError(err)) {
      throw new SafeOpenError('not-found', 'file not found');
    }
    throw err;
  }
}
