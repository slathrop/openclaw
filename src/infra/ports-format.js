/**
 * Port diagnostics formatting and listener classification.
 *
 * Classifies port listeners by type (gateway, SSH, unknown) and
 * formats diagnostic output with actionable hints for the user.
 */
import {formatCliCommand} from '../cli/command-format.js';

/**
 * Classifies a port listener as gateway, SSH, or unknown.
 * @param {import('./ports-types.js').PortListener} listener
 * @param {number} port
 * @returns {import('./ports-types.js').PortListenerKind}
 */
export function classifyPortListener(listener, port) {
  const raw = `${listener.commandLine ?? ''} ${listener.command ?? ''}`.trim().toLowerCase();
  if (raw.includes('openclaw')) {
    return 'gateway';
  }
  if (raw.includes('ssh')) {
    const portToken = String(port);
    const tunnelPattern = new RegExp(
      `-(l|r)\\s*${portToken}\\b|-(l|r)${portToken}\\b|:${portToken}\\b`
    );
    if (!raw || tunnelPattern.test(raw)) {
      return 'ssh';
    }
    return 'ssh';
  }
  return 'unknown';
}

/**
 * Builds user-facing hints from a list of port listeners.
 * @param {import('./ports-types.js').PortListener[]} listeners
 * @param {number} port
 * @returns {string[]}
 */
export function buildPortHints(listeners, port) {
  if (listeners.length === 0) {
    return [];
  }
  const kinds = new Set(listeners.map((listener) => classifyPortListener(listener, port)));
  const hints = [];
  if (kinds.has('gateway')) {
    hints.push(
      `Gateway already running locally. Stop it (${formatCliCommand('openclaw gateway stop')}) or use a different port.`
    );
  }
  if (kinds.has('ssh')) {
    hints.push(
      'SSH tunnel already bound to this port. Close the tunnel or use a different local port in -L.'
    );
  }
  if (kinds.has('unknown')) {
    hints.push('Another process is listening on this port.');
  }
  if (listeners.length > 1) {
    hints.push(
      'Multiple listeners detected; ensure only one gateway/tunnel per port unless intentionally running isolated profiles.'
    );
  }
  return hints;
}

/**
 * Formats a single port listener for display.
 * @param {import('./ports-types.js').PortListener} listener
 * @returns {string}
 */
export function formatPortListener(listener) {
  const pid = listener.pid ? `pid ${listener.pid}` : 'pid ?';
  const user = listener.user ? ` ${listener.user}` : '';
  const command = listener.commandLine || listener.command || 'unknown';
  const address = listener.address ? ` (${listener.address})` : '';
  return `${pid}${user}: ${command}${address}`;
}

/**
 * Formats full port diagnostics into display lines.
 * @param {import('./ports-types.js').PortUsage} diagnostics
 * @returns {string[]}
 */
export function formatPortDiagnostics(diagnostics) {
  if (diagnostics.status !== 'busy') {
    return [`Port ${diagnostics.port} is free.`];
  }
  const lines = [`Port ${diagnostics.port} is already in use.`];
  for (const listener of diagnostics.listeners) {
    lines.push(`- ${formatPortListener(listener)}`);
  }
  for (const hint of diagnostics.hints) {
    lines.push(`- ${hint}`);
  }
  return lines;
}
