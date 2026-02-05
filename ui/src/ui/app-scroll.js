const NEAR_BOTTOM_THRESHOLD = 450;
function scheduleChatScroll(host, force = false) {
  if (host.chatScrollFrame) {
    cancelAnimationFrame(host.chatScrollFrame);
  }
  if (host.chatScrollTimeout !== null && host.chatScrollTimeout !== undefined) {
    clearTimeout(host.chatScrollTimeout);
    host.chatScrollTimeout = null;
  }
  const pickScrollTarget = () => {
    const container = host.querySelector('.chat-thread');
    if (container) {
      const overflowY = getComputedStyle(container).overflowY;
      const canScroll = overflowY === 'auto' || overflowY === 'scroll' || container.scrollHeight - container.clientHeight > 1;
      if (canScroll) {
        return container;
      }
    }
    return document.scrollingElement ?? document.documentElement;
  };
  void host.updateComplete.then(() => {
    host.chatScrollFrame = requestAnimationFrame(() => {
      host.chatScrollFrame = null;
      const target = pickScrollTarget();
      if (!target) {
        return;
      }
      const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
      const effectiveForce = force && !host.chatHasAutoScrolled;
      const shouldStick = effectiveForce || host.chatUserNearBottom || distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
      if (!shouldStick) {
        host.chatNewMessagesBelow = true;
        return;
      }
      if (effectiveForce) {
        host.chatHasAutoScrolled = true;
      }
      target.scrollTop = target.scrollHeight;
      host.chatUserNearBottom = true;
      host.chatNewMessagesBelow = false;
      const retryDelay = effectiveForce ? 150 : 120;
      host.chatScrollTimeout = window.setTimeout(() => {
        host.chatScrollTimeout = null;
        const latest = pickScrollTarget();
        if (!latest) {
          return;
        }
        const latestDistanceFromBottom = latest.scrollHeight - latest.scrollTop - latest.clientHeight;
        const shouldStickRetry = effectiveForce || host.chatUserNearBottom || latestDistanceFromBottom < NEAR_BOTTOM_THRESHOLD;
        if (!shouldStickRetry) {
          return;
        }
        latest.scrollTop = latest.scrollHeight;
        host.chatUserNearBottom = true;
      }, retryDelay);
    });
  });
}
function scheduleLogsScroll(host, force = false) {
  if (host.logsScrollFrame) {
    cancelAnimationFrame(host.logsScrollFrame);
  }
  void host.updateComplete.then(() => {
    host.logsScrollFrame = requestAnimationFrame(() => {
      host.logsScrollFrame = null;
      const container = host.querySelector('.log-stream');
      if (!container) {
        return;
      }
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const shouldStick = force || distanceFromBottom < 80;
      if (!shouldStick) {
        return;
      }
      container.scrollTop = container.scrollHeight;
    });
  });
}
function handleChatScroll(host, event) {
  const container = event.currentTarget;
  if (!container) {
    return;
  }
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  host.chatUserNearBottom = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
  if (host.chatUserNearBottom) {
    host.chatNewMessagesBelow = false;
  }
}
function handleLogsScroll(host, event) {
  const container = event.currentTarget;
  if (!container) {
    return;
  }
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  host.logsAtBottom = distanceFromBottom < 80;
}
function resetChatScroll(host) {
  host.chatHasAutoScrolled = false;
  host.chatUserNearBottom = true;
  host.chatNewMessagesBelow = false;
}
function exportLogs(lines, label) {
  if (lines.length === 0) {
    return;
  }
  const blob = new Blob([`${lines.join('\n')}
`], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace(/[:T]/g, '-');
  anchor.href = url;
  anchor.download = `openclaw-logs-${label}-${stamp}.log`;
  anchor.click();
  URL.revokeObjectURL(url);
}
function observeTopbar(host) {
  if (typeof ResizeObserver === 'undefined') {
    return;
  }
  const topbar = host.querySelector('.topbar');
  if (!topbar) {
    return;
  }
  const update = () => {
    const { height } = topbar.getBoundingClientRect();
    host.style.setProperty('--topbar-height', `${height}px`);
  };
  update();
  host.topbarObserver = new ResizeObserver(() => update());
  host.topbarObserver.observe(topbar);
}
export {
  exportLogs,
  handleChatScroll,
  handleLogsScroll,
  observeTopbar,
  resetChatScroll,
  scheduleChatScroll,
  scheduleLogsScroll
};
