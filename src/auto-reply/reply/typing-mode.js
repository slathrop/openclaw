import { isSilentReplyText, SILENT_REPLY_TOKEN } from '../tokens.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

const DEFAULT_GROUP_TYPING_MODE = 'message';
function resolveTypingMode({
  configured,
  isGroupChat,
  wasMentioned,
  isHeartbeat
}) {
  if (isHeartbeat) {
    return 'never';
  }
  if (configured) {
    return configured;
  }
  if (!isGroupChat || wasMentioned) {
    return 'instant';
  }
  return DEFAULT_GROUP_TYPING_MODE;
}
function createTypingSignaler(params) {
  const { typing, mode, isHeartbeat } = params;
  const shouldStartImmediately = mode === 'instant';
  const shouldStartOnMessageStart = mode === 'message';
  const shouldStartOnText = mode === 'message' || mode === 'instant';
  const shouldStartOnReasoning = mode === 'thinking';
  const disabled = isHeartbeat || mode === 'never';
  let hasRenderableText = false;
  const isRenderableText = (text) => {
    const trimmed = text?.trim();
    if (!trimmed) {
      return false;
    }
    return !isSilentReplyText(trimmed, SILENT_REPLY_TOKEN);
  };
  const signalRunStart = async () => {
    if (disabled || !shouldStartImmediately) {
      return;
    }
    await typing.startTypingLoop();
  };
  const signalMessageStart = async () => {
    if (disabled || !shouldStartOnMessageStart) {
      return;
    }
    if (!hasRenderableText) {
      return;
    }
    await typing.startTypingLoop();
  };
  const signalTextDelta = async (text) => {
    if (disabled) {
      return;
    }
    const renderable = isRenderableText(text);
    if (renderable) {
      hasRenderableText = true;
    } else if (text?.trim()) {
      return;
    }
    if (shouldStartOnText) {
      await typing.startTypingOnText(text);
      return;
    }
    if (shouldStartOnReasoning) {
      if (!typing.isActive()) {
        await typing.startTypingLoop();
      }
      typing.refreshTypingTtl();
    }
  };
  const signalReasoningDelta = async () => {
    if (disabled || !shouldStartOnReasoning) {
      return;
    }
    if (!hasRenderableText) {
      return;
    }
    await typing.startTypingLoop();
    typing.refreshTypingTtl();
  };
  const signalToolStart = async () => {
    if (disabled) {
      return;
    }
    if (!typing.isActive()) {
      await typing.startTypingLoop();
      typing.refreshTypingTtl();
      return;
    }
    typing.refreshTypingTtl();
  };
  return {
    mode,
    shouldStartImmediately,
    shouldStartOnMessageStart,
    shouldStartOnText,
    shouldStartOnReasoning,
    signalRunStart,
    signalMessageStart,
    signalTextDelta,
    signalReasoningDelta,
    signalToolStart
  };
}
export {
  DEFAULT_GROUP_TYPING_MODE,
  createTypingSignaler,
  resolveTypingMode
};
