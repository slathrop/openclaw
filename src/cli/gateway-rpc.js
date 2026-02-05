const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { callGateway } from '../gateway/call.js';
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from '../utils/message-channel.js';
import { withProgress } from './progress.js';
function addGatewayClientOptions(cmd) {
  return cmd.option('--url <url>', 'Gateway WebSocket URL (defaults to gateway.remote.url when configured)').option('--token <token>', 'Gateway token (if required)').option('--timeout <ms>', 'Timeout in ms', '30000').option('--expect-final', 'Wait for final response (agent)', false);
}
__name(addGatewayClientOptions, 'addGatewayClientOptions');
async function callGatewayFromCli(method, opts, params, extra) {
  const showProgress = extra?.progress ?? opts.json !== true;
  return await withProgress(
    {
      label: `Gateway ${method}`,
      indeterminate: true,
      enabled: showProgress
    },
    async () => await callGateway({
      url: opts.url,
      token: opts.token,
      method,
      params,
      expectFinal: extra?.expectFinal ?? Boolean(opts.expectFinal),
      timeoutMs: Number(opts.timeout ?? 1e4),
      clientName: GATEWAY_CLIENT_NAMES.CLI,
      mode: GATEWAY_CLIENT_MODES.CLI
    })
  );
}
__name(callGatewayFromCli, 'callGatewayFromCli');
export {
  addGatewayClientOptions,
  callGatewayFromCli
};
