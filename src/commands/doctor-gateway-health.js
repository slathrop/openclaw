const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { buildGatewayConnectionDetails, callGateway } from '../gateway/call.js';
import { collectChannelStatusIssues } from '../infra/channels-status-issues.js';
import { note } from '../terminal/note.js';
import { formatHealthCheckFailure } from './health-format.js';
import { healthCommand } from './health.js';
async function checkGatewayHealth(params) {
  const gatewayDetails = buildGatewayConnectionDetails({ config: params.cfg });
  const timeoutMs = typeof params.timeoutMs === 'number' && params.timeoutMs > 0 ? params.timeoutMs : 1e4;
  let healthOk = false;
  try {
    await healthCommand({ json: false, timeoutMs, config: params.cfg }, params.runtime);
    healthOk = true;
  } catch (err) {
    const message = String(err);
    if (message.includes('gateway closed')) {
      note('Gateway not running.', 'Gateway');
      note(gatewayDetails.message, 'Gateway connection');
    } else {
      params.runtime.error(formatHealthCheckFailure(err));
    }
  }
  if (healthOk) {
    try {
      const status = await callGateway({
        method: 'channels.status',
        params: { probe: true, timeoutMs: 5e3 },
        timeoutMs: 6e3
      });
      const issues = collectChannelStatusIssues(status);
      if (issues.length > 0) {
        note(
          issues.map(
            (issue) => `- ${issue.channel} ${issue.accountId}: ${issue.message}${issue.fix ? ` (${issue.fix})` : ''}`
          ).join('\n'),
          'Channel warnings'
        );
      }
    } catch {
      // Intentionally ignored
    }
  }
  return { healthOk };
}
__name(checkGatewayHealth, 'checkGatewayHealth');
export {
  checkGatewayHealth
};
