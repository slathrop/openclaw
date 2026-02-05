const DEFAULT_QUEUE_DEBOUNCE_MS = 1e3;
const DEFAULT_QUEUE_CAP = 20;
const DEFAULT_QUEUE_DROP = 'summarize';
const FOLLOWUP_QUEUES = /* @__PURE__ */ new Map();
function getFollowupQueue(key, settings) {
  const existing = FOLLOWUP_QUEUES.get(key);
  if (existing) {
    existing.mode = settings.mode;
    existing.debounceMs = typeof settings.debounceMs === 'number' ? Math.max(0, settings.debounceMs) : existing.debounceMs;
    existing.cap = typeof settings.cap === 'number' && settings.cap > 0 ? Math.floor(settings.cap) : existing.cap;
    existing.dropPolicy = settings.dropPolicy ?? existing.dropPolicy;
    return existing;
  }
  const created = {
    items: [],
    draining: false,
    lastEnqueuedAt: 0,
    mode: settings.mode,
    debounceMs: typeof settings.debounceMs === 'number' ? Math.max(0, settings.debounceMs) : DEFAULT_QUEUE_DEBOUNCE_MS,
    cap: typeof settings.cap === 'number' && settings.cap > 0 ? Math.floor(settings.cap) : DEFAULT_QUEUE_CAP,
    dropPolicy: settings.dropPolicy ?? DEFAULT_QUEUE_DROP,
    droppedCount: 0,
    summaryLines: []
  };
  FOLLOWUP_QUEUES.set(key, created);
  return created;
}
function clearFollowupQueue(key) {
  const cleaned = key.trim();
  if (!cleaned) {
    return 0;
  }
  const queue = FOLLOWUP_QUEUES.get(cleaned);
  if (!queue) {
    return 0;
  }
  const cleared = queue.items.length + queue.droppedCount;
  queue.items.length = 0;
  queue.droppedCount = 0;
  queue.summaryLines = [];
  queue.lastRun = void 0;
  queue.lastEnqueuedAt = 0;
  FOLLOWUP_QUEUES.delete(cleaned);
  return cleared;
}
export {
  DEFAULT_QUEUE_CAP,
  DEFAULT_QUEUE_DEBOUNCE_MS,
  DEFAULT_QUEUE_DROP,
  FOLLOWUP_QUEUES,
  clearFollowupQueue,
  getFollowupQueue
};
