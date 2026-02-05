/** @module gateway/server-constants -- Gateway server constants (timeouts, limits, defaults). */
const MAX_PAYLOAD_BYTES = 512 * 1024;
const MAX_BUFFERED_BYTES = 1.5 * 1024 * 1024;
const DEFAULT_MAX_CHAT_HISTORY_MESSAGES_BYTES = 6 * 1024 * 1024;
let maxChatHistoryMessagesBytes = DEFAULT_MAX_CHAT_HISTORY_MESSAGES_BYTES;
const getMaxChatHistoryMessagesBytes = () => maxChatHistoryMessagesBytes;
const __setMaxChatHistoryMessagesBytesForTest = (value) => {
  if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
    return;
  }
  if (value === void 0) {
    maxChatHistoryMessagesBytes = DEFAULT_MAX_CHAT_HISTORY_MESSAGES_BYTES;
    return;
  }
  if (Number.isFinite(value) && value > 0) {
    maxChatHistoryMessagesBytes = value;
  }
};
const DEFAULT_HANDSHAKE_TIMEOUT_MS = 1e4;
const getHandshakeTimeoutMs = () => {
  if (process.env.VITEST && process.env.OPENCLAW_TEST_HANDSHAKE_TIMEOUT_MS) {
    const parsed = Number(process.env.OPENCLAW_TEST_HANDSHAKE_TIMEOUT_MS);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_HANDSHAKE_TIMEOUT_MS;
};
const TICK_INTERVAL_MS = 3e4;
const HEALTH_REFRESH_INTERVAL_MS = 6e4;
const DEDUPE_TTL_MS = 5 * 6e4;
const DEDUPE_MAX = 1e3;
export {
  DEDUPE_MAX,
  DEDUPE_TTL_MS,
  DEFAULT_HANDSHAKE_TIMEOUT_MS,
  HEALTH_REFRESH_INTERVAL_MS,
  MAX_BUFFERED_BYTES,
  MAX_PAYLOAD_BYTES,
  TICK_INTERVAL_MS,
  __setMaxChatHistoryMessagesBytesForTest,
  getHandshakeTimeoutMs,
  getMaxChatHistoryMessagesBytes
};
