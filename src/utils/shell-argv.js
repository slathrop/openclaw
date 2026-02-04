/**
 * Shell argument splitting utility.
 *
 * Splits a raw command string into an array of arguments, respecting
 * single and double quotes and backslash escapes. Returns null if
 * the input has unclosed quotes or a trailing escape.
 */

/**
 * Splits a raw shell command string into individual arguments.
 * @param {string} raw
 * @returns {string[] | null} Array of tokens, or null if quoting is invalid.
 */
export function splitShellArgs(raw) {
  const tokens = [];
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  const pushToken = () => {
    if (buf.length > 0) {
      tokens.push(buf);
      buf = '';
    }
  };

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (escaped) {
      buf += ch;
      escaped = false;
      continue;
    }
    if (!inSingle && !inDouble && ch === '\\') {
      escaped = true;
      continue;
    }
    if (inSingle) {
      if (ch === '\'') {
        inSingle = false;
      } else {
        buf += ch;
      }
      continue;
    }
    if (inDouble) {
      if (ch === '"') {
        inDouble = false;
      } else {
        buf += ch;
      }
      continue;
    }
    if (ch === '\'') {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (/\s/.test(ch)) {
      pushToken();
      continue;
    }
    buf += ch;
  }

  if (escaped || inSingle || inDouble) {
    return null;
  }
  pushToken();
  return tokens;
}
