import { sendMessageMatrix, sendPollMatrix } from './matrix/send.js';
import { getMatrixRuntime } from './runtime.js';
const matrixOutbound = {
  deliveryMode: 'direct',
  chunker: (text, limit) => getMatrixRuntime().channel.text.chunkMarkdownText(text, limit),
  chunkerMode: 'markdown',
  textChunkLimit: 4e3,
  sendText: async ({ to, text, deps, replyToId, threadId }) => {
    const send = deps?.sendMatrix ?? sendMessageMatrix;
    const resolvedThreadId = threadId !== void 0 && threadId !== null ? String(threadId) : void 0;
    const result = await send(to, text, {
      replyToId: replyToId ?? void 0,
      threadId: resolvedThreadId
    });
    return {
      channel: 'matrix',
      messageId: result.messageId,
      roomId: result.roomId
    };
  },
  sendMedia: async ({ to, text, mediaUrl, deps, replyToId, threadId }) => {
    const send = deps?.sendMatrix ?? sendMessageMatrix;
    const resolvedThreadId = threadId !== void 0 && threadId !== null ? String(threadId) : void 0;
    const result = await send(to, text, {
      mediaUrl,
      replyToId: replyToId ?? void 0,
      threadId: resolvedThreadId
    });
    return {
      channel: 'matrix',
      messageId: result.messageId,
      roomId: result.roomId
    };
  },
  sendPoll: async ({ to, poll, threadId }) => {
    const resolvedThreadId = threadId !== void 0 && threadId !== null ? String(threadId) : void 0;
    const result = await sendPollMatrix(to, poll, {
      threadId: resolvedThreadId
    });
    return {
      channel: 'matrix',
      messageId: result.eventId,
      roomId: result.roomId,
      pollId: result.eventId
    };
  }
};
export {
  matrixOutbound
};
