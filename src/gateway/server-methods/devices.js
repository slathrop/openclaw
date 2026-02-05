/** @module gateway/server-methods/devices -- Device management RPC method handlers. */
import {
  approveDevicePairing,
  listDevicePairing,
  rejectDevicePairing,
  revokeDeviceToken,
  rotateDeviceToken,
  summarizeDeviceTokens
} from '../../infra/device-pairing.js';
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateDevicePairApproveParams,
  validateDevicePairListParams,
  validateDevicePairRejectParams,
  validateDeviceTokenRevokeParams,
  validateDeviceTokenRotateParams
} from '../protocol/index.js';
function redactPairedDevice(device) {
  const { tokens, ...rest } = device;
  return {
    ...rest,
    tokens: summarizeDeviceTokens(tokens)
  };
}
const deviceHandlers = {
  'device.pair.list': async ({ params, respond }) => {
    if (!validateDevicePairListParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid device.pair.list params: ${formatValidationErrors(
            validateDevicePairListParams.errors
          )}`
        )
      );
      return;
    }
    const list = await listDevicePairing();
    respond(
      true,
      {
        pending: list.pending,
        paired: list.paired.map((device) => redactPairedDevice(device))
      },
      void 0
    );
  },
  'device.pair.approve': async ({ params, respond, context }) => {
    if (!validateDevicePairApproveParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid device.pair.approve params: ${formatValidationErrors(
            validateDevicePairApproveParams.errors
          )}`
        )
      );
      return;
    }
    const { requestId } = params;
    const approved = await approveDevicePairing(requestId);
    if (!approved) {
      respond(false, void 0, errorShape(ErrorCodes.INVALID_REQUEST, 'unknown requestId'));
      return;
    }
    context.logGateway.info(
      `device pairing approved device=${approved.device.deviceId} role=${approved.device.role ?? 'unknown'}`
    );
    context.broadcast(
      'device.pair.resolved',
      {
        requestId,
        deviceId: approved.device.deviceId,
        decision: 'approved',
        ts: Date.now()
      },
      { dropIfSlow: true }
    );
    respond(true, { requestId, device: redactPairedDevice(approved.device) }, void 0);
  },
  'device.pair.reject': async ({ params, respond, context }) => {
    if (!validateDevicePairRejectParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid device.pair.reject params: ${formatValidationErrors(
            validateDevicePairRejectParams.errors
          )}`
        )
      );
      return;
    }
    const { requestId } = params;
    const rejected = await rejectDevicePairing(requestId);
    if (!rejected) {
      respond(false, void 0, errorShape(ErrorCodes.INVALID_REQUEST, 'unknown requestId'));
      return;
    }
    context.broadcast(
      'device.pair.resolved',
      {
        requestId,
        deviceId: rejected.deviceId,
        decision: 'rejected',
        ts: Date.now()
      },
      { dropIfSlow: true }
    );
    respond(true, rejected, void 0);
  },
  'device.token.rotate': async ({ params, respond, context }) => {
    if (!validateDeviceTokenRotateParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid device.token.rotate params: ${formatValidationErrors(
            validateDeviceTokenRotateParams.errors
          )}`
        )
      );
      return;
    }
    const { deviceId, role, scopes } = params;
    const entry = await rotateDeviceToken({ deviceId, role, scopes });
    if (!entry) {
      respond(false, void 0, errorShape(ErrorCodes.INVALID_REQUEST, 'unknown deviceId/role'));
      return;
    }
    context.logGateway.info(
      `device token rotated device=${deviceId} role=${entry.role} scopes=${entry.scopes.join(',')}`
    );
    respond(
      true,
      {
        deviceId,
        role: entry.role,
        token: entry.token,
        scopes: entry.scopes,
        rotatedAtMs: entry.rotatedAtMs ?? entry.createdAtMs
      },
      void 0
    );
  },
  'device.token.revoke': async ({ params, respond, context }) => {
    if (!validateDeviceTokenRevokeParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid device.token.revoke params: ${formatValidationErrors(
            validateDeviceTokenRevokeParams.errors
          )}`
        )
      );
      return;
    }
    const { deviceId, role } = params;
    const entry = await revokeDeviceToken({ deviceId, role });
    if (!entry) {
      respond(false, void 0, errorShape(ErrorCodes.INVALID_REQUEST, 'unknown deviceId/role'));
      return;
    }
    context.logGateway.info(`device token revoked device=${deviceId} role=${entry.role}`);
    respond(
      true,
      { deviceId, role: entry.role, revokedAtMs: entry.revokedAtMs ?? Date.now() },
      void 0
    );
  }
};
export {
  deviceHandlers
};
