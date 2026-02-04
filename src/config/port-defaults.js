/**
 * @module port-defaults
 * Default port assignments and derived port calculations.
 */

/**
 * @typedef {{ start: number, end: number }} PortRange
 */

/**
 * @param {number} port
 * @returns {boolean}
 */
function isValidPort(port) {
  return Number.isFinite(port) && port > 0 && port <= 65535;
}

/**
 * @param {number} port
 * @param {number} fallback
 * @returns {number}
 */
function clampPort(port, fallback) {
  return isValidPort(port) ? port : fallback;
}

/**
 * @param {number} base
 * @param {number} offset
 * @param {number} fallback
 * @returns {number}
 */
function derivePort(base, offset, fallback) {
  return clampPort(base + offset, fallback);
}

export const DEFAULT_BRIDGE_PORT = 18790;
export const DEFAULT_BROWSER_CONTROL_PORT = 18791;
export const DEFAULT_CANVAS_HOST_PORT = 18793;
export const DEFAULT_BROWSER_CDP_PORT_RANGE_START = 18800;
export const DEFAULT_BROWSER_CDP_PORT_RANGE_END = 18899;

/**
 * @param {number} gatewayPort
 * @returns {number}
 */
export function deriveDefaultBridgePort(gatewayPort) {
  return derivePort(gatewayPort, 1, DEFAULT_BRIDGE_PORT);
}

/**
 * @param {number} gatewayPort
 * @returns {number}
 */
export function deriveDefaultBrowserControlPort(gatewayPort) {
  return derivePort(gatewayPort, 2, DEFAULT_BROWSER_CONTROL_PORT);
}

/**
 * @param {number} gatewayPort
 * @returns {number}
 */
export function deriveDefaultCanvasHostPort(gatewayPort) {
  return derivePort(gatewayPort, 4, DEFAULT_CANVAS_HOST_PORT);
}

/**
 * @param {number} browserControlPort
 * @returns {PortRange}
 */
export function deriveDefaultBrowserCdpPortRange(browserControlPort) {
  const start = derivePort(browserControlPort, 9, DEFAULT_BROWSER_CDP_PORT_RANGE_START);
  const end = clampPort(
    start + (DEFAULT_BROWSER_CDP_PORT_RANGE_END - DEFAULT_BROWSER_CDP_PORT_RANGE_START),
    DEFAULT_BROWSER_CDP_PORT_RANGE_END
  );
  if (end < start) {
    return {start, end: start};
  }
  return {start, end};
}
