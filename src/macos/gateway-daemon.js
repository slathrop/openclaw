#!/usr/bin/env node
/* global __OPENCLAW_VERSION__ */
import process from 'node:process';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

const BUNDLED_VERSION = typeof __OPENCLAW_VERSION__ === 'string' && __OPENCLAW_VERSION__ || process.env.OPENCLAW_BUNDLED_VERSION || '0.0.0';
function argValue(args2, flag) {
  const idx = args2.indexOf(flag);
  if (idx < 0) {
    return void 0;
  }
  const value = args2[idx + 1];
  return value && !value.startsWith('-') ? value : void 0;
}
function hasFlag(args2, flag) {
  return args2.includes(flag);
}
const args = process.argv.slice(2);
async function main() {
  if (hasFlag(args, '--version') || hasFlag(args, '-v')) {
    console.log(BUNDLED_VERSION);
    process.exit(0);
  }
  if (typeof process.versions.bun === 'string') {
    const mod = await import('long');
    const Long = mod.default ?? mod;
    globalThis.Long = Long;
  }
  const [
    { loadConfig },
    { startGatewayServer },
    { setGatewayWsLogStyle },
    { setVerbose },
    { acquireGatewayLock, GatewayLockError },
    { consumeGatewaySigusr1RestartAuthorization, isGatewaySigusr1RestartExternallyAllowed },
    { defaultRuntime },
    { enableConsoleCapture, setConsoleTimestampPrefix }
  ] = await Promise.all([
    import('../config/config.js'),
    import('../gateway/server.js'),
    import('../gateway/ws-logging.js'),
    import('../globals.js'),
    import('../infra/gateway-lock.js'),
    import('../infra/restart.js'),
    import('../runtime.js'),
    import('../logging.js')
  ]);
  enableConsoleCapture();
  setConsoleTimestampPrefix(true);
  setVerbose(hasFlag(args, '--verbose'));
  const wsLogRaw = hasFlag(args, '--compact') ? 'compact' : argValue(args, '--ws-log');
  const wsLogStyle = wsLogRaw === 'compact' ? 'compact' : wsLogRaw === 'full' ? 'full' : 'auto';
  setGatewayWsLogStyle(wsLogStyle);
  const cfg = loadConfig();
  const portRaw = argValue(args, '--port') ?? process.env.OPENCLAW_GATEWAY_PORT ?? process.env.CLAWDBOT_GATEWAY_PORT ?? (typeof cfg.gateway?.port === 'number' ? String(cfg.gateway.port) : '') ?? '18789';
  const port = Number.parseInt(portRaw, 10);
  if (Number.isNaN(port) || port <= 0) {
    defaultRuntime.error(`Invalid --port (${portRaw})`);
    process.exit(1);
  }
  const bindRaw = argValue(args, '--bind') ?? process.env.OPENCLAW_GATEWAY_BIND ?? process.env.CLAWDBOT_GATEWAY_BIND ?? cfg.gateway?.bind ?? 'loopback';
  const bind = bindRaw === 'loopback' || bindRaw === 'lan' || bindRaw === 'auto' || bindRaw === 'custom' || bindRaw === 'tailnet' ? bindRaw : null;
  if (!bind) {
    defaultRuntime.error('Invalid --bind (use "loopback", "lan", "tailnet", "auto", or "custom")');
    process.exit(1);
  }
  const token = argValue(args, '--token');
  if (token) {
    process.env.OPENCLAW_GATEWAY_TOKEN = token;
  }
  let server = null;
  let lock = null;
  let shuttingDown = false;
  let forceExitTimer = null;
  let restartResolver = null;
  const cleanupSignals = () => {
    process.removeListener('SIGTERM', onSigterm);
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGUSR1', onSigusr1);
  };
  const request = (action, signal) => {
    if (shuttingDown) {
      defaultRuntime.log(`gateway: received ${signal} during shutdown; ignoring`);
      return;
    }
    shuttingDown = true;
    const isRestart = action === 'restart';
    defaultRuntime.log(
      `gateway: received ${signal}; ${isRestart ? 'restarting' : 'shutting down'}`
    );
    forceExitTimer = setTimeout(() => {
      defaultRuntime.error('gateway: shutdown timed out; exiting without full cleanup');
      cleanupSignals();
      process.exit(0);
    }, 5e3);
    void (async () => {
      try {
        await server?.close({
          reason: isRestart ? 'gateway restarting' : 'gateway stopping',
          restartExpectedMs: isRestart ? 1500 : null
        });
      } catch (err) {
        defaultRuntime.error(`gateway: shutdown error: ${String(err)}`);
      } finally {
        if (forceExitTimer) {
          clearTimeout(forceExitTimer);
        }
        server = null;
        if (isRestart) {
          shuttingDown = false;
          restartResolver?.();
        } else {
          cleanupSignals();
          process.exit(0);
        }
      }
    })();
  };
  const onSigterm = () => {
    defaultRuntime.log('gateway: signal SIGTERM received');
    request('stop', 'SIGTERM');
  };
  const onSigint = () => {
    defaultRuntime.log('gateway: signal SIGINT received');
    request('stop', 'SIGINT');
  };
  const onSigusr1 = () => {
    defaultRuntime.log('gateway: signal SIGUSR1 received');
    const authorized = consumeGatewaySigusr1RestartAuthorization();
    if (!authorized && !isGatewaySigusr1RestartExternallyAllowed()) {
      defaultRuntime.log(
        'gateway: SIGUSR1 restart ignored (not authorized; enable commands.restart or use gateway tool).'
      );
      return;
    }
    request('restart', 'SIGUSR1');
  };
  process.on('SIGTERM', onSigterm);
  process.on('SIGINT', onSigint);
  process.on('SIGUSR1', onSigusr1);
  try {
    try {
      lock = await acquireGatewayLock();
    } catch (err) {
      if (err instanceof GatewayLockError) {
        defaultRuntime.error(`Gateway start blocked: ${err.message}`);
        process.exit(1);
      }
      throw err;
    }
    while (true) {
      try {
        server = await startGatewayServer(port, { bind });
      } catch (err) {
        cleanupSignals();
        defaultRuntime.error(`Gateway failed to start: ${String(err)}`);
        process.exit(1);
      }
      await new Promise((resolve) => {
        restartResolver = resolve;
      });
    }
  } finally {
    await lock?.release();
    cleanupSignals();
  }
}
void main().catch((err) => {
  console.error(
    '[openclaw] Gateway daemon failed:',
    err instanceof Error ? err.stack ?? err.message : err
  );
  process.exit(1);
});
