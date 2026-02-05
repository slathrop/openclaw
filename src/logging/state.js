/**
 * Shared mutable logging state.
 *
 * Holds cached logger instances, console settings, and patching flags.
 * Exported as a singleton so all logging modules share the same state.
 */
export const loggingState = {
  cachedLogger: null,
  cachedSettings: null,
  cachedConsoleSettings: null,
  overrideSettings: null,
  consolePatched: false,
  forceConsoleToStderr: false,
  consoleTimestampPrefix: false,
  consoleSubsystemFilter: null,
  resolvingConsoleSettings: false,
  rawConsole: null
};
