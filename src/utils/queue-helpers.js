/**
 * Queue management helpers for message processing pipelines.
 *
 * Provides drop policies (summarize, old, new), deduplication,
 * debounce, and prompt generation for queue overflow scenarios.
 */

/**
 * @typedef {object} QueueSummaryState
 * @property {'summarize' | 'old' | 'new'} dropPolicy
 * @property {number} droppedCount
 * @property {string[]} summaryLines
 */

/**
 * @typedef {'summarize' | 'old' | 'new'} QueueDropPolicy
 */

/**
 * Elides text to fit within a character limit, adding an ellipsis.
 * @param {string} text
 * @param {number} [limit]
 * @returns {string}
 */
export function elideQueueText(text, limit = 140) {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}\u2026`;
}

/**
 * Builds a single summary line from raw text, collapsing whitespace.
 * @param {string} text
 * @param {number} [limit]
 * @returns {string}
 */
export function buildQueueSummaryLine(text, limit = 160) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return elideQueueText(cleaned, limit);
}

/**
 * Returns true if the item should be skipped based on the dedupe function.
 * @template T
 * @param {object} params
 * @param {T} params.item
 * @param {T[]} params.items
 * @param {(item: T, items: T[]) => boolean} [params.dedupe]
 * @returns {boolean}
 */
export function shouldSkipQueueItem(params) {
  if (!params.dedupe) {
    return false;
  }
  return params.dedupe(params.item, params.items);
}

/**
 * Applies the queue drop policy, removing excess items and optionally summarizing.
 * @template T
 * @param {object} params
 * @param {{items: T[], cap: number, dropPolicy: string, droppedCount: number, summaryLines: string[]}} params.queue
 * @param {(item: T) => string} params.summarize
 * @param {number} [params.summaryLimit]
 * @returns {boolean} Whether the item was accepted.
 */
export function applyQueueDropPolicy(params) {
  const cap = params.queue.cap;
  if (cap <= 0 || params.queue.items.length < cap) {
    return true;
  }
  if (params.queue.dropPolicy === 'new') {
    return false;
  }
  const dropCount = params.queue.items.length - cap + 1;
  const dropped = params.queue.items.splice(0, dropCount);
  if (params.queue.dropPolicy === 'summarize') {
    for (const item of dropped) {
      params.queue.droppedCount += 1;
      params.queue.summaryLines.push(buildQueueSummaryLine(params.summarize(item)));
    }
    const limit = Math.max(0, params.summaryLimit ?? cap);
    while (params.queue.summaryLines.length > limit) {
      params.queue.summaryLines.shift();
    }
  }
  return true;
}

/**
 * Waits for the queue debounce period to elapse since the last enqueue.
 * @param {{debounceMs: number, lastEnqueuedAt: number}} queue
 * @returns {Promise<void>}
 */
export function waitForQueueDebounce(queue) {
  const debounceMs = Math.max(0, queue.debounceMs);
  if (debounceMs <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const check = () => {
      const since = Date.now() - queue.lastEnqueuedAt;
      if (since >= debounceMs) {
        resolve();
        return;
      }
      setTimeout(check, debounceMs - since);
    };
    check();
  });
}

/**
 * Builds a prompt summarizing dropped queue items.
 * @param {object} params
 * @param {QueueSummaryState} params.state
 * @param {string} params.noun
 * @param {string} [params.title]
 * @returns {string | undefined}
 */
export function buildQueueSummaryPrompt(params) {
  if (params.state.dropPolicy !== 'summarize' || params.state.droppedCount <= 0) {
    return undefined;
  }
  const noun = params.noun;
  const title =
    params.title ??
    `[Queue overflow] Dropped ${params.state.droppedCount} ${noun}${params.state.droppedCount === 1 ? '' : 's'} due to cap.`;
  const lines = [title];
  if (params.state.summaryLines.length > 0) {
    lines.push('Summary:');
    for (const line of params.state.summaryLines) {
      lines.push(`- ${line}`);
    }
  }
  params.state.droppedCount = 0;
  params.state.summaryLines = [];
  return lines.join('\n');
}

/**
 * Builds a collected prompt from a list of items with an optional summary.
 * @template T
 * @param {object} params
 * @param {string} params.title
 * @param {T[]} params.items
 * @param {string} [params.summary]
 * @param {(item: T, index: number) => string} params.renderItem
 * @returns {string}
 */
export function buildCollectPrompt(params) {
  const blocks = [params.title];
  if (params.summary) {
    blocks.push(params.summary);
  }
  params.items.forEach((item, idx) => {
    blocks.push(params.renderItem(item, idx));
  });
  return blocks.join('\n\n');
}

/**
 * Returns true if items span multiple delivery channels.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => {key?: string, cross?: boolean}} resolveKey
 * @returns {boolean}
 */
export function hasCrossChannelItems(items, resolveKey) {
  const keys = new Set();
  let hasUnkeyed = false;

  for (const item of items) {
    const resolved = resolveKey(item);
    if (resolved.cross) {
      return true;
    }
    if (!resolved.key) {
      hasUnkeyed = true;
      continue;
    }
    keys.add(resolved.key);
  }

  if (keys.size === 0) {
    return false;
  }
  if (hasUnkeyed) {
    return true;
  }
  return keys.size > 1;
}
