/**
 * Logging utilities for Pi embedded runner operations.
 * @module agents/pi-embedded-runner/logger
 */
import { createSubsystemLogger } from '../../logging/subsystem.js';
const log = createSubsystemLogger('agent/embedded');
export {
  log
};
