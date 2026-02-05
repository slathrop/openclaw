import { resolveSlackAccount, resolveSlackReplyToMode } from './accounts.js';
function buildSlackThreadingToolContext(params) {
  const account = resolveSlackAccount({
    cfg: params.cfg,
    accountId: params.accountId
  });
  const configuredReplyToMode = resolveSlackReplyToMode(account, params.context.ChatType);
  const effectiveReplyToMode = params.context.ThreadLabel ? 'all' : configuredReplyToMode;
  const threadId = params.context.MessageThreadId ?? params.context.ReplyToId;
  return {
    currentChannelId: params.context.To?.startsWith('channel:') ? params.context.To.slice('channel:'.length) : void 0,
    currentThreadTs: threadId !== null && threadId !== undefined ? String(threadId) : void 0,
    replyToMode: effectiveReplyToMode,
    hasRepliedRef: params.hasRepliedRef
  };
}
export {
  buildSlackThreadingToolContext
};
