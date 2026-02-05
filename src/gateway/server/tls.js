/** @module gateway/server/tls -- TLS certificate loading and HTTPS configuration. */
import {
  loadGatewayTlsRuntime as loadGatewayTlsRuntimeConfig
} from '../../infra/tls/gateway.js';
async function loadGatewayTlsRuntime(cfg, log) {
  return await loadGatewayTlsRuntimeConfig(cfg, log);
}
export {
  loadGatewayTlsRuntime
};
