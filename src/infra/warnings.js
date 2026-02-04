/**
 * Process warning filter for suppressing known noisy deprecations.
 *
 * Installs a global process 'warning' listener that silences specific
 * deprecation and experimental warnings (punycode, util._extend, SQLite).
 * Installed at most once via a global Symbol key.
 */
const warningFilterKey = Symbol.for('openclaw.warning-filter');

/**
 * Checks whether a warning should be silently ignored.
 * @param {{ code?: string, name?: string, message?: string }} warning
 * @returns {boolean}
 */
function shouldIgnoreWarning(warning) {
  if (warning.code === 'DEP0040' && warning.message?.includes('punycode')) {
    return true;
  }
  if (warning.code === 'DEP0060' && warning.message?.includes('util._extend')) {
    return true;
  }
  if (
    warning.name === 'ExperimentalWarning' &&
    warning.message?.includes('SQLite is an experimental feature')
  ) {
    return true;
  }
  return false;
}

/**
 * Installs a one-time process warning filter.
 * @returns {void}
 */
export function installProcessWarningFilter() {
  if (globalThis[warningFilterKey]?.installed) {
    return;
  }
  globalThis[warningFilterKey] = {installed: true};

  process.on('warning', (warning) => {
    if (shouldIgnoreWarning(warning)) {
      return;
    }
    process.stderr.write(`${warning.stack ?? warning.toString()}\n`);
  });
}
