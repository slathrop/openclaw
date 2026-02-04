/**
 * Ciao cancellation rejection handler.
 *
 * Suppresses expected unhandled rejection from @homebridge/ciao when
 * service announcements are cancelled during shutdown.
 */
import {logDebug} from '../logger.js';
import {formatBonjourError} from './bonjour-errors.js';

/**
 * @param {unknown} reason
 * @returns {boolean}
 */
export function ignoreCiaoCancellationRejection(reason) {
  const message = formatBonjourError(reason).toUpperCase();
  if (!message.includes('CIAO ANNOUNCEMENT CANCELLED')) {
    return false;
  }
  logDebug(`bonjour: ignoring unhandled ciao rejection: ${formatBonjourError(reason)}`);
  return true;
}
