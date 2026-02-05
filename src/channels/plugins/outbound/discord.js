import { sendMessageDiscord, sendPollDiscord } from '../../../discord/send.js';
const discordOutbound = {
  deliveryMode: 'direct',
  chunker: null,
  textChunkLimit: 2e3,
  pollMaxOptions: 10,
  sendText: async ({ to, text, accountId, deps, replyToId }) => {
    const send = deps?.sendDiscord ?? sendMessageDiscord;
    const result = await send(to, text, {
      verbose: false,
      replyTo: replyToId ?? void 0,
      accountId: accountId ?? void 0
    });
    return { channel: 'discord', ...result };
  },
  sendMedia: async ({ to, text, mediaUrl, accountId, deps, replyToId }) => {
    const send = deps?.sendDiscord ?? sendMessageDiscord;
    const result = await send(to, text, {
      verbose: false,
      mediaUrl,
      replyTo: replyToId ?? void 0,
      accountId: accountId ?? void 0
    });
    return { channel: 'discord', ...result };
  },
  sendPoll: async ({ to, poll, accountId }) => await sendPollDiscord(to, poll, {
    accountId: accountId ?? void 0
  })
};
export {
  discordOutbound
};
