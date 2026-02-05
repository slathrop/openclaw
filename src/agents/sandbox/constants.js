/**
 * Constants for sandbox image names, ports, and defaults.
 * @module agents/sandbox/constants
 */
import os from 'node:os';
import path from 'node:path';
import { CHANNEL_IDS } from '../../channels/registry.js';
import { STATE_DIR } from '../../config/config.js';
const DEFAULT_SANDBOX_WORKSPACE_ROOT = path.join(os.homedir(), '.openclaw', 'sandboxes');
const DEFAULT_SANDBOX_IMAGE = 'openclaw-sandbox:bookworm-slim';
const DEFAULT_SANDBOX_CONTAINER_PREFIX = 'openclaw-sbx-';
const DEFAULT_SANDBOX_WORKDIR = '/workspace';
const DEFAULT_SANDBOX_IDLE_HOURS = 24;
const DEFAULT_SANDBOX_MAX_AGE_DAYS = 7;
const DEFAULT_TOOL_ALLOW = [
  'exec',
  'process',
  'read',
  'write',
  'edit',
  'apply_patch',
  'image',
  'sessions_list',
  'sessions_history',
  'sessions_send',
  'sessions_spawn',
  'session_status'
];
const DEFAULT_TOOL_DENY = [
  'browser',
  'canvas',
  'nodes',
  'cron',
  'gateway',
  ...CHANNEL_IDS
];
const DEFAULT_SANDBOX_BROWSER_IMAGE = 'openclaw-sandbox-browser:bookworm-slim';
const DEFAULT_SANDBOX_COMMON_IMAGE = 'openclaw-sandbox-common:bookworm-slim';
const DEFAULT_SANDBOX_BROWSER_PREFIX = 'openclaw-sbx-browser-';
const DEFAULT_SANDBOX_BROWSER_CDP_PORT = 9222;
const DEFAULT_SANDBOX_BROWSER_VNC_PORT = 5900;
const DEFAULT_SANDBOX_BROWSER_NOVNC_PORT = 6080;
const DEFAULT_SANDBOX_BROWSER_AUTOSTART_TIMEOUT_MS = 12e3;
const SANDBOX_AGENT_WORKSPACE_MOUNT = '/agent';
const resolvedSandboxStateDir = STATE_DIR ?? path.join(os.homedir(), '.openclaw');
const SANDBOX_STATE_DIR = path.join(resolvedSandboxStateDir, 'sandbox');
const SANDBOX_REGISTRY_PATH = path.join(SANDBOX_STATE_DIR, 'containers.json');
const SANDBOX_BROWSER_REGISTRY_PATH = path.join(SANDBOX_STATE_DIR, 'browsers.json');
export {
  DEFAULT_SANDBOX_BROWSER_AUTOSTART_TIMEOUT_MS,
  DEFAULT_SANDBOX_BROWSER_CDP_PORT,
  DEFAULT_SANDBOX_BROWSER_IMAGE,
  DEFAULT_SANDBOX_BROWSER_NOVNC_PORT,
  DEFAULT_SANDBOX_BROWSER_PREFIX,
  DEFAULT_SANDBOX_BROWSER_VNC_PORT,
  DEFAULT_SANDBOX_COMMON_IMAGE,
  DEFAULT_SANDBOX_CONTAINER_PREFIX,
  DEFAULT_SANDBOX_IDLE_HOURS,
  DEFAULT_SANDBOX_IMAGE,
  DEFAULT_SANDBOX_MAX_AGE_DAYS,
  DEFAULT_SANDBOX_WORKDIR,
  DEFAULT_SANDBOX_WORKSPACE_ROOT,
  DEFAULT_TOOL_ALLOW,
  DEFAULT_TOOL_DENY,
  SANDBOX_AGENT_WORKSPACE_MOUNT,
  SANDBOX_BROWSER_REGISTRY_PATH,
  SANDBOX_REGISTRY_PATH,
  SANDBOX_STATE_DIR
};
