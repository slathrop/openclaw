/**
 * Dotenv loading for OpenClaw.
 *
 * Loads .env files from the CWD and the global OpenClaw config
 * directory (~/.openclaw/.env) as a fallback without overriding
 * already-set env vars.
 *
 * SECURITY: Loaded env vars may include API keys and other secrets.
 * The global .env file should have restricted permissions (0o600).
 */

import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import {resolveConfigDir} from '../utils.js';

/**
 * Loads .env files from CWD and global config dir.
 * @param {{ quiet?: boolean }} [opts]
 */
export function loadDotEnv(opts) {
  const quiet = opts?.quiet ?? true;

  // Load from process CWD first (dotenv default).
  dotenv.config({quiet});

  // Then load global fallback: ~/.openclaw/.env (or OPENCLAW_STATE_DIR/.env),
  // without overriding any env vars already present.
  const globalEnvPath = path.join(resolveConfigDir(process.env), '.env');
  if (!fs.existsSync(globalEnvPath)) {
    return;
  }

  dotenv.config({quiet, path: globalEnvPath, override: false});
}
