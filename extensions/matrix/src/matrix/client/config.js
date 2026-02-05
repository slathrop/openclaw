import { MatrixClient } from '@vector-im/matrix-bot-sdk';
import { getMatrixRuntime } from '../../runtime.js';
import { ensureMatrixSdkLoggingConfigured } from './logging.js';
function clean(value) {
  return value?.trim() ?? '';
}
function resolveMatrixConfig(cfg = getMatrixRuntime().config.loadConfig(), env = process.env) {
  const matrix = cfg.channels?.matrix ?? {};
  const homeserver = clean(matrix.homeserver) || clean(env.MATRIX_HOMESERVER);
  const userId = clean(matrix.userId) || clean(env.MATRIX_USER_ID);
  const accessToken = clean(matrix.accessToken) || clean(env.MATRIX_ACCESS_TOKEN) || void 0;
  const password = clean(matrix.password) || clean(env.MATRIX_PASSWORD) || void 0;
  const deviceName = clean(matrix.deviceName) || clean(env.MATRIX_DEVICE_NAME) || void 0;
  const initialSyncLimit = typeof matrix.initialSyncLimit === 'number' ? Math.max(0, Math.floor(matrix.initialSyncLimit)) : void 0;
  const encryption = matrix.encryption ?? false;
  return {
    homeserver,
    userId,
    accessToken,
    password,
    deviceName,
    initialSyncLimit,
    encryption
  };
}
async function resolveMatrixAuth(params) {
  const cfg = params?.cfg ?? getMatrixRuntime().config.loadConfig();
  const env = params?.env ?? process.env;
  const resolved = resolveMatrixConfig(cfg, env);
  if (!resolved.homeserver) {
    throw new Error('Matrix homeserver is required (matrix.homeserver)');
  }
  const {
    loadMatrixCredentials,
    saveMatrixCredentials,
    credentialsMatchConfig,
    touchMatrixCredentials
  } = await import('../credentials.js');
  const cached = loadMatrixCredentials(env);
  const cachedCredentials = cached && credentialsMatchConfig(cached, {
    homeserver: resolved.homeserver,
    userId: resolved.userId || ''
  }) ? cached : null;
  if (resolved.accessToken) {
    let userId = resolved.userId;
    if (!userId) {
      ensureMatrixSdkLoggingConfigured();
      const tempClient = new MatrixClient(resolved.homeserver, resolved.accessToken);
      const whoami = await tempClient.getUserId();
      userId = whoami;
      saveMatrixCredentials({
        homeserver: resolved.homeserver,
        userId,
        accessToken: resolved.accessToken
      });
    } else if (cachedCredentials && cachedCredentials.accessToken === resolved.accessToken) {
      touchMatrixCredentials(env);
    }
    return {
      homeserver: resolved.homeserver,
      userId,
      accessToken: resolved.accessToken,
      deviceName: resolved.deviceName,
      initialSyncLimit: resolved.initialSyncLimit,
      encryption: resolved.encryption
    };
  }
  if (cachedCredentials) {
    touchMatrixCredentials(env);
    return {
      homeserver: cachedCredentials.homeserver,
      userId: cachedCredentials.userId,
      accessToken: cachedCredentials.accessToken,
      deviceName: resolved.deviceName,
      initialSyncLimit: resolved.initialSyncLimit,
      encryption: resolved.encryption
    };
  }
  if (!resolved.userId) {
    throw new Error('Matrix userId is required when no access token is configured (matrix.userId)');
  }
  if (!resolved.password) {
    throw new Error(
      'Matrix password is required when no access token is configured (matrix.password)'
    );
  }
  const loginResponse = await fetch(`${resolved.homeserver}/_matrix/client/v3/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: resolved.userId },
      password: resolved.password,
      initial_device_display_name: resolved.deviceName ?? 'OpenClaw Gateway'
    })
  });
  if (!loginResponse.ok) {
    const errorText = await loginResponse.text();
    throw new Error(`Matrix login failed: ${errorText}`);
  }
  const login = await loginResponse.json();
  const accessToken = login.access_token?.trim();
  if (!accessToken) {
    throw new Error('Matrix login did not return an access token');
  }
  const auth = {
    homeserver: resolved.homeserver,
    userId: login.user_id ?? resolved.userId,
    accessToken,
    deviceName: resolved.deviceName,
    initialSyncLimit: resolved.initialSyncLimit,
    encryption: resolved.encryption
  };
  saveMatrixCredentials({
    homeserver: auth.homeserver,
    userId: auth.userId,
    accessToken: auth.accessToken,
    deviceId: login.device_id
  });
  return auth;
}
export {
  resolveMatrixAuth,
  resolveMatrixConfig
};
