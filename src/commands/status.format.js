const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
const formatKTokens = /* @__PURE__ */ __name((value) => `${(value / 1e3).toFixed(value >= 1e4 ? 0 : 1)}k`, 'formatKTokens');
const formatAge = /* @__PURE__ */ __name((ms) => {
  if (!ms || ms < 0) {
    return 'unknown';
  }
  const minutes = Math.round(ms / 6e4);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}, 'formatAge');
const formatDuration = /* @__PURE__ */ __name((ms) => {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) {
    return 'unknown';
  }
  if (ms < 1e3) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1e3).toFixed(1)}s`;
}, 'formatDuration');
const shortenText = /* @__PURE__ */ __name((value, maxLen) => {
  const chars = Array.from(value);
  if (chars.length <= maxLen) {
    return value;
  }
  return `${chars.slice(0, Math.max(0, maxLen - 1)).join('')}\u2026`;
}, 'shortenText');
const formatTokensCompact = /* @__PURE__ */ __name((sess) => {
  const used = sess.totalTokens ?? 0;
  const ctx = sess.contextTokens;
  if (!ctx) {
    return `${formatKTokens(used)} used`;
  }
  const pctLabel = sess.percentUsed !== null && sess.percentUsed !== undefined ? `${sess.percentUsed}%` : '?%';
  return `${formatKTokens(used)}/${formatKTokens(ctx)} (${pctLabel})`;
}, 'formatTokensCompact');
const formatDaemonRuntimeShort = /* @__PURE__ */ __name((runtime) => {
  if (!runtime) {
    return null;
  }
  const status = runtime.status ?? 'unknown';
  const details = [];
  if (runtime.pid) {
    details.push(`pid ${runtime.pid}`);
  }
  if (runtime.state && runtime.state.toLowerCase() !== status) {
    details.push(`state ${runtime.state}`);
  }
  const detail = runtime.detail?.replace(/\s+/g, ' ').trim() || '';
  const noisyLaunchctlDetail = runtime.missingUnit === true && detail.toLowerCase().includes('could not find service');
  if (detail && !noisyLaunchctlDetail) {
    details.push(detail);
  }
  return details.length > 0 ? `${status} (${details.join(', ')})` : status;
}, 'formatDaemonRuntimeShort');
export {
  formatAge,
  formatDaemonRuntimeShort,
  formatDuration,
  formatKTokens,
  formatTokensCompact,
  shortenText
};
