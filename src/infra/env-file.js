/**
 * Shared .env file management.
 *
 * Reads and writes key=value pairs in the shared OpenClaw .env file.
 * Handles creation of the config directory and file permissions.
 *
 * SECURITY: The .env file may contain API keys and secrets.
 * Permissions are restricted to owner-only (0o600 file, 0o700 dir).
 */

import fs from 'node:fs';
import path from 'node:path';
import {resolveConfigDir} from '../utils.js';

/**
 * Escapes a string for use in a RegExp.
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Upserts a key=value pair in the shared .env file.
 * SECURITY: Creates directories and files with restrictive permissions.
 * @param {{ key: string, value: string, env?: NodeJS.ProcessEnv }} params
 * @returns {{ path: string, updated: boolean, created: boolean }}
 */
export function upsertSharedEnvVar(params) {
  const env = params.env ?? process.env;
  const dir = resolveConfigDir(env);
  const filepath = path.join(dir, '.env');
  const key = params.key.trim();
  const value = params.value;

  let raw = '';
  if (fs.existsSync(filepath)) {
    raw = fs.readFileSync(filepath, 'utf8');
  }

  const lines = raw.length ? raw.split(/\r?\n/) : [];
  const matcher = new RegExp(`^(\\s*(?:export\\s+)?)${escapeRegExp(key)}\\s*=`);
  let updated = false;
  let replaced = false;

  const nextLines = lines.map((line) => {
    const match = line.match(matcher);
    if (!match) {
      return line;
    }
    replaced = true;
    const prefix = match[1] ?? '';
    const next = `${prefix}${key}=${value}`;
    if (next !== line) {
      updated = true;
    }
    return next;
  });

  if (!replaced) {
    nextLines.push(`${key}=${value}`);
    updated = true;
  }

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  }

  const output = `${nextLines.join('\n')}\n`;
  fs.writeFileSync(filepath, output, 'utf8');
  fs.chmodSync(filepath, 0o600);

  return {path: filepath, updated, created: !raw};
}
