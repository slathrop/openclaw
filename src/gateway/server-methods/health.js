/** @module gateway/server-methods/health -- Health check RPC method handler. */
import { getStatusSummary } from '../../commands/status.js';
import { ErrorCodes, errorShape } from '../protocol/index.js';
import { HEALTH_REFRESH_INTERVAL_MS } from '../server-constants.js';
import { formatError } from '../server-utils.js';
import { formatForLog } from '../ws-log.js';
const healthHandlers = {
  health: async ({ respond, context, params }) => {
    const { getHealthCache, refreshHealthSnapshot, logHealth } = context;
    const wantsProbe = params?.probe === true;
    const now = Date.now();
    const cached = getHealthCache();
    if (!wantsProbe && cached && now - cached.ts < HEALTH_REFRESH_INTERVAL_MS) {
      respond(true, cached, void 0, { cached: true });
      void refreshHealthSnapshot({ probe: false }).catch(
        (err) => logHealth.error(`background health refresh failed: ${formatError(err)}`)
      );
      return;
    }
    try {
      const snap = await refreshHealthSnapshot({ probe: wantsProbe });
      respond(true, snap, void 0);
    } catch (err) {
      respond(false, void 0, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  status: async ({ respond }) => {
    const status = await getStatusSummary();
    respond(true, status, void 0);
  }
};
export {
  healthHandlers
};
