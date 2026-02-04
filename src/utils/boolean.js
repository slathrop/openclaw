/**
 * Boolean value parsing with customizable truthy/falsy string lists.
 *
 * Used by environment variable and configuration parsers to interpret
 * string values as booleans (e.g. "true", "1", "yes", "on").
 */

/**
 * @typedef {object} BooleanParseOptions
 * @property {string[]} [truthy] - Strings considered truthy.
 * @property {string[]} [falsy] - Strings considered falsy.
 */

const DEFAULT_TRUTHY = ['true', '1', 'yes', 'on'];
const DEFAULT_FALSY = ['false', '0', 'no', 'off'];
const DEFAULT_TRUTHY_SET = new Set(DEFAULT_TRUTHY);
const DEFAULT_FALSY_SET = new Set(DEFAULT_FALSY);

/**
 * Parses a value as a boolean using configurable truthy/falsy string sets.
 * @param {*} value
 * @param {BooleanParseOptions} [options]
 * @returns {boolean | undefined}
 */
export function parseBooleanValue(value, options = {}) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  const truthy = options.truthy ?? DEFAULT_TRUTHY;
  const falsy = options.falsy ?? DEFAULT_FALSY;
  const truthySet = truthy === DEFAULT_TRUTHY ? DEFAULT_TRUTHY_SET : new Set(truthy);
  const falsySet = falsy === DEFAULT_FALSY ? DEFAULT_FALSY_SET : new Set(falsy);
  if (truthySet.has(normalized)) {
    return true;
  }
  if (falsySet.has(normalized)) {
    return false;
  }
  return undefined;
}
