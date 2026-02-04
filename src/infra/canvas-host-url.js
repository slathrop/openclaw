/**
 * Canvas host URL resolution for the control UI.
 *
 * Determines the public-facing URL for the canvas port by
 * examining host overrides, request headers, forwarded proto,
 * and local addresses. Rejects loopback addresses when more
 * specific hosts are available.
 */

/**
 * @param {string} value
 * @returns {boolean}
 */
const isLoopbackHost = (value) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized === 'localhost') {
    return true;
  }
  if (normalized === '::1') {
    return true;
  }
  if (normalized === '0.0.0.0' || normalized === '::') {
    return true;
  }
  return normalized.startsWith('127.');
};

/**
 * @param {string | null | undefined} value
 * @param {boolean} rejectLoopback
 * @returns {string}
 */
const normalizeHost = (value, rejectLoopback) => {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (rejectLoopback && isLoopbackHost(trimmed)) {
    return '';
  }
  return trimmed;
};

/**
 * @param {string | null | undefined} value
 * @returns {string}
 */
const parseHostHeader = (value) => {
  if (!value) {
    return '';
  }
  try {
    return new URL(`http://${String(value).trim()}`).hostname;
  } catch {
    return '';
  }
};

/**
 * @param {string | null | undefined | Array<string | null | undefined>} value
 * @returns {string | null | undefined}
 */
const parseForwardedProto = (value) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

/**
 * Resolves the canvas host URL from available host information.
 * @param {{
 *   canvasPort?: number,
 *   hostOverride?: string | null | undefined,
 *   requestHost?: string | null | undefined,
 *   forwardedProto?: string | null | undefined | Array<string | null | undefined>,
 *   localAddress?: string | null | undefined,
 *   scheme?: "http" | "https"
 * }} params
 * @returns {string | undefined}
 */
export function resolveCanvasHostUrl(params) {
  const port = params.canvasPort;
  if (!port) {
    return undefined;
  }

  const scheme =
    params.scheme ??
    (parseForwardedProto(params.forwardedProto)?.trim() === 'https' ? 'https' : 'http');

  const override = normalizeHost(params.hostOverride, true);
  const requestHost = normalizeHost(parseHostHeader(params.requestHost), !!override);
  const localAddress = normalizeHost(params.localAddress, Boolean(override || requestHost));

  const host = override || requestHost || localAddress;
  if (!host) {
    return undefined;
  }
  const formatted = host.includes(':') ? `[${host}]` : host;
  return `${scheme}://${formatted}:${port}`;
}
