/**
 * Lane-based execution routing for Pi embedded runner.
 * @module agents/pi-embedded-runner/lanes
 */
import { CommandLane } from '../../process/lanes.js';
function resolveSessionLane(key) {
  const cleaned = key.trim() || CommandLane.Main;
  return cleaned.startsWith('session:') ? cleaned : `session:${cleaned}`;
}
function resolveGlobalLane(lane) {
  const cleaned = lane?.trim();
  return cleaned ? cleaned : CommandLane.Main;
}
function resolveEmbeddedSessionLane(key) {
  return resolveSessionLane(key);
}
export {
  resolveEmbeddedSessionLane,
  resolveGlobalLane,
  resolveSessionLane
};
