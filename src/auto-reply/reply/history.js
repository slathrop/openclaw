import { CURRENT_MESSAGE_MARKER } from './mentions.js';
const HISTORY_CONTEXT_MARKER = '[Chat messages since your last reply - for context]';
const DEFAULT_GROUP_HISTORY_LIMIT = 50;
const MAX_HISTORY_KEYS = 1e3;
function evictOldHistoryKeys(historyMap, maxKeys = MAX_HISTORY_KEYS) {
  if (historyMap.size <= maxKeys) {
    return;
  }
  const keysToDelete = historyMap.size - maxKeys;
  const iterator = historyMap.keys();
  for (let i = 0; i < keysToDelete; i++) {
    const key = iterator.next().value;
    if (key !== void 0) {
      historyMap.delete(key);
    }
  }
}
function buildHistoryContext(params) {
  const { historyText, currentMessage } = params;
  const lineBreak = params.lineBreak ?? '\n';
  if (!historyText.trim()) {
    return currentMessage;
  }
  return [HISTORY_CONTEXT_MARKER, historyText, '', CURRENT_MESSAGE_MARKER, currentMessage].join(
    lineBreak
  );
}
function appendHistoryEntry(params) {
  const { historyMap, historyKey, entry } = params;
  if (params.limit <= 0) {
    return [];
  }
  const history = historyMap.get(historyKey) ?? [];
  history.push(entry);
  while (history.length > params.limit) {
    history.shift();
  }
  if (historyMap.has(historyKey)) {
    historyMap.delete(historyKey);
  }
  historyMap.set(historyKey, history);
  evictOldHistoryKeys(historyMap);
  return history;
}
function recordPendingHistoryEntry(params) {
  return appendHistoryEntry(params);
}
function recordPendingHistoryEntryIfEnabled(params) {
  if (!params.entry) {
    return [];
  }
  if (params.limit <= 0) {
    return [];
  }
  return recordPendingHistoryEntry({
    historyMap: params.historyMap,
    historyKey: params.historyKey,
    entry: params.entry,
    limit: params.limit
  });
}
function buildPendingHistoryContextFromMap(params) {
  if (params.limit <= 0) {
    return params.currentMessage;
  }
  const entries = params.historyMap.get(params.historyKey) ?? [];
  return buildHistoryContextFromEntries({
    entries,
    currentMessage: params.currentMessage,
    formatEntry: params.formatEntry,
    lineBreak: params.lineBreak,
    excludeLast: false
  });
}
function buildHistoryContextFromMap(params) {
  if (params.limit <= 0) {
    return params.currentMessage;
  }
  const entries = params.entry ? appendHistoryEntry({
    historyMap: params.historyMap,
    historyKey: params.historyKey,
    entry: params.entry,
    limit: params.limit
  }) : params.historyMap.get(params.historyKey) ?? [];
  return buildHistoryContextFromEntries({
    entries,
    currentMessage: params.currentMessage,
    formatEntry: params.formatEntry,
    lineBreak: params.lineBreak,
    excludeLast: params.excludeLast
  });
}
function clearHistoryEntries(params) {
  params.historyMap.set(params.historyKey, []);
}
function clearHistoryEntriesIfEnabled(params) {
  if (params.limit <= 0) {
    return;
  }
  clearHistoryEntries({ historyMap: params.historyMap, historyKey: params.historyKey });
}
function buildHistoryContextFromEntries(params) {
  const lineBreak = params.lineBreak ?? '\n';
  const entries = params.excludeLast === false ? params.entries : params.entries.slice(0, -1);
  if (entries.length === 0) {
    return params.currentMessage;
  }
  const historyText = entries.map(params.formatEntry).join(lineBreak);
  return buildHistoryContext({
    historyText,
    currentMessage: params.currentMessage,
    lineBreak
  });
}
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  HISTORY_CONTEXT_MARKER,
  MAX_HISTORY_KEYS,
  appendHistoryEntry,
  buildHistoryContext,
  buildHistoryContextFromEntries,
  buildHistoryContextFromMap,
  buildPendingHistoryContextFromMap,
  clearHistoryEntries,
  clearHistoryEntriesIfEnabled,
  evictOldHistoryKeys,
  recordPendingHistoryEntry,
  recordPendingHistoryEntryIfEnabled
};
