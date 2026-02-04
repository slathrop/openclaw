/**
 * SSRF (Server-Side Request Forgery) protection module.
 *
 * SECURITY: This module is a critical defense against SSRF attacks. It validates
 * IP addresses and hostnames to prevent the application from making requests to
 * internal/private network resources. The DNS pinning mechanism prevents TOCTOU
 * (Time-of-Check-Time-of-Use) attacks where a hostname resolves to a safe address
 * during validation but a different (private) address during the actual request.
 *
 * Key protections:
 * - Blocks requests to private IPv4 ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x)
 * - Blocks requests to private IPv6 addresses (::1, fe80:, fc/fd, fec0:)
 * - Blocks IPv4-mapped IPv6 addresses (::ffff:10.0.0.1) to prevent bypass
 * - Blocks known dangerous hostnames (localhost, metadata.google.internal)
 * - DNS pinning: resolves hostname once, pins result to prevent re-resolution attacks
 * @module
 */

import {lookup as dnsLookupCb} from 'node:dns';
import {lookup as dnsLookup} from 'node:dns/promises';
import {Agent} from 'undici';

/**
 * @typedef {typeof dnsLookup} LookupFn
 */

/**
 * @typedef {object} SsrFPolicy
 * @property {boolean} [allowPrivateNetwork]
 * @property {string[]} [allowedHostnames]
 */

export class SsrFBlockedError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'SsrFBlockedError';
  }
}

/**
 * SECURITY: Private IPv6 prefixes used to detect non-routable addresses.
 * fe80: = link-local, fec0: = site-local (deprecated), fc/fd = unique local.
 */
const PRIVATE_IPV6_PREFIXES = ['fe80:', 'fec0:', 'fc', 'fd'];

/**
 * SECURITY: Hostnames that must always be blocked to prevent cloud metadata
 * endpoint access and localhost bypass attacks.
 */
const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

/**
 * Normalizes a hostname by lowercasing, trimming, removing trailing dots,
 * and stripping bracket notation from IPv6 literals.
 * @param {string} hostname
 * @returns {string}
 */
function normalizeHostname(hostname) {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

/**
 * @param {string[]} [values]
 * @returns {Set<string>}
 */
function normalizeHostnameSet(values) {
  if (!values || values.length === 0) {
    return new Set();
  }
  return new Set(values.map((value) => normalizeHostname(value)).filter(Boolean));
}

/**
 * Parses a dotted-quad IPv4 address into its four octets.
 * @param {string} address
 * @returns {number[] | null} Array of 4 octets, or null if invalid
 */
function parseIpv4(address) {
  const parts = address.split('.');
  if (parts.length !== 4) {
    return null;
  }
  const numbers = parts.map((part) => Number.parseInt(part, 10));
  if (numbers.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return null;
  }
  return numbers;
}

/**
 * SECURITY: Extracts IPv4 octets from an IPv4-mapped IPv6 address suffix.
 * This prevents bypasses like ::ffff:10.0.0.1 or ::ffff:0a00:0001.
 * @param {string} mapped - The suffix after "::ffff:"
 * @returns {number[] | null}
 */
function parseIpv4FromMappedIpv6(mapped) {
  if (mapped.includes('.')) {
    return parseIpv4(mapped);
  }
  const parts = mapped.split(':').filter(Boolean);
  if (parts.length === 1) {
    const value = Number.parseInt(parts[0], 16);
    if (Number.isNaN(value) || value < 0 || value > 0xffff_ffff) {
      return null;
    }
    return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
  }
  if (parts.length !== 2) {
    return null;
  }
  const high = Number.parseInt(parts[0], 16);
  const low = Number.parseInt(parts[1], 16);
  if (
    Number.isNaN(high) ||
    Number.isNaN(low) ||
    high < 0 ||
    low < 0 ||
    high > 0xffff ||
    low > 0xffff
  ) {
    return null;
  }
  const value = (high << 16) + low;
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

/**
 * SECURITY: Checks if an IPv4 address (as 4 octets) falls within private/reserved ranges.
 * Covers RFC 1918 (10.x, 172.16-31.x, 192.168.x), loopback (127.x),
 * link-local (169.254.x), current network (0.x), and CGNAT (100.64-127.x).
 * @param {number[]} parts - Four octets
 * @returns {boolean}
 */
function isPrivateIpv4(parts) {
  const [octet1, octet2] = parts;
  if (octet1 === 0) {
    return true;
  }
  if (octet1 === 10) {
    return true;
  }
  if (octet1 === 127) {
    return true;
  }
  if (octet1 === 169 && octet2 === 254) {
    return true;
  }
  if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
    return true;
  }
  if (octet1 === 192 && octet2 === 168) {
    return true;
  }
  if (octet1 === 100 && octet2 >= 64 && octet2 <= 127) {
    return true;
  }
  return false;
}

/**
 * SECURITY: Determines if an IP address string is a private/internal address.
 * Handles IPv4, IPv6, IPv4-mapped IPv6, and bracket-wrapped notation.
 * @param {string} address
 * @returns {boolean}
 */
export function isPrivateIpAddress(address) {
  let normalized = address.trim().toLowerCase();
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    normalized = normalized.slice(1, -1);
  }
  if (!normalized) {
    return false;
  }

  // SECURITY: Check IPv4-mapped IPv6 (::ffff:x.x.x.x) to prevent bypass
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    const ipv4 = parseIpv4FromMappedIpv6(mapped);
    if (ipv4) {
      return isPrivateIpv4(ipv4);
    }
  }

  if (normalized.includes(':')) {
    if (normalized === '::' || normalized === '::1') {
      return true;
    }
    return PRIVATE_IPV6_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  }

  const ipv4 = parseIpv4(normalized);
  if (!ipv4) {
    return false;
  }
  return isPrivateIpv4(ipv4);
}

/**
 * SECURITY: Checks if a hostname should be blocked (localhost, .local, .internal).
 * Prevents access to cloud provider metadata endpoints and local services.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isBlockedHostname(hostname) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    return false;
  }
  if (BLOCKED_HOSTNAMES.has(normalized)) {
    return true;
  }
  return (
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  );
}

/**
 * SECURITY: Creates a DNS lookup function that returns pinned (pre-resolved) addresses
 * for the target hostname, preventing TOCTOU DNS rebinding attacks. Requests for
 * other hostnames fall through to the system DNS resolver.
 * @param {object} params
 * @param {string} params.hostname
 * @param {string[]} params.addresses
 * @param {Function} [params.fallback]
 * @returns {Function} A callback-style DNS lookup compatible with Node.js net module
 */
export function createPinnedLookup(params) {
  const normalizedHost = normalizeHostname(params.hostname);
  const fallback = params.fallback ?? dnsLookupCb;
  const fallbackLookup = fallback;
  const fallbackWithOptions = fallback;
  const records = params.addresses.map((address) => ({
    address,
    family: address.includes(':') ? 6 : 4
  }));
  let index = 0;

  return (host, options, callback) => {
    const cb =
      typeof options === 'function' ? options : callback;
    if (!cb) {
      return;
    }
    const normalized = normalizeHostname(host);
    if (!normalized || normalized !== normalizedHost) {
      if (typeof options === 'function' || options === undefined) {
        return fallbackLookup(host, cb);
      }
      return fallbackWithOptions(host, options, cb);
    }

    const opts =
      typeof options === 'object' && options !== null
        ? options
        : {};
    const requestedFamily =
      typeof options === 'number' ? options : typeof opts.family === 'number' ? opts.family : 0;
    const candidates =
      requestedFamily === 4 || requestedFamily === 6
        ? records.filter((entry) => entry.family === requestedFamily)
        : records;
    const usable = candidates.length > 0 ? candidates : records;
    if (opts.all) {
      cb(null, usable);
      return;
    }
    const chosen = usable[index % usable.length];
    index += 1;
    cb(null, chosen.address, chosen.family);
  };
}

/**
 * @typedef {object} PinnedHostname
 * @property {string} hostname
 * @property {string[]} addresses
 * @property {Function} lookup
 */

/**
 * SECURITY: Resolves a hostname via DNS, validates all resulting IP addresses against
 * SSRF policy, then returns pinned results. The two-phase check (pre-resolve hostname
 * check + post-resolve IP check) prevents both direct IP attacks and DNS rebinding.
 * @param {string} hostname
 * @param {object} [params]
 * @param {Function} [params.lookupFn]
 * @param {SsrFPolicy} [params.policy]
 * @returns {Promise<PinnedHostname>}
 */
export async function resolvePinnedHostnameWithPolicy(
  hostname,
  params = {}
) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    throw new Error('Invalid hostname');
  }

  const allowPrivateNetwork = Boolean(params.policy?.allowPrivateNetwork);
  const allowedHostnames = normalizeHostnameSet(params.policy?.allowedHostnames);
  const isExplicitAllowed = allowedHostnames.has(normalized);

  // SECURITY: Pre-resolve check blocks known-bad hostnames before DNS lookup
  if (!allowPrivateNetwork && !isExplicitAllowed) {
    if (isBlockedHostname(normalized)) {
      throw new SsrFBlockedError(`Blocked hostname: ${hostname}`);
    }

    if (isPrivateIpAddress(normalized)) {
      throw new SsrFBlockedError('Blocked: private/internal IP address');
    }
  }

  const lookupFn = params.lookupFn ?? dnsLookup;
  const results = await lookupFn(normalized, {all: true});
  if (results.length === 0) {
    throw new Error(`Unable to resolve hostname: ${hostname}`);
  }

  // SECURITY: Post-resolve check validates actual IP addresses to catch DNS rebinding
  if (!allowPrivateNetwork && !isExplicitAllowed) {
    for (const entry of results) {
      if (isPrivateIpAddress(entry.address)) {
        throw new SsrFBlockedError('Blocked: resolves to private/internal IP address');
      }
    }
  }

  const addresses = Array.from(new Set(results.map((entry) => entry.address)));
  if (addresses.length === 0) {
    throw new Error(`Unable to resolve hostname: ${hostname}`);
  }

  return {
    hostname: normalized,
    addresses,
    lookup: createPinnedLookup({hostname: normalized, addresses})
  };
}

/**
 * SECURITY: Convenience wrapper that resolves and pins a hostname with default
 * (restrictive) SSRF policy - no private network access allowed.
 * @param {string} hostname
 * @param {Function} [lookupFn]
 * @returns {Promise<PinnedHostname>}
 */
export async function resolvePinnedHostname(
  hostname,
  lookupFn = dnsLookup
) {
  return await resolvePinnedHostnameWithPolicy(hostname, {lookupFn});
}

/**
 * Creates an undici Agent dispatcher that uses pinned DNS results,
 * ensuring the connection goes to the validated IP address.
 * @param {PinnedHostname} pinned
 * @returns {import('undici').Dispatcher}
 */
export function createPinnedDispatcher(pinned) {
  return new Agent({
    connect: {
      lookup: pinned.lookup
    }
  });
}

/**
 * Safely closes/destroys an undici dispatcher, ignoring cleanup errors.
 * @param {import('undici').Dispatcher | null | undefined} dispatcher
 * @returns {Promise<void>}
 */
export async function closeDispatcher(dispatcher) {
  if (!dispatcher) {
    return;
  }
  try {
    if (typeof dispatcher.close === 'function') {
      await dispatcher.close();
      return;
    }
    if (typeof dispatcher.destroy === 'function') {
      dispatcher.destroy();
    }
  } catch {
    // ignore dispatcher cleanup errors
  }
}

/**
 * SECURITY: Asserts that a hostname resolves to public (non-private) IP addresses.
 * Throws SsrFBlockedError if the hostname or its resolved IPs are private/internal.
 * @param {string} hostname
 * @param {Function} [lookupFn]
 * @returns {Promise<void>}
 */
export async function assertPublicHostname(
  hostname,
  lookupFn = dnsLookup
) {
  await resolvePinnedHostname(hostname, lookupFn);
}
