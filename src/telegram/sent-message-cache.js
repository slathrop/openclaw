const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
const TTL_MS = 24 * 60 * 60 * 1e3;
const sentMessages = /* @__PURE__ */ new Map();
function getChatKey(chatId) {
  return String(chatId);
}
__name(getChatKey, 'getChatKey');
function cleanupExpired(entry) {
  const now = Date.now();
  for (const [msgId, timestamp] of entry.timestamps) {
    if (now - timestamp > TTL_MS) {
      entry.messageIds.delete(msgId);
      entry.timestamps.delete(msgId);
    }
  }
}
__name(cleanupExpired, 'cleanupExpired');
function recordSentMessage(chatId, messageId) {
  const key = getChatKey(chatId);
  let entry = sentMessages.get(key);
  if (!entry) {
    entry = { messageIds: /* @__PURE__ */ new Set(), timestamps: /* @__PURE__ */ new Map() };
    sentMessages.set(key, entry);
  }
  entry.messageIds.add(messageId);
  entry.timestamps.set(messageId, Date.now());
  if (entry.messageIds.size > 100) {
    cleanupExpired(entry);
  }
}
__name(recordSentMessage, 'recordSentMessage');
function wasSentByBot(chatId, messageId) {
  const key = getChatKey(chatId);
  const entry = sentMessages.get(key);
  if (!entry) {
    return false;
  }
  cleanupExpired(entry);
  return entry.messageIds.has(messageId);
}
__name(wasSentByBot, 'wasSentByBot');
function clearSentMessageCache() {
  sentMessages.clear();
}
__name(clearSentMessageCache, 'clearSentMessageCache');
export {
  clearSentMessageCache,
  recordSentMessage,
  wasSentByBot
};
