/**
 * ANSI escape sequence handling.
 *
 * Strips ANSI SGR color codes and OSC-8 hyperlink sequences from strings.
 * Provides visible-width calculation for ANSI-decorated text.
 */
const ANSI_SGR_PATTERN = '\\x1b\\[[0-9;]*m';
// OSC-8 hyperlinks: ESC ] 8 ; ; url ST ... ESC ] 8 ; ; ST
const OSC8_PATTERN = '\\x1b\\]8;;.*?\\x1b\\\\|\\x1b\\]8;;\\x1b\\\\';

const ANSI_REGEX = new RegExp(ANSI_SGR_PATTERN, 'g');
const OSC8_REGEX = new RegExp(OSC8_PATTERN, 'g');

/**
 * @param {string} input
 * @returns {string}
 */
export const stripAnsi = (input) => {
  return input.replace(OSC8_REGEX, '').replace(ANSI_REGEX, '');
};

/**
 * @param {string} input
 * @returns {number}
 */
export const visibleWidth = (input) => {
  return Array.from(stripAnsi(input)).length;
};
