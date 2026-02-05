/** @module gateway/net -- Network utilities: loopback detection, proxy trust, client IP resolution. */
import net from 'node:net';
import { pickPrimaryTailnetIPv4, pickPrimaryTailnetIPv6 } from '../infra/tailnet.js';
function isLoopbackAddress(ip) {
  if (!ip) {
    return false;
  }
  if (ip === '127.0.0.1') {
    return true;
  }
  if (ip.startsWith('127.')) {
    return true;
  }
  if (ip === '::1') {
    return true;
  }
  if (ip.startsWith('::ffff:127.')) {
    return true;
  }
  return false;
}
function normalizeIPv4MappedAddress(ip) {
  if (ip.startsWith('::ffff:')) {
    return ip.slice('::ffff:'.length);
  }
  return ip;
}
function normalizeIp(ip) {
  const trimmed = ip?.trim();
  if (!trimmed) {
    return void 0;
  }
  return normalizeIPv4MappedAddress(trimmed.toLowerCase());
}
function stripOptionalPort(ip) {
  if (ip.startsWith('[')) {
    const end = ip.indexOf(']');
    if (end !== -1) {
      return ip.slice(1, end);
    }
  }
  if (net.isIP(ip)) {
    return ip;
  }
  const lastColon = ip.lastIndexOf(':');
  if (lastColon > -1 && ip.includes('.') && ip.indexOf(':') === lastColon) {
    const candidate = ip.slice(0, lastColon);
    if (net.isIP(candidate) === 4) {
      return candidate;
    }
  }
  return ip;
}
function parseForwardedForClientIp(forwardedFor) {
  const raw = forwardedFor?.split(',')[0]?.trim();
  if (!raw) {
    return void 0;
  }
  return normalizeIp(stripOptionalPort(raw));
}
function parseRealIp(realIp) {
  const raw = realIp?.trim();
  if (!raw) {
    return void 0;
  }
  return normalizeIp(stripOptionalPort(raw));
}
function isTrustedProxyAddress(ip, trustedProxies) {
  const normalized = normalizeIp(ip);
  if (!normalized || !trustedProxies || trustedProxies.length === 0) {
    return false;
  }
  return trustedProxies.some((proxy) => normalizeIp(proxy) === normalized);
}
function resolveGatewayClientIp(params) {
  const remote = normalizeIp(params.remoteAddr);
  if (!remote) {
    return void 0;
  }
  if (!isTrustedProxyAddress(remote, params.trustedProxies)) {
    return remote;
  }
  return parseForwardedForClientIp(params.forwardedFor) ?? parseRealIp(params.realIp) ?? remote;
}
function isLocalGatewayAddress(ip) {
  if (isLoopbackAddress(ip)) {
    return true;
  }
  if (!ip) {
    return false;
  }
  const normalized = normalizeIPv4MappedAddress(ip.trim().toLowerCase());
  const tailnetIPv4 = pickPrimaryTailnetIPv4();
  if (tailnetIPv4 && normalized === tailnetIPv4.toLowerCase()) {
    return true;
  }
  const tailnetIPv6 = pickPrimaryTailnetIPv6();
  if (tailnetIPv6 && ip.trim().toLowerCase() === tailnetIPv6.toLowerCase()) {
    return true;
  }
  return false;
}
async function resolveGatewayBindHost(bind, customHost) {
  const mode = bind ?? 'loopback';
  if (mode === 'loopback') {
    if (await canBindToHost('127.0.0.1')) {
      return '127.0.0.1';
    }
    return '0.0.0.0';
  }
  if (mode === 'tailnet') {
    const tailnetIP = pickPrimaryTailnetIPv4();
    if (tailnetIP && await canBindToHost(tailnetIP)) {
      return tailnetIP;
    }
    if (await canBindToHost('127.0.0.1')) {
      return '127.0.0.1';
    }
    return '0.0.0.0';
  }
  if (mode === 'lan') {
    return '0.0.0.0';
  }
  if (mode === 'custom') {
    const host = customHost?.trim();
    if (!host) {
      return '0.0.0.0';
    }
    if (isValidIPv4(host) && await canBindToHost(host)) {
      return host;
    }
    return '0.0.0.0';
  }
  if (mode === 'auto') {
    if (await canBindToHost('127.0.0.1')) {
      return '127.0.0.1';
    }
    return '0.0.0.0';
  }
  return '0.0.0.0';
}
async function canBindToHost(host) {
  return new Promise((resolve) => {
    const testServer = net.createServer();
    testServer.once('error', () => {
      resolve(false);
    });
    testServer.once('listening', () => {
      testServer.close();
      resolve(true);
    });
    testServer.listen(0, host);
  });
}
async function resolveGatewayListenHosts(bindHost, opts) {
  if (bindHost !== '127.0.0.1') {
    return [bindHost];
  }
  const canBind = opts?.canBindToHost ?? canBindToHost;
  if (await canBind('::1')) {
    return [bindHost, '::1'];
  }
  return [bindHost];
}
function isValidIPv4(host) {
  const parts = host.split('.');
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    const n = parseInt(part, 10);
    return !Number.isNaN(n) && n >= 0 && n <= 255 && part === String(n);
  });
}
function isLoopbackHost(host) {
  return isLoopbackAddress(host);
}
export {
  canBindToHost,
  isLocalGatewayAddress,
  isLoopbackAddress,
  isLoopbackHost,
  isTrustedProxyAddress,
  parseForwardedForClientIp,
  resolveGatewayBindHost,
  resolveGatewayClientIp,
  resolveGatewayListenHosts
};
