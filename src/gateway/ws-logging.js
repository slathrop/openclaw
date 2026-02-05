/** @module gateway/ws-logging -- WebSocket message logging and debugging. */
let gatewayWsLogStyle = 'auto';
function setGatewayWsLogStyle(style) {
  gatewayWsLogStyle = style;
}
function getGatewayWsLogStyle() {
  return gatewayWsLogStyle;
}
const DEFAULT_WS_SLOW_MS = 50;
export {
  DEFAULT_WS_SLOW_MS,
  getGatewayWsLogStyle,
  setGatewayWsLogStyle
};
