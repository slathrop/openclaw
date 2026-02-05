import { isBunRuntime } from './client/runtime.js';
import { resolveMatrixConfig, resolveMatrixAuth } from './client/config.js';
import { createMatrixClient } from './client/create-client.js';
import { resolveSharedMatrixClient, waitForMatrixSync, stopSharedClient } from './client/shared.js';
export {
  createMatrixClient,
  isBunRuntime,
  resolveMatrixAuth,
  resolveMatrixConfig,
  resolveSharedMatrixClient,
  stopSharedClient,
  waitForMatrixSync
};
