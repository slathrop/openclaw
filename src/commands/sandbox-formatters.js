const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
function formatStatus(running) {
  return running ? '\u{1F7E2} running' : '\u26AB stopped';
}
__name(formatStatus, 'formatStatus');
function formatSimpleStatus(running) {
  return running ? 'running' : 'stopped';
}
__name(formatSimpleStatus, 'formatSimpleStatus');
function formatImageMatch(matches) {
  return matches ? '\u2713' : '\u26A0\uFE0F  mismatch';
}
__name(formatImageMatch, 'formatImageMatch');
function formatAge(ms) {
  const seconds = Math.floor(ms / 1e3);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}
__name(formatAge, 'formatAge');
function countRunning(items) {
  return items.filter((item) => item.running).length;
}
__name(countRunning, 'countRunning');
function countMismatches(items) {
  return items.filter((item) => !item.imageMatch).length;
}
__name(countMismatches, 'countMismatches');
export {
  countMismatches,
  countRunning,
  formatAge,
  formatImageMatch,
  formatSimpleStatus,
  formatStatus
};
