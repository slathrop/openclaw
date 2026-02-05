const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { formatCliCommand } from '../cli/command-format.js';
import { collectConfigEnvVars } from '../config/env-vars.js';
import { resolveGatewayLaunchAgentLabel } from '../daemon/constants.js';
import { resolveGatewayProgramArguments } from '../daemon/program-args.js';
import {
  renderSystemNodeWarning,
  resolvePreferredNodePath,
  resolveSystemNodeInfo
} from '../daemon/runtime-paths.js';
import { buildServiceEnvironment } from '../daemon/service-env.js';
function resolveGatewayDevMode(argv = process.argv) {
  const entry = argv[1];
  const normalizedEntry = entry?.replaceAll('\\', '/');
  return Boolean(normalizedEntry?.includes('/src/') && normalizedEntry.endsWith('.ts'));
}
__name(resolveGatewayDevMode, 'resolveGatewayDevMode');
async function buildGatewayInstallPlan(params) {
  const devMode = params.devMode ?? resolveGatewayDevMode();
  const nodePath = params.nodePath ?? await resolvePreferredNodePath({
    env: params.env,
    runtime: params.runtime
  });
  const { programArguments, workingDirectory } = await resolveGatewayProgramArguments({
    port: params.port,
    dev: devMode,
    runtime: params.runtime,
    nodePath
  });
  if (params.runtime === 'node') {
    const systemNode = await resolveSystemNodeInfo({ env: params.env });
    const warning = renderSystemNodeWarning(systemNode, programArguments[0]);
    if (warning) {
      params.warn?.(warning, 'Gateway runtime');
    }
  }
  const serviceEnvironment = buildServiceEnvironment({
    env: params.env,
    port: params.port,
    token: params.token,
    launchdLabel: process.platform === 'darwin' ? resolveGatewayLaunchAgentLabel(params.env.OPENCLAW_PROFILE) : void 0
  });
  const environment = {
    ...collectConfigEnvVars(params.config)
  };
  Object.assign(environment, serviceEnvironment);
  return { programArguments, workingDirectory, environment };
}
__name(buildGatewayInstallPlan, 'buildGatewayInstallPlan');
function gatewayInstallErrorHint(platform = process.platform) {
  return platform === 'win32' ? 'Tip: rerun from an elevated PowerShell (Start \u2192 type PowerShell \u2192 right-click \u2192 Run as administrator) or skip service install.' : `Tip: rerun \`${formatCliCommand('openclaw gateway install')}\` after fixing the error.`;
}
__name(gatewayInstallErrorHint, 'gatewayInstallErrorHint');
export {
  buildGatewayInstallPlan,
  gatewayInstallErrorHint,
  resolveGatewayDevMode
};
