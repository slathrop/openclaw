const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { resolveGatewayService } from '../../../daemon/service.js';
import { isSystemdUserServiceAvailable } from '../../../daemon/systemd.js';
import { buildGatewayInstallPlan, gatewayInstallErrorHint } from '../../daemon-install-helpers.js';
import { DEFAULT_GATEWAY_DAEMON_RUNTIME, isGatewayDaemonRuntime } from '../../daemon-runtime.js';
import { ensureSystemdUserLingerNonInteractive } from '../../systemd-linger.js';
async function installGatewayDaemonNonInteractive(params) {
  const { opts, runtime, port, gatewayToken } = params;
  if (!opts.installDaemon) {
    return;
  }
  const daemonRuntimeRaw = opts.daemonRuntime ?? DEFAULT_GATEWAY_DAEMON_RUNTIME;
  const systemdAvailable = process.platform === 'linux' ? await isSystemdUserServiceAvailable() : true;
  if (process.platform === 'linux' && !systemdAvailable) {
    runtime.log('Systemd user services are unavailable; skipping service install.');
    return;
  }
  if (!isGatewayDaemonRuntime(daemonRuntimeRaw)) {
    runtime.error('Invalid --daemon-runtime (use node or bun)');
    runtime.exit(1);
    return;
  }
  const service = resolveGatewayService();
  const { programArguments, workingDirectory, environment } = await buildGatewayInstallPlan({
    env: process.env,
    port,
    token: gatewayToken,
    runtime: daemonRuntimeRaw,
    warn: /* @__PURE__ */ __name((message) => runtime.log(message), 'warn'),
    config: params.nextConfig
  });
  try {
    await service.install({
      env: process.env,
      stdout: process.stdout,
      programArguments,
      workingDirectory,
      environment
    });
  } catch (err) {
    runtime.error(`Gateway service install failed: ${String(err)}`);
    runtime.log(gatewayInstallErrorHint());
    return;
  }
  await ensureSystemdUserLingerNonInteractive({ runtime });
}
__name(installGatewayDaemonNonInteractive, 'installGatewayDaemonNonInteractive');
export {
  installGatewayDaemonNonInteractive
};
