const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { hasControlCommand } from '../../auto-reply/command-detection.js';
import {
  createInboundDebouncer,
  resolveInboundDebounceMs
} from '../../auto-reply/inbound-debounce.js';
import { dispatchPreparedSlackMessage } from './message-handler/dispatch.js';
import { prepareSlackMessage } from './message-handler/prepare.js';
import { createSlackThreadTsResolver } from './thread-resolution.js';
function createSlackMessageHandler(params) {
  const { ctx, account } = params;
  const debounceMs = resolveInboundDebounceMs({ cfg: ctx.cfg, channel: 'slack' });
  const threadTsResolver = createSlackThreadTsResolver({ client: ctx.app.client });
  const debouncer = createInboundDebouncer({
    debounceMs,
    buildKey: /* @__PURE__ */ __name((entry) => {
      const senderId = entry.message.user ?? entry.message.bot_id;
      if (!senderId) {
        return null;
      }
      const messageTs = entry.message.ts ?? entry.message.event_ts;
      const threadKey = entry.message.thread_ts ? `${entry.message.channel}:${entry.message.thread_ts}` : entry.message.parent_user_id && messageTs ? `${entry.message.channel}:maybe-thread:${messageTs}` : entry.message.channel;
      return `slack:${ctx.accountId}:${threadKey}:${senderId}`;
    }, 'buildKey'),
    shouldDebounce: /* @__PURE__ */ __name((entry) => {
      const text = entry.message.text ?? '';
      if (!text.trim()) {
        return false;
      }
      if (entry.message.files && entry.message.files.length > 0) {
        return false;
      }
      return !hasControlCommand(text, ctx.cfg);
    }, 'shouldDebounce'),
    onFlush: /* @__PURE__ */ __name(async (entries) => {
      const last = entries.at(-1);
      if (!last) {
        return;
      }
      const combinedText = entries.length === 1 ? last.message.text ?? '' : entries.map((entry) => entry.message.text ?? '').filter(Boolean).join('\n');
      const combinedMentioned = entries.some((entry) => Boolean(entry.opts.wasMentioned));
      const syntheticMessage = {
        ...last.message,
        text: combinedText
      };
      const prepared = await prepareSlackMessage({
        ctx,
        account,
        message: syntheticMessage,
        opts: {
          ...last.opts,
          wasMentioned: combinedMentioned || last.opts.wasMentioned
        }
      });
      if (!prepared) {
        return;
      }
      if (entries.length > 1) {
        const ids = entries.map((entry) => entry.message.ts).filter(Boolean);
        if (ids.length > 0) {
          prepared.ctxPayload.MessageSids = ids;
          prepared.ctxPayload.MessageSidFirst = ids[0];
          prepared.ctxPayload.MessageSidLast = ids[ids.length - 1];
        }
      }
      await dispatchPreparedSlackMessage(prepared);
    }, 'onFlush'),
    onError: /* @__PURE__ */ __name((err) => {
      ctx.runtime.error?.(`slack inbound debounce flush failed: ${String(err)}`);
    }, 'onError')
  });
  return async (message, opts) => {
    if (opts.source === 'message' && message.type !== 'message') {
      return;
    }
    if (opts.source === 'message' && message.subtype && message.subtype !== 'file_share' && message.subtype !== 'bot_message') {
      return;
    }
    if (ctx.markMessageSeen(message.channel, message.ts)) {
      return;
    }
    const resolvedMessage = await threadTsResolver.resolve({ message, source: opts.source });
    await debouncer.enqueue({ message: resolvedMessage, opts });
  };
}
__name(createSlackMessageHandler, 'createSlackMessageHandler');
export {
  createSlackMessageHandler
};
