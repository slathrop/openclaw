const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import {
  DEFAULT_GATEWAY_DAEMON_RUNTIME,
  GATEWAY_DAEMON_RUNTIME_OPTIONS,
  isGatewayDaemonRuntime
} from './daemon-runtime.js';
const DEFAULT_NODE_DAEMON_RUNTIME = DEFAULT_GATEWAY_DAEMON_RUNTIME;
const NODE_DAEMON_RUNTIME_OPTIONS = GATEWAY_DAEMON_RUNTIME_OPTIONS;
function isNodeDaemonRuntime(value) {
  return isGatewayDaemonRuntime(value);
}
__name(isNodeDaemonRuntime, 'isNodeDaemonRuntime');
export {
  DEFAULT_NODE_DAEMON_RUNTIME,
  NODE_DAEMON_RUNTIME_OPTIONS,
  isNodeDaemonRuntime
};
