/**
 * Constants for auth profile storage, locking, and external CLI sync.
 * @module agents/auth-profiles/constants
 */
import { createSubsystemLogger } from '../../logging/subsystem.js';
const AUTH_STORE_VERSION = 1;
const AUTH_PROFILE_FILENAME = 'auth-profiles.json';
const LEGACY_AUTH_FILENAME = 'auth.json';
const CLAUDE_CLI_PROFILE_ID = 'anthropic:claude-cli';
const CODEX_CLI_PROFILE_ID = 'openai-codex:codex-cli';
const QWEN_CLI_PROFILE_ID = 'qwen-portal:qwen-cli';
const MINIMAX_CLI_PROFILE_ID = 'minimax-portal:minimax-cli';
const AUTH_STORE_LOCK_OPTIONS = {
  retries: {
    retries: 10,
    factor: 2,
    minTimeout: 100,
    maxTimeout: 1e4,
    randomize: true
  },
  stale: 3e4
};
const EXTERNAL_CLI_SYNC_TTL_MS = 15 * 60 * 1e3;
const EXTERNAL_CLI_NEAR_EXPIRY_MS = 10 * 60 * 1e3;
const log = createSubsystemLogger('agents/auth-profiles');
export {
  AUTH_PROFILE_FILENAME,
  AUTH_STORE_LOCK_OPTIONS,
  AUTH_STORE_VERSION,
  CLAUDE_CLI_PROFILE_ID,
  CODEX_CLI_PROFILE_ID,
  EXTERNAL_CLI_NEAR_EXPIRY_MS,
  EXTERNAL_CLI_SYNC_TTL_MS,
  LEGACY_AUTH_FILENAME,
  MINIMAX_CLI_PROFILE_ID,
  QWEN_CLI_PROFILE_ID,
  log
};
