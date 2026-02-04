/**
 * Bonjour error formatting utilities.
 *
 * Provides consistent error-to-string conversion for mDNS/Bonjour subsystem
 * error reporting.
 */

/**
 * @param {unknown} err
 * @returns {string}
 */
export function formatBonjourError(err) {
  if (err instanceof Error) {
    const msg = err.message || String(err);
    return err.name && err.name !== 'Error' ? `${err.name}: ${msg}` : msg;
  }
  return String(err);
}
