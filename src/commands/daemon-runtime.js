const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
const DEFAULT_GATEWAY_DAEMON_RUNTIME = 'node';
const GATEWAY_DAEMON_RUNTIME_OPTIONS = [
  {
    value: 'node',
    label: 'Node (recommended)',
    hint: 'Required for WhatsApp + Telegram. Bun can corrupt memory on reconnect.'
  }
];
function isGatewayDaemonRuntime(value) {
  return value === 'node' || value === 'bun';
}
__name(isGatewayDaemonRuntime, 'isGatewayDaemonRuntime');
export {
  DEFAULT_GATEWAY_DAEMON_RUNTIME,
  GATEWAY_DAEMON_RUNTIME_OPTIONS,
  isGatewayDaemonRuntime
};
