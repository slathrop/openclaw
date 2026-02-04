/**
 * TLS certificate fingerprint normalization.
 *
 * SECURITY: Certificate fingerprints are used for pinning/verification of TLS
 * certificates. This normalizer ensures consistent comparison by stripping
 * algorithm prefixes (sha256:) and separator characters (colons, dashes),
 * producing a lowercase hex string. Consistent normalization is critical to
 * prevent fingerprint comparison bypass through formatting differences.
 * @module
 */

/**
 * SECURITY: Normalizes a certificate fingerprint to a consistent lowercase hex
 * string for reliable comparison. Strips sha256 prefixes and all separators.
 * @param {string} input - Raw fingerprint (e.g., "sha256:AA:BB:CC" or "11-22-33")
 * @returns {string} Lowercase hex string with no separators
 */
export function normalizeFingerprint(input) {
  const trimmed = input.trim();
  const withoutPrefix = trimmed.replace(/^sha-?256\s*:?\s*/i, '');
  return withoutPrefix.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
}
