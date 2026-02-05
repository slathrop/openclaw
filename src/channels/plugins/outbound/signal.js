import { chunkText } from '../../../auto-reply/chunk.js';
import { sendMessageSignal } from '../../../signal/send.js';
import { resolveChannelMediaMaxBytes } from '../media-limits.js';
const signalOutbound = {
  deliveryMode: 'direct',
  chunker: chunkText,
  chunkerMode: 'text',
  textChunkLimit: 4e3,
  sendText: async ({ cfg, to, text, accountId, deps }) => {
    const send = deps?.sendSignal ?? sendMessageSignal;
    const maxBytes = resolveChannelMediaMaxBytes({
      cfg,
      resolveChannelLimitMb: ({ cfg: cfg2, accountId: accountId2 }) => cfg2.channels?.signal?.accounts?.[accountId2]?.mediaMaxMb ?? cfg2.channels?.signal?.mediaMaxMb,
      accountId
    });
    const result = await send(to, text, {
      maxBytes,
      accountId: accountId ?? void 0
    });
    return { channel: 'signal', ...result };
  },
  sendMedia: async ({ cfg, to, text, mediaUrl, accountId, deps }) => {
    const send = deps?.sendSignal ?? sendMessageSignal;
    const maxBytes = resolveChannelMediaMaxBytes({
      cfg,
      resolveChannelLimitMb: ({ cfg: cfg2, accountId: accountId2 }) => cfg2.channels?.signal?.accounts?.[accountId2]?.mediaMaxMb ?? cfg2.channels?.signal?.mediaMaxMb,
      accountId
    });
    const result = await send(to, text, {
      mediaUrl,
      maxBytes,
      accountId: accountId ?? void 0
    });
    return { channel: 'signal', ...result };
  }
};
export {
  signalOutbound
};
