const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { resolveHumanDelayConfig } from '../../../agents/identity.js';
import { dispatchInboundMessage } from '../../../auto-reply/dispatch.js';
import { clearHistoryEntriesIfEnabled } from '../../../auto-reply/reply/history.js';
import { createReplyDispatcherWithTyping } from '../../../auto-reply/reply/reply-dispatcher.js';
import { removeAckReactionAfterReply } from '../../../channels/ack-reactions.js';
import { logAckFailure, logTypingFailure } from '../../../channels/logging.js';
import { createReplyPrefixOptions } from '../../../channels/reply-prefix.js';
import { createTypingCallbacks } from '../../../channels/typing.js';
import { resolveStorePath, updateLastRoute } from '../../../config/sessions.js';
import { danger, logVerbose, shouldLogVerbose } from '../../../globals.js';
import { removeSlackReaction } from '../../actions.js';
import { resolveSlackThreadTargets } from '../../threading.js';
import { createSlackReplyDeliveryPlan, deliverReplies } from '../replies.js';
async function dispatchPreparedSlackMessage(prepared) {
  const { ctx, account, message, route } = prepared;
  const cfg = ctx.cfg;
  const runtime = ctx.runtime;
  if (prepared.isDirectMessage) {
    const sessionCfg = cfg.session;
    const storePath = resolveStorePath(sessionCfg?.store, {
      agentId: route.agentId
    });
    await updateLastRoute({
      storePath,
      sessionKey: route.mainSessionKey,
      deliveryContext: {
        channel: 'slack',
        to: `user:${message.user}`,
        accountId: route.accountId
      },
      ctx: prepared.ctxPayload
    });
  }
  const { statusThreadTs } = resolveSlackThreadTargets({
    message,
    replyToMode: ctx.replyToMode
  });
  const messageTs = message.ts ?? message.event_ts;
  const incomingThreadTs = message.thread_ts;
  let didSetStatus = false;
  const hasRepliedRef = { value: false };
  const replyPlan = createSlackReplyDeliveryPlan({
    replyToMode: ctx.replyToMode,
    incomingThreadTs,
    messageTs,
    hasRepliedRef
  });
  const typingTarget = statusThreadTs ? `${message.channel}/${statusThreadTs}` : message.channel;
  const typingCallbacks = createTypingCallbacks({
    start: /* @__PURE__ */ __name(async () => {
      didSetStatus = true;
      await ctx.setSlackThreadStatus({
        channelId: message.channel,
        threadTs: statusThreadTs,
        status: 'is typing...'
      });
    }, 'start'),
    stop: /* @__PURE__ */ __name(async () => {
      if (!didSetStatus) {
        return;
      }
      didSetStatus = false;
      await ctx.setSlackThreadStatus({
        channelId: message.channel,
        threadTs: statusThreadTs,
        status: ''
      });
    }, 'stop'),
    onStartError: /* @__PURE__ */ __name((err) => {
      logTypingFailure({
        log: /* @__PURE__ */ __name((message2) => runtime.error?.(danger(message2)), 'log'),
        channel: 'slack',
        action: 'start',
        target: typingTarget,
        error: err
      });
    }, 'onStartError'),
    onStopError: /* @__PURE__ */ __name((err) => {
      logTypingFailure({
        log: /* @__PURE__ */ __name((message2) => runtime.error?.(danger(message2)), 'log'),
        channel: 'slack',
        action: 'stop',
        target: typingTarget,
        error: err
      });
    }, 'onStopError')
  });
  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg,
    agentId: route.agentId,
    channel: 'slack',
    accountId: route.accountId
  });
  const { dispatcher, replyOptions, markDispatchIdle } = createReplyDispatcherWithTyping({
    ...prefixOptions,
    humanDelay: resolveHumanDelayConfig(cfg, route.agentId),
    deliver: /* @__PURE__ */ __name(async (payload) => {
      const replyThreadTs = replyPlan.nextThreadTs();
      await deliverReplies({
        replies: [payload],
        target: prepared.replyTarget,
        token: ctx.botToken,
        accountId: account.accountId,
        runtime,
        textLimit: ctx.textLimit,
        replyThreadTs
      });
      replyPlan.markSent();
    }, 'deliver'),
    onError: /* @__PURE__ */ __name((err, info) => {
      runtime.error?.(danger(`slack ${info.kind} reply failed: ${String(err)}`));
      typingCallbacks.onIdle?.();
    }, 'onError'),
    onReplyStart: typingCallbacks.onReplyStart,
    onIdle: typingCallbacks.onIdle
  });
  const { queuedFinal, counts } = await dispatchInboundMessage({
    ctx: prepared.ctxPayload,
    cfg,
    dispatcher,
    replyOptions: {
      ...replyOptions,
      skillFilter: prepared.channelConfig?.skills,
      hasRepliedRef,
      disableBlockStreaming: typeof account.config.blockStreaming === 'boolean' ? !account.config.blockStreaming : void 0,
      onModelSelected
    }
  });
  markDispatchIdle();
  const anyReplyDelivered = queuedFinal || (counts.block ?? 0) > 0 || (counts.final ?? 0) > 0;
  if (!anyReplyDelivered) {
    if (prepared.isRoomish) {
      clearHistoryEntriesIfEnabled({
        historyMap: ctx.channelHistories,
        historyKey: prepared.historyKey,
        limit: ctx.historyLimit
      });
    }
    return;
  }
  if (shouldLogVerbose()) {
    const finalCount = counts.final;
    logVerbose(
      `slack: delivered ${finalCount} reply${finalCount === 1 ? '' : 'ies'} to ${prepared.replyTarget}`
    );
  }
  removeAckReactionAfterReply({
    removeAfterReply: ctx.removeAckAfterReply,
    ackReactionPromise: prepared.ackReactionPromise,
    ackReactionValue: prepared.ackReactionValue,
    remove: /* @__PURE__ */ __name(() => removeSlackReaction(
      message.channel,
      prepared.ackReactionMessageTs ?? '',
      prepared.ackReactionValue,
      {
        token: ctx.botToken,
        client: ctx.app.client
      }
    ), 'remove'),
    onError: /* @__PURE__ */ __name((err) => {
      logAckFailure({
        log: logVerbose,
        channel: 'slack',
        target: `${message.channel}/${message.ts}`,
        error: err
      });
    }, 'onError')
  });
  if (prepared.isRoomish) {
    clearHistoryEntriesIfEnabled({
      historyMap: ctx.channelHistories,
      historyKey: prepared.historyKey,
      limit: ctx.historyLimit
    });
  }
}
__name(dispatchPreparedSlackMessage, 'dispatchPreparedSlackMessage');
export {
  dispatchPreparedSlackMessage
};
