/**
 * Session label parsing and validation.
 *
 * Validates user-provided session labels against length constraints
 * and returns a structured result with the trimmed label or an error.
 * @typedef {{ ok: true, label: string } | { ok: false, error: string }} ParsedSessionLabel
 */

export const SESSION_LABEL_MAX_LENGTH = 64;

/**
 * @param {unknown} raw
 * @returns {ParsedSessionLabel}
 */
export const parseSessionLabel = (raw) => {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'invalid label: must be a string' };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'invalid label: empty' };
  }
  if (trimmed.length > SESSION_LABEL_MAX_LENGTH) {
    return {
      ok: false,
      error: `invalid label: too long (max ${SESSION_LABEL_MAX_LENGTH})`
    };
  }
  return { ok: true, label: trimmed };
};
