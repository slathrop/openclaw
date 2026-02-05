/**
 * @module runtime
 * Runtime environment initialization.
 *
 * Provides default runtime bindings (log, error, exit) that clear active
 * progress lines before output and restore terminal state on exit.
 * Used for dependency injection in CLI commands and tests.
 */
import {clearActiveProgressLine} from './terminal/progress-line.js';
import {restoreTerminalState} from './terminal/restore.js';

export const defaultRuntime = {
  log: (...args) => {
    clearActiveProgressLine();
    console.log(...args);
  },
  error: (...args) => {
    clearActiveProgressLine();
    console.error(...args);
  },
  exit: (code) => {
    restoreTerminalState('runtime exit');
    process.exit(code);
    throw new Error('unreachable'); // satisfies tests when mocked
  }
};
