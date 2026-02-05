const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { AGENT_LANE_NESTED } from '../../agents/lanes.js';
import { getChannelPlugin, normalizeChannelId } from '../../channels/plugins/index.js';
import { createOutboundSendDeps } from '../../cli/outbound-send-deps.js';
import {
  resolveAgentDeliveryPlan,
  resolveAgentOutboundTarget
} from '../../infra/outbound/agent-delivery.js';
import { deliverOutboundPayloads } from '../../infra/outbound/deliver.js';
import { buildOutboundResultEnvelope } from '../../infra/outbound/envelope.js';
import {
  formatOutboundPayloadLog,
  normalizeOutboundPayloads,
  normalizeOutboundPayloadsForJson
} from '../../infra/outbound/payloads.js';
import { isInternalMessageChannel } from '../../utils/message-channel.js';
const NESTED_LOG_PREFIX = '[agent:nested]';
function formatNestedLogPrefix(opts) {
  const parts = [NESTED_LOG_PREFIX];
  const session = opts.sessionKey ?? opts.sessionId;
  if (session) {
    parts.push(`session=${session}`);
  }
  if (opts.runId) {
    parts.push(`run=${opts.runId}`);
  }
  const channel = opts.messageChannel ?? opts.channel;
  if (channel) {
    parts.push(`channel=${channel}`);
  }
  if (opts.to) {
    parts.push(`to=${opts.to}`);
  }
  if (opts.accountId) {
    parts.push(`account=${opts.accountId}`);
  }
  return parts.join(' ');
}
__name(formatNestedLogPrefix, 'formatNestedLogPrefix');
function logNestedOutput(runtime, opts, output) {
  const prefix = formatNestedLogPrefix(opts);
  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      continue;
    }
    runtime.log(`${prefix} ${line}`);
  }
}
__name(logNestedOutput, 'logNestedOutput');
async function deliverAgentCommandResult(params) {
  const { cfg, deps, runtime, opts, sessionEntry, payloads, result } = params;
  const deliver = opts.deliver === true;
  const bestEffortDeliver = opts.bestEffortDeliver === true;
  const deliveryPlan = resolveAgentDeliveryPlan({
    sessionEntry,
    requestedChannel: opts.replyChannel ?? opts.channel,
    explicitTo: opts.replyTo ?? opts.to,
    explicitThreadId: opts.threadId,
    accountId: opts.replyAccountId ?? opts.accountId,
    wantsDelivery: deliver
  });
  const deliveryChannel = deliveryPlan.resolvedChannel;
  const deliveryPlugin = !isInternalMessageChannel(deliveryChannel) ? getChannelPlugin(normalizeChannelId(deliveryChannel) ?? deliveryChannel) : void 0;
  const isDeliveryChannelKnown = isInternalMessageChannel(deliveryChannel) || Boolean(deliveryPlugin);
  const targetMode = opts.deliveryTargetMode ?? deliveryPlan.deliveryTargetMode ?? (opts.to ? 'explicit' : 'implicit');
  const resolvedAccountId = deliveryPlan.resolvedAccountId;
  const resolved = deliver && isDeliveryChannelKnown && deliveryChannel ? resolveAgentOutboundTarget({
    cfg,
    plan: deliveryPlan,
    targetMode,
    validateExplicitTarget: true
  }) : {
    resolvedTarget: null,
    resolvedTo: deliveryPlan.resolvedTo,
    targetMode
  };
  const resolvedTarget = resolved.resolvedTarget;
  const deliveryTarget = resolved.resolvedTo;
  const resolvedThreadId = deliveryPlan.resolvedThreadId ?? opts.threadId;
  const resolvedReplyToId = deliveryChannel === 'slack' && resolvedThreadId !== null && resolvedThreadId !== undefined ? String(resolvedThreadId) : void 0;
  const resolvedThreadTarget = deliveryChannel === 'slack' ? void 0 : resolvedThreadId;
  const logDeliveryError = /* @__PURE__ */ __name((err) => {
    const message = `Delivery failed (${deliveryChannel}${deliveryTarget ? ` to ${deliveryTarget}` : ''}): ${String(err)}`;
    runtime.error?.(message);
    if (!runtime.error) {
      runtime.log(message);
    }
  }, 'logDeliveryError');
  if (deliver) {
    if (!isDeliveryChannelKnown) {
      const err = new Error(`Unknown channel: ${deliveryChannel}`);
      if (!bestEffortDeliver) {
        throw err;
      }
      logDeliveryError(err);
    } else if (resolvedTarget && !resolvedTarget.ok) {
      if (!bestEffortDeliver) {
        throw resolvedTarget.error;
      }
      logDeliveryError(resolvedTarget.error);
    }
  }
  const normalizedPayloads = normalizeOutboundPayloadsForJson(payloads ?? []);
  if (opts.json) {
    runtime.log(
      JSON.stringify(
        buildOutboundResultEnvelope({
          payloads: normalizedPayloads,
          meta: result.meta
        }),
        null,
        2
      )
    );
    if (!deliver) {
      return { payloads: normalizedPayloads, meta: result.meta };
    }
  }
  if (!payloads || payloads.length === 0) {
    runtime.log('No reply from agent.');
    return { payloads: [], meta: result.meta };
  }
  const deliveryPayloads = normalizeOutboundPayloads(payloads);
  const logPayload = /* @__PURE__ */ __name((payload) => {
    if (opts.json) {
      return;
    }
    const output = formatOutboundPayloadLog(payload);
    if (!output) {
      return;
    }
    if (opts.lane === AGENT_LANE_NESTED) {
      logNestedOutput(runtime, opts, output);
      return;
    }
    runtime.log(output);
  }, 'logPayload');
  if (!deliver) {
    for (const payload of deliveryPayloads) {
      logPayload(payload);
    }
  }
  if (deliver && deliveryChannel && !isInternalMessageChannel(deliveryChannel)) {
    if (deliveryTarget) {
      await deliverOutboundPayloads({
        cfg,
        channel: deliveryChannel,
        to: deliveryTarget,
        accountId: resolvedAccountId,
        payloads: deliveryPayloads,
        replyToId: resolvedReplyToId ?? null,
        threadId: resolvedThreadTarget ?? null,
        bestEffort: bestEffortDeliver,
        onError: /* @__PURE__ */ __name((err) => logDeliveryError(err), 'onError'),
        onPayload: logPayload,
        deps: createOutboundSendDeps(deps)
      });
    }
  }
  return { payloads: normalizedPayloads, meta: result.meta };
}
__name(deliverAgentCommandResult, 'deliverAgentCommandResult');
export {
  deliverAgentCommandResult
};
