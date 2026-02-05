/**
 * @module lanes
 * Agent lane assignment for concurrent execution management.
 */
import { CommandLane } from '../process/lanes.js';
const AGENT_LANE_NESTED = CommandLane.Nested;
const AGENT_LANE_SUBAGENT = CommandLane.Subagent;
export {
  AGENT_LANE_NESTED,
  AGENT_LANE_SUBAGENT
};
