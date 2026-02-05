/**
 * Gateway communication helpers for tool-gateway interactions.
 * @module agents/tools/gateway
 */
import { callGateway } from '../../gateway/call.js';
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from '../../utils/message-channel.js';
const DEFAULT_GATEWAY_URL = 'ws://127.0.0.1:18789';
function resolveGatewayOptions(opts) {
  const url = typeof opts?.gatewayUrl === 'string' && opts.gatewayUrl.trim() ? opts.gatewayUrl.trim() : void 0;
  const token = typeof opts?.gatewayToken === 'string' && opts.gatewayToken.trim() ? opts.gatewayToken.trim() : void 0;
  const timeoutMs = typeof opts?.timeoutMs === 'number' && Number.isFinite(opts.timeoutMs) ? Math.max(1, Math.floor(opts.timeoutMs)) : 3e4;
  return { url, token, timeoutMs };
}
async function callGatewayTool(method, opts, params, extra) {
  const gateway = resolveGatewayOptions(opts);
  return await callGateway({
    url: gateway.url,
    token: gateway.token,
    method,
    params,
    timeoutMs: gateway.timeoutMs,
    expectFinal: extra?.expectFinal,
    clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
    clientDisplayName: 'agent',
    mode: GATEWAY_CLIENT_MODES.BACKEND
  });
}
export {
  DEFAULT_GATEWAY_URL,
  callGatewayTool,
  resolveGatewayOptions
};
