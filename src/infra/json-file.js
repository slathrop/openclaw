/**
 * Synchronous JSON file read/write with secure permissions.
 *
 * SECURITY: Written files use mode 0o600 (owner-only read/write),
 * and directories are created with mode 0o700.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads and parses a JSON file, returning undefined if missing or invalid.
 * @param {string} pathname
 * @returns {unknown}
 */
export function loadJsonFile(pathname) {
  try {
    if (!fs.existsSync(pathname)) {
      return undefined;
    }
    const raw = fs.readFileSync(pathname, 'utf8');
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Saves data as formatted JSON to a file with secure permissions.
 * SECURITY: Creates parent directories with 0o700 and files with 0o600.
 * @param {string} pathname
 * @param {unknown} data
 */
export function saveJsonFile(pathname, data) {
  const dir = path.dirname(pathname);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  }
  fs.writeFileSync(pathname, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.chmodSync(pathname, 0o600);
}
