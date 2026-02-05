/**
 * Conversation history management for Pi embedded runner.
 * @module agents/pi-embedded-runner/history
 */
const THREAD_SUFFIX_REGEX = /^(.*)(?::(?:thread|topic):\d+)$/i;
function stripThreadSuffix(value) {
  const match = value.match(THREAD_SUFFIX_REGEX);
  return match?.[1] ?? value;
}
function limitHistoryTurns(messages, limit) {
  if (!limit || limit <= 0 || messages.length === 0) {
    return messages;
  }
  let userCount = 0;
  let lastUserIndex = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      userCount++;
      if (userCount > limit) {
        return messages.slice(lastUserIndex);
      }
      lastUserIndex = i;
    }
  }
  return messages;
}
function getDmHistoryLimitFromSessionKey(sessionKey, config) {
  if (!sessionKey || !config) {
    return void 0;
  }
  const parts = sessionKey.split(':').filter(Boolean);
  const providerParts = parts.length >= 3 && parts[0] === 'agent' ? parts.slice(2) : parts;
  const provider = providerParts[0]?.toLowerCase();
  if (!provider) {
    return void 0;
  }
  const kind = providerParts[1]?.toLowerCase();
  const userIdRaw = providerParts.slice(2).join(':');
  const userId = stripThreadSuffix(userIdRaw);
  if (kind !== 'dm') {
    return void 0;
  }
  const getLimit = (providerConfig) => {
    if (!providerConfig) {
      return void 0;
    }
    if (userId && providerConfig.dms?.[userId]?.historyLimit !== void 0) {
      return providerConfig.dms[userId].historyLimit;
    }
    return providerConfig.dmHistoryLimit;
  };
  const resolveProviderConfig = (cfg, providerId) => {
    const channels = cfg?.channels;
    if (!channels || typeof channels !== 'object') {
      return void 0;
    }
    const entry = channels[providerId];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return void 0;
    }
    return entry;
  };
  return getLimit(resolveProviderConfig(config, provider));
}
export {
  getDmHistoryLimitFromSessionKey,
  limitHistoryTurns
};
