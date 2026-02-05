/** @module gateway/server-methods/models -- Model catalog RPC method handlers. */
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsListParams
} from '../protocol/index.js';
const modelsHandlers = {
  'models.list': async ({ params, respond, context }) => {
    if (!validateModelsListParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.list params: ${formatValidationErrors(validateModelsListParams.errors)}`
        )
      );
      return;
    }
    try {
      const models = await context.loadGatewayModelCatalog();
      respond(true, { models }, void 0);
    } catch (err) {
      respond(false, void 0, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  }
};
export {
  modelsHandlers
};
