/** @module gateway/server-methods/web -- Web client RPC method handler. */
import { listChannelPlugins } from '../../channels/plugins/index.js';
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateWebLoginStartParams,
  validateWebLoginWaitParams
} from '../protocol/index.js';
import { formatForLog } from '../ws-log.js';
const WEB_LOGIN_METHODS = /* @__PURE__ */ new Set(['web.login.start', 'web.login.wait']);
const resolveWebLoginProvider = () => listChannelPlugins().find(
  (plugin) => (plugin.gatewayMethods ?? []).some((method) => WEB_LOGIN_METHODS.has(method))
) ?? null;
const webHandlers = {
  'web.login.start': async ({ params, respond, context }) => {
    if (!validateWebLoginStartParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid web.login.start params: ${formatValidationErrors(validateWebLoginStartParams.errors)}`
        )
      );
      return;
    }
    try {
      const accountId = typeof params.accountId === 'string' ? params.accountId : void 0;
      const provider = resolveWebLoginProvider();
      if (!provider) {
        respond(
          false,
          void 0,
          errorShape(ErrorCodes.INVALID_REQUEST, 'web login provider is not available')
        );
        return;
      }
      await context.stopChannel(provider.id, accountId);
      if (!provider.gateway?.loginWithQrStart) {
        respond(
          false,
          void 0,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `web login is not supported by provider ${provider.id}`
          )
        );
        return;
      }
      const result = await provider.gateway.loginWithQrStart({
        force: Boolean(params.force),
        timeoutMs: typeof params.timeoutMs === 'number' ? params.timeoutMs : void 0,
        verbose: Boolean(params.verbose),
        accountId
      });
      respond(true, result, void 0);
    } catch (err) {
      respond(false, void 0, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  'web.login.wait': async ({ params, respond, context }) => {
    if (!validateWebLoginWaitParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid web.login.wait params: ${formatValidationErrors(validateWebLoginWaitParams.errors)}`
        )
      );
      return;
    }
    try {
      const accountId = typeof params.accountId === 'string' ? params.accountId : void 0;
      const provider = resolveWebLoginProvider();
      if (!provider) {
        respond(
          false,
          void 0,
          errorShape(ErrorCodes.INVALID_REQUEST, 'web login provider is not available')
        );
        return;
      }
      if (!provider.gateway?.loginWithQrWait) {
        respond(
          false,
          void 0,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `web login is not supported by provider ${provider.id}`
          )
        );
        return;
      }
      const result = await provider.gateway.loginWithQrWait({
        timeoutMs: typeof params.timeoutMs === 'number' ? params.timeoutMs : void 0,
        accountId
      });
      if (result.connected) {
        await context.startChannel(provider.id, accountId);
      }
      respond(true, result, void 0);
    } catch (err) {
      respond(false, void 0, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  }
};
export {
  webHandlers
};
