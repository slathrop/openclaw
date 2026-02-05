/**
 * Logging subsystem barrel re-export.
 *
 * Central entry point for all logging functionality including console
 * capture, log levels, file loggers, subsystem loggers, and redaction.
 * @typedef {import("./logging/console.js").ConsoleStyle} ConsoleStyle
 * @typedef {import("./logging/console.js").ConsoleLoggerSettings} ConsoleLoggerSettings
 * @typedef {import("./logging/levels.js").LogLevel} LogLevel
 * @typedef {import("./logging/logger.js").LoggerResolvedSettings} LoggerResolvedSettings
 * @typedef {import("./logging/logger.js").LoggerSettings} LoggerSettings
 * @typedef {import("./logging/logger.js").PinoLikeLogger} PinoLikeLogger
 * @typedef {import("./logging/subsystem.js").SubsystemLogger} SubsystemLogger
 */
import {
  enableConsoleCapture,
  getConsoleSettings,
  getResolvedConsoleSettings,
  routeLogsToStderr,
  setConsoleSubsystemFilter,
  setConsoleTimestampPrefix,
  shouldLogSubsystemToConsole
} from './logging/console.js';
import { ALLOWED_LOG_LEVELS, levelToMinLevel, normalizeLogLevel } from './logging/levels.js';
import {
  DEFAULT_LOG_DIR,
  DEFAULT_LOG_FILE,
  getChildLogger,
  getLogger,
  getResolvedLoggerSettings,
  isFileLogLevelEnabled,
  resetLogger,
  setLoggerOverride,
  toPinoLikeLogger
} from './logging/logger.js';
import {
  createSubsystemLogger,
  createSubsystemRuntime,
  runtimeForLogger,
  stripRedundantSubsystemPrefixForConsole
} from './logging/subsystem.js';

export {
  enableConsoleCapture,
  getConsoleSettings,
  getResolvedConsoleSettings,
  routeLogsToStderr,
  setConsoleSubsystemFilter,
  setConsoleTimestampPrefix,
  shouldLogSubsystemToConsole,
  ALLOWED_LOG_LEVELS,
  levelToMinLevel,
  normalizeLogLevel,
  DEFAULT_LOG_DIR,
  DEFAULT_LOG_FILE,
  getChildLogger,
  getLogger,
  getResolvedLoggerSettings,
  isFileLogLevelEnabled,
  resetLogger,
  setLoggerOverride,
  toPinoLikeLogger,
  createSubsystemLogger,
  createSubsystemRuntime,
  runtimeForLogger,
  stripRedundantSubsystemPrefixForConsole
};
