/** @module gateway/server-discovery-runtime -- Runtime discovery service for gateway instances. */
import { startGatewayBonjourAdvertiser } from '../infra/bonjour.js';
import { pickPrimaryTailnetIPv4, pickPrimaryTailnetIPv6 } from '../infra/tailnet.js';
import { resolveWideAreaDiscoveryDomain, writeWideAreaGatewayZone } from '../infra/widearea-dns.js';
import {
  formatBonjourInstanceName,
  resolveBonjourCliPath,
  resolveTailnetDnsHint
} from './server-discovery.js';
async function startGatewayDiscovery(params) {
  let bonjourStop = null;
  const mdnsMode = params.mdnsMode ?? 'minimal';
  const bonjourEnabled = mdnsMode !== 'off' && process.env.OPENCLAW_DISABLE_BONJOUR !== '1' && process.env.NODE_ENV !== 'test' && !process.env.VITEST;
  const mdnsMinimal = mdnsMode !== 'full';
  const tailscaleEnabled = params.tailscaleMode !== 'off';
  const needsTailnetDns = bonjourEnabled || params.wideAreaDiscoveryEnabled;
  const tailnetDns = needsTailnetDns ? await resolveTailnetDnsHint({ enabled: tailscaleEnabled }) : void 0;
  const sshPortEnv = mdnsMinimal ? void 0 : process.env.OPENCLAW_SSH_PORT?.trim();
  const sshPortParsed = sshPortEnv ? Number.parseInt(sshPortEnv, 10) : NaN;
  const sshPort = Number.isFinite(sshPortParsed) && sshPortParsed > 0 ? sshPortParsed : void 0;
  const cliPath = mdnsMinimal ? void 0 : resolveBonjourCliPath();
  if (bonjourEnabled) {
    try {
      const bonjour = await startGatewayBonjourAdvertiser({
        instanceName: formatBonjourInstanceName(params.machineDisplayName),
        gatewayPort: params.port,
        gatewayTlsEnabled: params.gatewayTls?.enabled ?? false,
        gatewayTlsFingerprintSha256: params.gatewayTls?.fingerprintSha256,
        canvasPort: params.canvasPort,
        sshPort,
        tailnetDns,
        cliPath,
        minimal: mdnsMinimal
      });
      bonjourStop = bonjour.stop;
    } catch (err) {
      params.logDiscovery.warn(`bonjour advertising failed: ${String(err)}`);
    }
  }
  if (params.wideAreaDiscoveryEnabled) {
    const wideAreaDomain = resolveWideAreaDiscoveryDomain({
      configDomain: params.wideAreaDiscoveryDomain ?? void 0
    });
    if (!wideAreaDomain) {
      params.logDiscovery.warn(
        'discovery.wideArea.enabled is true, but no domain was configured; set discovery.wideArea.domain to enable unicast DNS-SD'
      );
      return { bonjourStop };
    }
    const tailnetIPv4 = pickPrimaryTailnetIPv4();
    if (!tailnetIPv4) {
      params.logDiscovery.warn(
        'discovery.wideArea.enabled is true, but no Tailscale IPv4 address was found; skipping unicast DNS-SD zone update'
      );
    } else {
      try {
        const tailnetIPv6 = pickPrimaryTailnetIPv6();
        const result = await writeWideAreaGatewayZone({
          domain: wideAreaDomain,
          gatewayPort: params.port,
          displayName: formatBonjourInstanceName(params.machineDisplayName),
          tailnetIPv4,
          tailnetIPv6: tailnetIPv6 ?? void 0,
          gatewayTlsEnabled: params.gatewayTls?.enabled ?? false,
          gatewayTlsFingerprintSha256: params.gatewayTls?.fingerprintSha256,
          tailnetDns,
          sshPort,
          cliPath: resolveBonjourCliPath()
        });
        params.logDiscovery.info(
          `wide-area DNS-SD ${result.changed ? 'updated' : 'unchanged'} (${wideAreaDomain} \u2192 ${result.zonePath})`
        );
      } catch (err) {
        params.logDiscovery.warn(`wide-area discovery update failed: ${String(err)}`);
      }
    }
  }
  return { bonjourStop };
}
export {
  startGatewayDiscovery
};
