const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { callGateway } from '../../gateway/call.js';
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from '../../utils/message-channel.js';
import { withProgress } from '../progress.js';
const gatewayCallOpts = /* @__PURE__ */ __name((cmd) => cmd.option('--url <url>', 'Gateway WebSocket URL (defaults to gateway.remote.url when configured)').option('--token <token>', 'Gateway token (if required)').option('--password <password>', 'Gateway password (password auth)').option('--timeout <ms>', 'Timeout in ms', '10000').option('--expect-final', 'Wait for final response (agent)', false).option('--json', 'Output JSON', false), 'gatewayCallOpts');
const callGatewayCli = /* @__PURE__ */ __name(async (method, opts, params) => withProgress(
  {
    label: `Gateway ${method}`,
    indeterminate: true,
    enabled: opts.json !== true
  },
  async () => await callGateway({
    url: opts.url,
    token: opts.token,
    password: opts.password,
    method,
    params,
    expectFinal: Boolean(opts.expectFinal),
    timeoutMs: Number(opts.timeout ?? 1e4),
    clientName: GATEWAY_CLIENT_NAMES.CLI,
    mode: GATEWAY_CLIENT_MODES.CLI
  })
), 'callGatewayCli');
export {
  callGatewayCli,
  gatewayCallOpts
};
