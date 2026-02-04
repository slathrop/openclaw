/**
 * Restart sentinel file management.
 *
 * Writes, reads, and consumes a JSON sentinel file that captures restart context
 * (kind, status, delivery routing, stats) to survive gateway restarts.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {formatCliCommand} from '../cli/command-format.js';
import {resolveStateDir} from '../config/paths.js';

/**
 * @typedef {{
 *   stdoutTail?: string | null,
 *   stderrTail?: string | null,
 *   exitCode?: number | null
 * }} RestartSentinelLog
 */

/**
 * @typedef {{
 *   name: string,
 *   command: string,
 *   cwd?: string | null,
 *   durationMs?: number | null,
 *   log?: RestartSentinelLog | null
 * }} RestartSentinelStep
 */

/**
 * @typedef {{
 *   mode?: string,
 *   root?: string,
 *   before?: Record<string, unknown> | null,
 *   after?: Record<string, unknown> | null,
 *   steps?: RestartSentinelStep[],
 *   reason?: string | null,
 *   durationMs?: number | null
 * }} RestartSentinelStats
 */

/**
 * @typedef {{
 *   kind: 'config-apply' | 'update' | 'restart',
 *   status: 'ok' | 'error' | 'skipped',
 *   ts: number,
 *   sessionKey?: string,
 *   deliveryContext?: { channel?: string, to?: string, accountId?: string },
 *   threadId?: string,
 *   message?: string | null,
 *   doctorHint?: string | null,
 *   stats?: RestartSentinelStats | null
 * }} RestartSentinelPayload
 */

/**
 * @typedef {{
 *   version: 1,
 *   payload: RestartSentinelPayload
 * }} RestartSentinel
 */

const SENTINEL_FILENAME = 'restart-sentinel.json';

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function formatDoctorNonInteractiveHint(env = process.env) {
  return `Run: ${formatCliCommand('openclaw doctor --non-interactive', env)}`;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function resolveRestartSentinelPath(env = process.env) {
  return path.join(resolveStateDir(env), SENTINEL_FILENAME);
}

/**
 * @param {RestartSentinelPayload} payload
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<string>}
 */
export async function writeRestartSentinel(payload, env = process.env) {
  const filePath = resolveRestartSentinelPath(env);
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  const data = {version: 1, payload};
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  return filePath;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<RestartSentinel | null>}
 */
export async function readRestartSentinel(env = process.env) {
  const filePath = resolveRestartSentinelPath(env);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      await fs.unlink(filePath).catch(() => {});
      return null;
    }
    if (!parsed || parsed.version !== 1 || !parsed.payload) {
      await fs.unlink(filePath).catch(() => {});
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<RestartSentinel | null>}
 */
export async function consumeRestartSentinel(env = process.env) {
  const filePath = resolveRestartSentinelPath(env);
  const parsed = await readRestartSentinel(env);
  if (!parsed) {
    return null;
  }
  await fs.unlink(filePath).catch(() => {});
  return parsed;
}

/**
 * @param {RestartSentinelPayload} payload
 * @returns {string}
 */
export function formatRestartSentinelMessage(payload) {
  return `GatewayRestart:\n${JSON.stringify(payload, null, 2)}`;
}

/**
 * @param {RestartSentinelPayload} payload
 * @returns {string}
 */
export function summarizeRestartSentinel(payload) {
  const kind = payload.kind;
  const status = payload.status;
  const mode = payload.stats?.mode ? ` (${payload.stats.mode})` : '';
  return `Gateway restart ${kind} ${status}${mode}`.trim();
}

/**
 * Trim a log string to the last maxChars characters.
 * @param {string | null | undefined} input
 * @param {number} [maxChars]
 * @returns {string | null}
 */
export function trimLogTail(input, maxChars = 8000) {
  if (!input) {
    return null;
  }
  const text = input.trimEnd();
  if (text.length <= maxChars) {
    return text;
  }
  return `\u2026${text.slice(text.length - maxChars)}`;
}
