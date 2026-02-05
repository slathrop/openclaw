import { getChannelDock } from '../../channels/dock.js';
import { normalizeChannelId } from '../../channels/plugins/index.js';
function resolveReplyToMode(cfg, channel, accountId, chatType) {
  const provider = normalizeChannelId(channel);
  if (!provider) {
    return 'all';
  }
  const resolved = getChannelDock(provider)?.threading?.resolveReplyToMode?.({
    cfg,
    accountId,
    chatType
  });
  return resolved ?? 'all';
}
function createReplyToModeFilter(mode, opts = {}) {
  let hasThreaded = false;
  return (payload) => {
    if (!payload.replyToId) {
      return payload;
    }
    if (mode === 'off') {
      if (opts.allowTagsWhenOff && payload.replyToTag) {
        return payload;
      }
      return { ...payload, replyToId: void 0 };
    }
    if (mode === 'all') {
      return payload;
    }
    if (hasThreaded) {
      return { ...payload, replyToId: void 0 };
    }
    hasThreaded = true;
    return payload;
  };
}
function createReplyToModeFilterForChannel(mode, channel) {
  const provider = normalizeChannelId(channel);
  const allowTagsWhenOff = provider ? Boolean(getChannelDock(provider)?.threading?.allowTagsWhenOff) : false;
  return createReplyToModeFilter(mode, {
    allowTagsWhenOff
  });
}
export {
  createReplyToModeFilter,
  createReplyToModeFilterForChannel,
  resolveReplyToMode
};
