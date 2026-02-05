import { chunkText } from '../../../auto-reply/chunk.js';
import { sendMessageIMessage } from '../../../imessage/send.js';
import { resolveChannelMediaMaxBytes } from '../media-limits.js';
const imessageOutbound = {
  deliveryMode: 'direct',
  chunker: chunkText,
  chunkerMode: 'text',
  textChunkLimit: 4e3,
  sendText: async ({ cfg, to, text, accountId, deps }) => {
    const send = deps?.sendIMessage ?? sendMessageIMessage;
    const maxBytes = resolveChannelMediaMaxBytes({
      cfg,
      resolveChannelLimitMb: ({ cfg: cfg2, accountId: accountId2 }) => cfg2.channels?.imessage?.accounts?.[accountId2]?.mediaMaxMb ?? cfg2.channels?.imessage?.mediaMaxMb,
      accountId
    });
    const result = await send(to, text, {
      maxBytes,
      accountId: accountId ?? void 0
    });
    return { channel: 'imessage', ...result };
  },
  sendMedia: async ({ cfg, to, text, mediaUrl, accountId, deps }) => {
    const send = deps?.sendIMessage ?? sendMessageIMessage;
    const maxBytes = resolveChannelMediaMaxBytes({
      cfg,
      resolveChannelLimitMb: ({ cfg: cfg2, accountId: accountId2 }) => cfg2.channels?.imessage?.accounts?.[accountId2]?.mediaMaxMb ?? cfg2.channels?.imessage?.mediaMaxMb,
      accountId
    });
    const result = await send(to, text, {
      mediaUrl,
      maxBytes,
      accountId: accountId ?? void 0
    });
    return { channel: 'imessage', ...result };
  }
};
export {
  imessageOutbound
};
