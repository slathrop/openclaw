import { getMatrixRuntime } from '../../runtime.js';
import { getActiveMatrixClient } from '../active-client.js';
import {
  createMatrixClient,
  isBunRuntime,
  resolveMatrixAuth,
  resolveSharedMatrixClient
} from '../client.js';
const getCore = () => getMatrixRuntime();
function ensureNodeRuntime() {
  if (isBunRuntime()) {
    throw new Error('Matrix support requires Node (bun runtime not supported)');
  }
}
function resolveMediaMaxBytes() {
  const cfg = getCore().config.loadConfig();
  if (typeof cfg.channels?.matrix?.mediaMaxMb === 'number') {
    return cfg.channels.matrix.mediaMaxMb * 1024 * 1024;
  }
  return void 0;
}
async function resolveMatrixClient(opts) {
  ensureNodeRuntime();
  if (opts.client) {
    return { client: opts.client, stopOnDone: false };
  }
  const active = getActiveMatrixClient();
  if (active) {
    return { client: active, stopOnDone: false };
  }
  const shouldShareClient = Boolean(process.env.OPENCLAW_GATEWAY_PORT);
  if (shouldShareClient) {
    const client2 = await resolveSharedMatrixClient({
      timeoutMs: opts.timeoutMs
    });
    return { client: client2, stopOnDone: false };
  }
  const auth = await resolveMatrixAuth();
  const client = await createMatrixClient({
    homeserver: auth.homeserver,
    userId: auth.userId,
    accessToken: auth.accessToken,
    encryption: auth.encryption,
    localTimeoutMs: opts.timeoutMs
  });
  if (auth.encryption && client.crypto) {
    try {
      const joinedRooms = await client.getJoinedRooms();
      await client.crypto.prepare(joinedRooms);
    } catch { /* intentionally empty */ }
  }
  await client.start();
  return { client, stopOnDone: true };
}
export {
  ensureNodeRuntime,
  resolveMatrixClient,
  resolveMediaMaxBytes
};
