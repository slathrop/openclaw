/**
 * @module gateway/protocol/client-info
 * Gateway client identification: known client IDs, connection modes, capabilities,
 * and normalization helpers for matching raw strings to known values.
 */

export const GATEWAY_CLIENT_IDS = {
  WEBCHAT_UI: 'webchat-ui',
  CONTROL_UI: 'openclaw-control-ui',
  WEBCHAT: 'webchat',
  CLI: 'cli',
  GATEWAY_CLIENT: 'gateway-client',
  MACOS_APP: 'openclaw-macos',
  IOS_APP: 'openclaw-ios',
  ANDROID_APP: 'openclaw-android',
  NODE_HOST: 'node-host',
  TEST: 'test',
  FINGERPRINT: 'fingerprint',
  PROBE: 'openclaw-probe'
};

/**
 * @typedef {typeof GATEWAY_CLIENT_IDS[keyof typeof GATEWAY_CLIENT_IDS]} GatewayClientId
 */

// Back-compat naming (internal): these values are IDs, not display names.
export const GATEWAY_CLIENT_NAMES = GATEWAY_CLIENT_IDS;
/**
 * @typedef {GatewayClientId} GatewayClientName
 */

export const GATEWAY_CLIENT_MODES = {
  WEBCHAT: 'webchat',
  CLI: 'cli',
  UI: 'ui',
  BACKEND: 'backend',
  NODE: 'node',
  PROBE: 'probe',
  TEST: 'test'
};

/**
 * @typedef {typeof GATEWAY_CLIENT_MODES[keyof typeof GATEWAY_CLIENT_MODES]} GatewayClientMode
 */

/**
 * @typedef {object} GatewayClientInfo
 * @property {GatewayClientId} id
 * @property {string} [displayName]
 * @property {string} version
 * @property {string} platform
 * @property {string} [deviceFamily]
 * @property {string} [modelIdentifier]
 * @property {GatewayClientMode} mode
 * @property {string} [instanceId]
 */

export const GATEWAY_CLIENT_CAPS = {
  TOOL_EVENTS: 'tool-events'
};

/**
 * @typedef {typeof GATEWAY_CLIENT_CAPS[keyof typeof GATEWAY_CLIENT_CAPS]} GatewayClientCap
 */

const GATEWAY_CLIENT_ID_SET = new Set(Object.values(GATEWAY_CLIENT_IDS));
const GATEWAY_CLIENT_MODE_SET = new Set(Object.values(GATEWAY_CLIENT_MODES));

/**
 * Normalize a raw string to a known gateway client ID if it matches.
 * @param {string | null | undefined} raw
 * @returns {string | undefined}
 */
export function normalizeGatewayClientId(raw) {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return GATEWAY_CLIENT_ID_SET.has(normalized) ? normalized : undefined;
}

/**
 * @param {string | null | undefined} raw
 * @returns {string | undefined}
 */
export function normalizeGatewayClientName(raw) {
  return normalizeGatewayClientId(raw);
}

/**
 * Normalize a raw string to a known gateway client mode if it matches.
 * @param {string | null | undefined} raw
 * @returns {string | undefined}
 */
export function normalizeGatewayClientMode(raw) {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return GATEWAY_CLIENT_MODE_SET.has(normalized) ? normalized : undefined;
}

/**
 * Check whether a capabilities array contains a specific capability.
 * @param {string[] | null | undefined} caps
 * @param {string} cap
 * @returns {boolean}
 */
export function hasGatewayClientCap(caps, cap) {
  if (!Array.isArray(caps)) {
    return false;
  }
  return caps.includes(cap);
}
