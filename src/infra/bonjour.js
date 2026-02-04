/**
 * mDNS service advertising via @homebridge/ciao.
 *
 * Manages gateway Bonjour/mDNS service registration, TXT record publishing,
 * conflict resolution, and a watchdog for re-advertising after sleep/wake.
 */
import {logDebug, logWarn} from '../logger.js';
import {getLogger} from '../logging.js';
import {ignoreCiaoCancellationRejection} from './bonjour-ciao.js';
import {formatBonjourError} from './bonjour-errors.js';
import {isTruthyEnvValue} from './env.js';
import {registerUnhandledRejectionHandler} from './unhandled-rejections.js';

/**
 * @typedef {{
 *   stop: () => Promise<void>
 * }} GatewayBonjourAdvertiser
 */

/**
 * @typedef {{
 *   instanceName?: string,
 *   gatewayPort: number,
 *   sshPort?: number,
 *   gatewayTlsEnabled?: boolean,
 *   gatewayTlsFingerprintSha256?: string,
 *   canvasPort?: number,
 *   tailnetDns?: string,
 *   cliPath?: string,
 *   minimal?: boolean
 * }} GatewayBonjourAdvertiseOpts
 */

/**
 * @typedef {{
 *   advertise: () => Promise<void>,
 *   destroy: () => Promise<void>,
 *   getFQDN: () => string,
 *   getHostname: () => string,
 *   getPort: () => number,
 *   on: (event: string, listener: (...args: unknown[]) => void) => unknown,
 *   serviceState: string
 * }} BonjourService
 */

function isDisabledByEnv() {
  if (isTruthyEnvValue(process.env.OPENCLAW_DISABLE_BONJOUR)) {
    return true;
  }
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  if (process.env.VITEST) {
    return true;
  }
  return false;
}

/**
 * @param {string} name
 * @returns {string}
 */
function safeServiceName(name) {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : 'OpenClaw';
}

/**
 * @param {string} name
 * @returns {string}
 */
function prettifyInstanceName(name) {
  const normalized = name.trim().replace(/\s+/g, ' ');
  return normalized.replace(/\s+\(OpenClaw\)\s*$/i, '').trim() || normalized;
}

/**
 * @param {string} label
 * @param {BonjourService} svc
 * @returns {string}
 */
function serviceSummary(label, svc) {
  let fqdn = 'unknown';
  let hostname = 'unknown';
  let port = -1;
  try {
    fqdn = svc.getFQDN();
  } catch {
    // ignore
  }
  try {
    hostname = svc.getHostname();
  } catch {
    // ignore
  }
  try {
    port = svc.getPort();
  } catch {
    // ignore
  }
  const state = typeof svc.serviceState === 'string' ? svc.serviceState : 'unknown';
  return `${label} fqdn=${fqdn} host=${hostname} port=${port} state=${state}`;
}

/**
 * Start the gateway mDNS advertiser.
 * @param {GatewayBonjourAdvertiseOpts} opts
 * @returns {Promise<GatewayBonjourAdvertiser>}
 */
export async function startGatewayBonjourAdvertiser(opts) {
  if (isDisabledByEnv()) {
    return {stop: async () => {}};
  }

  const {getResponder, Protocol} = await import('@homebridge/ciao');
  const responder = getResponder();

  // mDNS service instance names are single DNS labels; dots in hostnames
  // (like `Mac.localdomain`) can confuse some resolvers/browsers and break
  // discovery. Keep only the first label and normalize away a trailing `.local`.
  const hostnameRaw =
    process.env.OPENCLAW_MDNS_HOSTNAME?.trim() ||
    process.env.CLAWDBOT_MDNS_HOSTNAME?.trim() ||
    'openclaw';
  const hostname =
    hostnameRaw
      .replace(/\.local$/i, '')
      .split('.')[0]
      .trim() || 'openclaw';
  const instanceName =
    typeof opts.instanceName === 'string' && opts.instanceName.trim()
      ? opts.instanceName.trim()
      : `${hostname} (OpenClaw)`;
  const displayName = prettifyInstanceName(instanceName);

  /** @type {Record<string, string>} */
  const txtBase = {
    role: 'gateway',
    gatewayPort: String(opts.gatewayPort),
    lanHost: `${hostname}.local`,
    displayName
  };
  if (opts.gatewayTlsEnabled) {
    txtBase.gatewayTls = '1';
    if (opts.gatewayTlsFingerprintSha256) {
      txtBase.gatewayTlsSha256 = opts.gatewayTlsFingerprintSha256;
    }
  }
  if (typeof opts.canvasPort === 'number' && opts.canvasPort > 0) {
    txtBase.canvasPort = String(opts.canvasPort);
  }
  if (typeof opts.tailnetDns === 'string' && opts.tailnetDns.trim()) {
    txtBase.tailnetDns = opts.tailnetDns.trim();
  }
  // In minimal mode, omit cliPath to avoid exposing filesystem structure.
  // This info can be obtained via the authenticated WebSocket if needed.
  if (!opts.minimal && typeof opts.cliPath === 'string' && opts.cliPath.trim()) {
    txtBase.cliPath = opts.cliPath.trim();
  }

  /** @type {Array<{ label: string, svc: BonjourService }>} */
  const services = [];

  // Build TXT record for the gateway service.
  // In minimal mode, omit sshPort to avoid advertising SSH availability.
  /** @type {Record<string, string>} */
  const gatewayTxt = {
    ...txtBase,
    transport: 'gateway'
  };
  if (!opts.minimal) {
    gatewayTxt.sshPort = String(opts.sshPort ?? 22);
  }

  const gateway = responder.createService({
    name: safeServiceName(instanceName),
    type: 'openclaw-gw',
    protocol: Protocol.TCP,
    port: opts.gatewayPort,
    domain: 'local',
    hostname,
    txt: gatewayTxt
  });
  services.push({
    label: 'gateway',
    svc: /** @type {BonjourService} */ (gateway)
  });

  /** @type {(() => void) | undefined} */
  let ciaoCancellationRejectionHandler;
  if (services.length > 0) {
    ciaoCancellationRejectionHandler = registerUnhandledRejectionHandler(
      ignoreCiaoCancellationRejection
    );
  }

  logDebug(
    `bonjour: starting (hostname=${hostname}, instance=${JSON.stringify(
      safeServiceName(instanceName)
    )}, gatewayPort=${opts.gatewayPort}${opts.minimal ? ', minimal=true' : `, sshPort=${opts.sshPort ?? 22}`})`
  );

  for (const {label, svc} of services) {
    try {
      svc.on('name-change', (name) => {
        const next = typeof name === 'string' ? name : String(name);
        logWarn(`bonjour: ${label} name conflict resolved; newName=${JSON.stringify(next)}`);
      });
      svc.on('hostname-change', (nextHostname) => {
        const next = typeof nextHostname === 'string' ? nextHostname : String(nextHostname);
        logWarn(
          `bonjour: ${label} hostname conflict resolved; newHostname=${JSON.stringify(next)}`
        );
      });
    } catch (err) {
      logDebug(`bonjour: failed to attach listeners for ${label}: ${String(err)}`);
    }
  }

  // Do not block gateway startup on mDNS probing/announce. Advertising can
  // take multiple seconds depending on network state; the gateway should come
  // up even if Bonjour is slow or fails.
  for (const {label, svc} of services) {
    try {
      void svc
        .advertise()
        .then(() => {
          // Keep this out of stdout/stderr (menubar + tests) but capture in
          // the rolling log.
          getLogger().info(`bonjour: advertised ${serviceSummary(label, svc)}`);
        })
        .catch((err) => {
          logWarn(
            `bonjour: advertise failed (${serviceSummary(label, svc)}): ${formatBonjourError(err)}`
          );
        });
    } catch (err) {
      logWarn(
        `bonjour: advertise threw (${serviceSummary(label, svc)}): ${formatBonjourError(err)}`
      );
    }
  }

  // Watchdog: if we ever end up in an unannounced state (e.g. after
  // sleep/wake or interface churn), try to re-advertise instead of
  // requiring a full gateway restart.
  /** @type {Map<string, number>} */
  const lastRepairAttempt = new Map();
  const watchdog = setInterval(() => {
    for (const {label, svc} of services) {
      const stateUnknown = /** @type {{ serviceState?: unknown }} */ (svc).serviceState;
      if (typeof stateUnknown !== 'string') {
        continue;
      }
      if (stateUnknown === 'announced' || stateUnknown === 'announcing') {
        continue;
      }

      let key = label;
      try {
        key = `${label}:${svc.getFQDN()}`;
      } catch {
        // ignore
      }
      const now = Date.now();
      const last = lastRepairAttempt.get(key) ?? 0;
      if (now - last < 30_000) {
        continue;
      }
      lastRepairAttempt.set(key, now);

      logWarn(
        `bonjour: watchdog detected non-announced service; attempting re-advertise (${serviceSummary(
          label,
          svc
        )})`
      );
      try {
        void svc.advertise().catch((err) => {
          logWarn(
            `bonjour: watchdog advertise failed (${serviceSummary(label, svc)}): ${formatBonjourError(err)}`
          );
        });
      } catch (err) {
        logWarn(
          `bonjour: watchdog advertise threw (${serviceSummary(label, svc)}): ${formatBonjourError(err)}`
        );
      }
    }
  }, 60_000);
  watchdog.unref?.();

  return {
    stop: async () => {
      clearInterval(watchdog);
      for (const {svc} of services) {
        try {
          await svc.destroy();
        } catch {
          /* ignore */
        }
      }
      try {
        await responder.shutdown();
      } catch {
        /* ignore */
      } finally {
        ciaoCancellationRejectionHandler?.();
      }
    }
  };
}
