import { connectGateway } from './app-gateway.js';
import {
  startLogsPolling,
  startNodesPolling,
  stopLogsPolling,
  stopNodesPolling,
  startDebugPolling,
  stopDebugPolling
} from './app-polling.js';
import { observeTopbar, scheduleChatScroll, scheduleLogsScroll } from './app-scroll.js';
import {
  applySettingsFromUrl,
  attachThemeListener,
  detachThemeListener,
  inferBasePath,
  syncTabWithLocation,
  syncThemeWithSettings
} from './app-settings.js';
function handleConnected(host) {
  host.basePath = inferBasePath();
  applySettingsFromUrl(host);
  syncTabWithLocation(host, true);
  syncThemeWithSettings(host);
  attachThemeListener(host);
  window.addEventListener('popstate', host.popStateHandler);
  connectGateway(host);
  startNodesPolling(host);
  if (host.tab === 'logs') {
    startLogsPolling(host);
  }
  if (host.tab === 'debug') {
    startDebugPolling(host);
  }
}
function handleFirstUpdated(host) {
  observeTopbar(host);
}
function handleDisconnected(host) {
  window.removeEventListener('popstate', host.popStateHandler);
  stopNodesPolling(host);
  stopLogsPolling(host);
  stopDebugPolling(host);
  detachThemeListener(host);
  host.topbarObserver?.disconnect();
  host.topbarObserver = null;
}
function handleUpdated(host, changed) {
  if (host.tab === 'chat' && (changed.has('chatMessages') || changed.has('chatToolMessages') || changed.has('chatStream') || changed.has('chatLoading') || changed.has('tab'))) {
    const forcedByTab = changed.has('tab');
    const forcedByLoad = changed.has('chatLoading') && changed.get('chatLoading') === true && !host.chatLoading;
    scheduleChatScroll(
      host,
      forcedByTab || forcedByLoad || !host.chatHasAutoScrolled
    );
  }
  if (host.tab === 'logs' && (changed.has('logsEntries') || changed.has('logsAutoFollow') || changed.has('tab'))) {
    if (host.logsAutoFollow && host.logsAtBottom) {
      scheduleLogsScroll(
        host,
        changed.has('tab') || changed.has('logsAutoFollow')
      );
    }
  }
}
export {
  handleConnected,
  handleDisconnected,
  handleFirstUpdated,
  handleUpdated
};
