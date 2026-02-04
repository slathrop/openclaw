/**
 * Account ID normalization.
 *
 * Trims and validates account identifier strings, returning undefined
 * for empty or non-string values.
 */

/**
 * Normalizes an account ID string by trimming whitespace.
 * @param {string} [value]
 * @returns {string | undefined}
 */
export function normalizeAccountId(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}
