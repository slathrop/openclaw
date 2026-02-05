/** @module gateway/server-methods/connect -- Client connection handshake RPC method handler. */
import { ErrorCodes, errorShape } from '../protocol/index.js';
const connectHandlers = {
  connect: ({ respond }) => {
    respond(
      false,
      void 0,
      errorShape(ErrorCodes.INVALID_REQUEST, 'connect is only valid as the first request')
    );
  }
};
export {
  connectHandlers
};
