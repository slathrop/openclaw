const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { normalizeAccountId } from '../../utils/account-id.js';
import { resolveMessageChannel } from '../../utils/message-channel.js';
function resolveAgentRunContext(opts) {
  const merged = opts.runContext ? { ...opts.runContext } : {};
  const normalizedChannel = resolveMessageChannel(
    merged.messageChannel ?? opts.messageChannel,
    opts.replyChannel ?? opts.channel
  );
  if (normalizedChannel) {
    merged.messageChannel = normalizedChannel;
  }
  const normalizedAccountId = normalizeAccountId(merged.accountId ?? opts.accountId);
  if (normalizedAccountId) {
    merged.accountId = normalizedAccountId;
  }
  const groupId = (merged.groupId ?? opts.groupId)?.toString().trim();
  if (groupId) {
    merged.groupId = groupId;
  }
  const groupChannel = (merged.groupChannel ?? opts.groupChannel)?.toString().trim();
  if (groupChannel) {
    merged.groupChannel = groupChannel;
  }
  const groupSpace = (merged.groupSpace ?? opts.groupSpace)?.toString().trim();
  if (groupSpace) {
    merged.groupSpace = groupSpace;
  }
  if ((merged.currentThreadTs === null || merged.currentThreadTs === undefined) && opts.threadId !== null && opts.threadId !== undefined && opts.threadId !== '' && opts.threadId !== null) {
    merged.currentThreadTs = String(opts.threadId);
  }

  // Populate currentChannelId from the outbound target so that
  // resolveTelegramAutoThreadId can match the originating chat.
  if (!merged.currentChannelId && opts.to) {
    const trimmedTo = opts.to.trim();
    if (trimmedTo) {
      merged.currentChannelId = trimmedTo;
    }
  }

  return merged;
}
__name(resolveAgentRunContext, 'resolveAgentRunContext');
export {
  resolveAgentRunContext
};
