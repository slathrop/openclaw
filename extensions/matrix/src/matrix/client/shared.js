import { LogService } from '@vector-im/matrix-bot-sdk';
import { resolveMatrixAuth } from './config.js';
import { createMatrixClient } from './create-client.js';
import { DEFAULT_ACCOUNT_KEY } from './storage.js';
let sharedClientState = null;
let sharedClientPromise = null;
let sharedClientStartPromise = null;
function buildSharedClientKey(auth, accountId) {
  return [
    auth.homeserver,
    auth.userId,
    auth.accessToken,
    auth.encryption ? 'e2ee' : 'plain',
    accountId ?? DEFAULT_ACCOUNT_KEY
  ].join('|');
}
async function createSharedMatrixClient(params) {
  const client = await createMatrixClient({
    homeserver: params.auth.homeserver,
    userId: params.auth.userId,
    accessToken: params.auth.accessToken,
    encryption: params.auth.encryption,
    localTimeoutMs: params.timeoutMs,
    accountId: params.accountId
  });
  return {
    client,
    key: buildSharedClientKey(params.auth, params.accountId),
    started: false,
    cryptoReady: false
  };
}
async function ensureSharedClientStarted(params) {
  if (params.state.started) {
    return;
  }
  if (sharedClientStartPromise) {
    await sharedClientStartPromise;
    return;
  }
  sharedClientStartPromise = (async () => {
    const client = params.state.client;
    if (params.encryption && !params.state.cryptoReady) {
      try {
        const joinedRooms = await client.getJoinedRooms();
        if (client.crypto) {
          await client.crypto.prepare(joinedRooms);
          params.state.cryptoReady = true;
        }
      } catch (err) {
        LogService.warn('MatrixClientLite', 'Failed to prepare crypto:', err);
      }
    }
    await client.start();
    params.state.started = true;
  })();
  try {
    await sharedClientStartPromise;
  } finally {
    sharedClientStartPromise = null;
  }
}
async function resolveSharedMatrixClient(params = {}) {
  const auth = params.auth ?? await resolveMatrixAuth({ cfg: params.cfg, env: params.env });
  const key = buildSharedClientKey(auth, params.accountId);
  const shouldStart = params.startClient !== false;
  if (sharedClientState?.key === key) {
    if (shouldStart) {
      await ensureSharedClientStarted({
        state: sharedClientState,
        timeoutMs: params.timeoutMs,
        initialSyncLimit: auth.initialSyncLimit,
        encryption: auth.encryption
      });
    }
    return sharedClientState.client;
  }
  if (sharedClientPromise) {
    const pending = await sharedClientPromise;
    if (pending.key === key) {
      if (shouldStart) {
        await ensureSharedClientStarted({
          state: pending,
          timeoutMs: params.timeoutMs,
          initialSyncLimit: auth.initialSyncLimit,
          encryption: auth.encryption
        });
      }
      return pending.client;
    }
    pending.client.stop();
    sharedClientState = null;
    sharedClientPromise = null;
  }
  sharedClientPromise = createSharedMatrixClient({
    auth,
    timeoutMs: params.timeoutMs,
    accountId: params.accountId
  });
  try {
    const created = await sharedClientPromise;
    sharedClientState = created;
    if (shouldStart) {
      await ensureSharedClientStarted({
        state: created,
        timeoutMs: params.timeoutMs,
        initialSyncLimit: auth.initialSyncLimit,
        encryption: auth.encryption
      });
    }
    return created.client;
  } finally {
    sharedClientPromise = null;
  }
}
async function waitForMatrixSync(_params) {
}
function stopSharedClient() {
  if (sharedClientState) {
    sharedClientState.client.stop();
    sharedClientState = null;
  }
}
export {
  resolveSharedMatrixClient,
  stopSharedClient,
  waitForMatrixSync
};
