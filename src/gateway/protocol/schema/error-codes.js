/**
 * @module gateway/protocol/schema/error-codes
 * Standard gateway error codes and a helper to construct ErrorShape objects.
 */

export const ErrorCodes = {
  NOT_LINKED: 'NOT_LINKED',
  NOT_PAIRED: 'NOT_PAIRED',
  AGENT_TIMEOUT: 'AGENT_TIMEOUT',
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAVAILABLE: 'UNAVAILABLE'
};

/**
 * Build a protocol-compliant error shape.
 * @param {string} code - One of the ErrorCodes values.
 * @param {string} message - Human-readable error description.
 * @param {{ details?: unknown, retryable?: boolean, retryAfterMs?: number }} [opts]
 * @returns {{ code: string, message: string, details?: unknown, retryable?: boolean, retryAfterMs?: number }}
 */
export function errorShape(code, message, opts) {
  return {
    code,
    message,
    ...opts
  };
}
