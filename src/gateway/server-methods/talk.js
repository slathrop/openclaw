/** @module gateway/server-methods/talk -- Voice talk RPC method handler. */
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateTalkModeParams
} from '../protocol/index.js';
const talkHandlers = {
  'talk.mode': ({ params, respond, context, client, isWebchatConnect }) => {
    if (client && isWebchatConnect(client.connect) && !context.hasConnectedMobileNode()) {
      respond(
        false,
        void 0,
        errorShape(ErrorCodes.UNAVAILABLE, 'talk disabled: no connected iOS/Android nodes')
      );
      return;
    }
    if (!validateTalkModeParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid talk.mode params: ${formatValidationErrors(validateTalkModeParams.errors)}`
        )
      );
      return;
    }
    const payload = {
      enabled: params.enabled,
      phase: params.phase ?? null,
      ts: Date.now()
    };
    context.broadcast('talk.mode', payload, { dropIfSlow: true });
    respond(true, payload, void 0);
  }
};
export {
  talkHandlers
};
