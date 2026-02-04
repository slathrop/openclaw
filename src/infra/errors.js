/**
 * Error extraction and formatting utilities.
 *
 * Provides safe extraction of error codes from unknown values
 * and consistent formatting for error messages and stack traces.
 */

/**
 * Extracts an error code from an unknown error value.
 * @param {unknown} err
 * @returns {string | undefined}
 */
export function extractErrorCode(err) {
  if (!err || typeof err !== 'object') {
    return undefined;
  }
  const code = err?.code;
  if (typeof code === 'string') {
    return code;
  }
  if (typeof code === 'number') {
    return String(code);
  }
  return undefined;
}

/**
 * Formats an unknown error value into a human-readable message.
 * @param {unknown} err
 * @returns {string}
 */
export function formatErrorMessage(err) {
  if (err instanceof Error) {
    return err.message || err.name || 'Error';
  }
  if (typeof err === 'string') {
    return err;
  }
  if (typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint') {
    return String(err);
  }
  try {
    return JSON.stringify(err);
  } catch {
    return Object.prototype.toString.call(err);
  }
}

/**
 * Formats an uncaught error, preferring stack traces when available.
 * @param {unknown} err
 * @returns {string}
 */
export function formatUncaughtError(err) {
  if (extractErrorCode(err) === 'INVALID_CONFIG') {
    return formatErrorMessage(err);
  }
  if (err instanceof Error) {
    return err.stack ?? err.message ?? err.name;
  }
  return formatErrorMessage(err);
}
