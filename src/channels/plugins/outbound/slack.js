import { sendMessageSlack } from '../../../slack/send.js';
const slackOutbound = {
  deliveryMode: 'direct',
  chunker: null,
  textChunkLimit: 4e3,
  sendText: async ({ to, text, accountId, deps, replyToId, threadId }) => {
    const send = deps?.sendSlack ?? sendMessageSlack;
    const threadTs = replyToId ?? (threadId !== null && threadId !== undefined ? String(threadId) : void 0);
    const result = await send(to, text, {
      threadTs,
      accountId: accountId ?? void 0
    });
    return { channel: 'slack', ...result };
  },
  sendMedia: async ({ to, text, mediaUrl, accountId, deps, replyToId, threadId }) => {
    const send = deps?.sendSlack ?? sendMessageSlack;
    const threadTs = replyToId ?? (threadId !== null && threadId !== undefined ? String(threadId) : void 0);
    const result = await send(to, text, {
      mediaUrl,
      threadTs,
      accountId: accountId ?? void 0
    });
    return { channel: 'slack', ...result };
  }
};
export {
  slackOutbound
};
