const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { danger } from '../../../globals.js';
import { enqueueSystemEvent } from '../../../infra/system-events.js';
import { resolveSlackChannelLabel } from '../channel-config.js';
function registerSlackReactionEvents(params) {
  const { ctx } = params;
  const handleReactionEvent = /* @__PURE__ */ __name(async (event, action) => {
    try {
      const item = event.item;
      if (!item || item.type !== 'message') {
        return;
      }
      const channelInfo = item.channel ? await ctx.resolveChannelName(item.channel) : {};
      const channelType = channelInfo?.type;
      if (!ctx.isChannelAllowed({
        channelId: item.channel,
        channelName: channelInfo?.name,
        channelType
      })) {
        return;
      }
      const channelLabel = resolveSlackChannelLabel({
        channelId: item.channel,
        channelName: channelInfo?.name
      });
      const actorInfo = event.user ? await ctx.resolveUserName(event.user) : void 0;
      const actorLabel = actorInfo?.name ?? event.user;
      const emojiLabel = event.reaction ?? 'emoji';
      const authorInfo = event.item_user ? await ctx.resolveUserName(event.item_user) : void 0;
      const authorLabel = authorInfo?.name ?? event.item_user;
      const baseText = `Slack reaction ${action}: :${emojiLabel}: by ${actorLabel} in ${channelLabel} msg ${item.ts}`;
      const text = authorLabel ? `${baseText} from ${authorLabel}` : baseText;
      const sessionKey = ctx.resolveSlackSystemEventSessionKey({
        channelId: item.channel,
        channelType
      });
      enqueueSystemEvent(text, {
        sessionKey,
        contextKey: `slack:reaction:${action}:${item.channel}:${item.ts}:${event.user}:${emojiLabel}`
      });
    } catch (err) {
      ctx.runtime.error?.(danger(`slack reaction handler failed: ${String(err)}`));
    }
  }, 'handleReactionEvent');
  ctx.app.event(
    'reaction_added',
    async ({ event, body }) => {
      if (ctx.shouldDropMismatchedSlackEvent(body)) {
        return;
      }
      await handleReactionEvent(event, 'added');
    }
  );
  ctx.app.event(
    'reaction_removed',
    async ({ event, body }) => {
      if (ctx.shouldDropMismatchedSlackEvent(body)) {
        return;
      }
      await handleReactionEvent(event, 'removed');
    }
  );
}
__name(registerSlackReactionEvents, 'registerSlackReactionEvents');
export {
  registerSlackReactionEvents
};
