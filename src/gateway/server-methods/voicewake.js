/** @module gateway/server-methods/voicewake -- Voice wake word configuration RPC method handler. */
import { loadVoiceWakeConfig, setVoiceWakeTriggers } from '../../infra/voicewake.js';
import { ErrorCodes, errorShape } from '../protocol/index.js';
import { normalizeVoiceWakeTriggers } from '../server-utils.js';
import { formatForLog } from '../ws-log.js';
const voicewakeHandlers = {
  'voicewake.get': async ({ respond }) => {
    try {
      const cfg = await loadVoiceWakeConfig();
      respond(true, { triggers: cfg.triggers });
    } catch (err) {
      respond(false, void 0, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  'voicewake.set': async ({ params, respond, context }) => {
    if (!Array.isArray(params.triggers)) {
      respond(
        false,
        void 0,
        errorShape(ErrorCodes.INVALID_REQUEST, 'voicewake.set requires triggers: string[]')
      );
      return;
    }
    try {
      const triggers = normalizeVoiceWakeTriggers(params.triggers);
      const cfg = await setVoiceWakeTriggers(triggers);
      context.broadcastVoiceWakeChanged(cfg.triggers);
      respond(true, { triggers: cfg.triggers });
    } catch (err) {
      respond(false, void 0, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  }
};
export {
  voicewakeHandlers
};
