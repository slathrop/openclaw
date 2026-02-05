/**
 * Logging configuration reader.
 *
 * Reads the logging section from the OpenClaw JSON5 config file.
 * Returns undefined when the config file is missing or malformed.
 */
import json5 from 'json5';
import fs from 'node:fs';
import { resolveConfigPath } from '../config/paths.js';

/**
 * @returns {object | undefined}
 */
export const readLoggingConfig = () => {
  const configPath = resolveConfigPath();
  try {
    if (!fs.existsSync(configPath)) {
      return undefined;
    }
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = json5.parse(raw);
    const logging = parsed?.logging;
    if (!logging || typeof logging !== 'object' || Array.isArray(logging)) {
      return undefined;
    }
    return logging;
  } catch {
    return undefined;
  }
};
