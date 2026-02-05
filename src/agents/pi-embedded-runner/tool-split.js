/**
 * Tool call splitting and dispatch for Pi embedded runner.
 * @module agents/pi-embedded-runner/tool-split
 */
import { toToolDefinitions } from '../pi-tool-definition-adapter.js';
function splitSdkTools(options) {
  const { tools } = options;
  return {
    builtInTools: [],
    customTools: toToolDefinitions(tools)
  };
}
export {
  splitSdkTools
};
