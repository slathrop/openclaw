const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { readConfigFileSnapshot, resolveGatewayPort } from '../config/config.js';
import { copyToClipboard } from '../infra/clipboard.js';
import { defaultRuntime } from '../runtime.js';
import {
  detectBrowserOpenSupport,
  formatControlUiSshHint,
  openUrl,
  resolveControlUiLinks
} from './onboard-helpers.js';
async function dashboardCommand(runtime = defaultRuntime, options = {}) {
  const snapshot = await readConfigFileSnapshot();
  const cfg = snapshot.valid ? snapshot.config : {};
  const port = resolveGatewayPort(cfg);
  const bind = cfg.gateway?.bind ?? 'loopback';
  const basePath = cfg.gateway?.controlUi?.basePath;
  const customBindHost = cfg.gateway?.customBindHost;
  const token = cfg.gateway?.auth?.token ?? process.env.OPENCLAW_GATEWAY_TOKEN ?? '';
  const links = resolveControlUiLinks({
    port,
    bind,
    customBindHost,
    basePath
  });
  const authedUrl = token ? `${links.httpUrl}?token=${encodeURIComponent(token)}` : links.httpUrl;
  runtime.log(`Dashboard URL: ${authedUrl}`);
  const copied = await copyToClipboard(authedUrl).catch(() => false);
  runtime.log(copied ? 'Copied to clipboard.' : 'Copy to clipboard unavailable.');
  let opened = false;
  let hint;
  if (!options.noOpen) {
    const browserSupport = await detectBrowserOpenSupport();
    if (browserSupport.ok) {
      opened = await openUrl(authedUrl);
    }
    if (!opened) {
      hint = formatControlUiSshHint({
        port,
        basePath,
        token: token || void 0
      });
    }
  } else {
    hint = 'Browser launch disabled (--no-open). Use the URL above.';
  }
  if (opened) {
    runtime.log('Opened in your browser. Keep that tab to control OpenClaw.');
  } else if (hint) {
    runtime.log(hint);
  }
}
__name(dashboardCommand, 'dashboardCommand');
export {
  dashboardCommand
};
