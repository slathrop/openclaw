const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { resolveNodeService } from '../daemon/node-service.js';
import { resolveGatewayService } from '../daemon/service.js';
import { formatDaemonRuntimeShort } from './status.format.js';
async function buildDaemonStatusSummary(service, fallbackLabel) {
  try {
    const [loaded, runtime, command] = await Promise.all([
      service.isLoaded({ env: process.env }).catch(() => false),
      service.readRuntime(process.env).catch(() => void 0),
      service.readCommand(process.env).catch(() => null)
    ]);
    const installed = command !== null && command !== undefined;
    const loadedText = loaded ? service.loadedText : service.notLoadedText;
    const runtimeShort = formatDaemonRuntimeShort(runtime);
    return { label: service.label, installed, loadedText, runtimeShort };
  } catch {
    return {
      label: fallbackLabel,
      installed: null,
      loadedText: 'unknown',
      runtimeShort: null
    };
  }
}
__name(buildDaemonStatusSummary, 'buildDaemonStatusSummary');
async function getDaemonStatusSummary() {
  return await buildDaemonStatusSummary(resolveGatewayService(), 'Daemon');
}
__name(getDaemonStatusSummary, 'getDaemonStatusSummary');
async function getNodeDaemonStatusSummary() {
  return await buildDaemonStatusSummary(resolveNodeService(), 'Node');
}
__name(getNodeDaemonStatusSummary, 'getNodeDaemonStatusSummary');
export {
  getDaemonStatusSummary,
  getNodeDaemonStatusSummary
};
