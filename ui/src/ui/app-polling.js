import { loadDebug } from './controllers/debug.js';
import { loadLogs } from './controllers/logs.js';
import { loadNodes } from './controllers/nodes.js';
function startNodesPolling(host) {
  if (host.nodesPollInterval !== null && host.nodesPollInterval !== undefined) {
    return;
  }
  host.nodesPollInterval = window.setInterval(
    () => void loadNodes(host, { quiet: true }),
    5e3
  );
}
function stopNodesPolling(host) {
  if (host.nodesPollInterval === null || host.nodesPollInterval === undefined) {
    return;
  }
  clearInterval(host.nodesPollInterval);
  host.nodesPollInterval = null;
}
function startLogsPolling(host) {
  if (host.logsPollInterval !== null && host.logsPollInterval !== undefined) {
    return;
  }
  host.logsPollInterval = window.setInterval(() => {
    if (host.tab !== 'logs') {
      return;
    }
    void loadLogs(host, { quiet: true });
  }, 2e3);
}
function stopLogsPolling(host) {
  if (host.logsPollInterval === null || host.logsPollInterval === undefined) {
    return;
  }
  clearInterval(host.logsPollInterval);
  host.logsPollInterval = null;
}
function startDebugPolling(host) {
  if (host.debugPollInterval !== null && host.debugPollInterval !== undefined) {
    return;
  }
  host.debugPollInterval = window.setInterval(() => {
    if (host.tab !== 'debug') {
      return;
    }
    void loadDebug(host);
  }, 3e3);
}
function stopDebugPolling(host) {
  if (host.debugPollInterval === null || host.debugPollInterval === undefined) {
    return;
  }
  clearInterval(host.debugPollInterval);
  host.debugPollInterval = null;
}
export {
  startDebugPolling,
  startLogsPolling,
  startNodesPolling,
  stopDebugPolling,
  stopLogsPolling,
  stopNodesPolling
};
