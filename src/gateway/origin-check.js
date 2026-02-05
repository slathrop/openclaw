/**
 * @param hostHeader
 * @module gateway/origin-check
 * SECURITY: WebSocket origin validation for CSRF protection.
 * Validates Origin headers against allowed hosts to prevent
 * cross-site WebSocket hijacking. Supports loopback, Tailscale,
 * and configurable domain allowlists.
 */
function normalizeHostHeader(hostHeader) {
  return (hostHeader ?? '').trim().toLowerCase();
}
function resolveHostName(hostHeader) {
  const host = normalizeHostHeader(hostHeader);
  if (!host) {
    return '';
  }
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    if (end !== -1) {
      return host.slice(1, end);
    }
  }
  const [name] = host.split(':');
  return name ?? '';
}
function parseOrigin(originRaw) {
  const trimmed = (originRaw ?? '').trim();
  if (!trimmed || trimmed === 'null') {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return {
      origin: url.origin.toLowerCase(),
      host: url.host.toLowerCase(),
      hostname: url.hostname.toLowerCase()
    };
  } catch {
    return null;
  }
}
function isLoopbackHost(hostname) {
  if (!hostname) {
    return false;
  }
  if (hostname === 'localhost') {
    return true;
  }
  if (hostname === '::1') {
    return true;
  }
  if (hostname === '127.0.0.1' || hostname.startsWith('127.')) {
    return true;
  }
  return false;
}
function checkBrowserOrigin(params) {
  const parsedOrigin = parseOrigin(params.origin);
  if (!parsedOrigin) {
    return { ok: false, reason: 'origin missing or invalid' };
  }
  const allowlist = (params.allowedOrigins ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (allowlist.includes(parsedOrigin.origin)) {
    return { ok: true };
  }
  const requestHost = normalizeHostHeader(params.requestHost);
  if (requestHost && parsedOrigin.host === requestHost) {
    return { ok: true };
  }
  const requestHostname = resolveHostName(requestHost);
  if (isLoopbackHost(parsedOrigin.hostname) && isLoopbackHost(requestHostname)) {
    return { ok: true };
  }
  return { ok: false, reason: 'origin not allowed' };
}
export {
  checkBrowserOrigin
};
