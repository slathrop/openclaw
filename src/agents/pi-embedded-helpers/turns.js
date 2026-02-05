/**
 * Conversation turn management for Pi embedded agents.
 * @param messages
 * @module agents/pi-embedded-helpers/turns
 */
function validateGeminiTurns(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return messages;
  }
  const result = [];
  let lastRole;
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') {
      result.push(msg);
      continue;
    }
    const msgRole = msg.role;
    if (!msgRole) {
      result.push(msg);
      continue;
    }
    if (msgRole === lastRole && lastRole === 'assistant') {
      const lastMsg = result[result.length - 1];
      const currentMsg = msg;
      if (lastMsg && typeof lastMsg === 'object') {
        const lastAsst = lastMsg;
        const mergedContent = [
          ...Array.isArray(lastAsst.content) ? lastAsst.content : [],
          ...Array.isArray(currentMsg.content) ? currentMsg.content : []
        ];
        const merged = {
          ...lastAsst,
          content: mergedContent,
          ...currentMsg.usage && { usage: currentMsg.usage },
          ...currentMsg.stopReason && { stopReason: currentMsg.stopReason },
          ...currentMsg.errorMessage && {
            errorMessage: currentMsg.errorMessage
          }
        };
        result[result.length - 1] = merged;
        continue;
      }
    }
    result.push(msg);
    lastRole = msgRole;
  }
  return result;
}
function mergeConsecutiveUserTurns(previous, current) {
  const mergedContent = [
    ...Array.isArray(previous.content) ? previous.content : [],
    ...Array.isArray(current.content) ? current.content : []
  ];
  return {
    ...current,
    content: mergedContent,
    timestamp: current.timestamp ?? previous.timestamp
  };
}
function validateAnthropicTurns(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return messages;
  }
  const result = [];
  let lastRole;
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') {
      result.push(msg);
      continue;
    }
    const msgRole = msg.role;
    if (!msgRole) {
      result.push(msg);
      continue;
    }
    if (msgRole === lastRole && lastRole === 'user') {
      const lastMsg = result[result.length - 1];
      const currentMsg = msg;
      if (lastMsg && typeof lastMsg === 'object') {
        const lastUser = lastMsg;
        const merged = mergeConsecutiveUserTurns(lastUser, currentMsg);
        result[result.length - 1] = merged;
        continue;
      }
    }
    result.push(msg);
    lastRole = msgRole;
  }
  return result;
}
export {
  mergeConsecutiveUserTurns,
  validateAnthropicTurns,
  validateGeminiTurns
};
