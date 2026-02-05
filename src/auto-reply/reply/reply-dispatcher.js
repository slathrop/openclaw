import { sleep } from '../../utils.js';
import { normalizeReplyPayload } from './normalize-reply.js';
const DEFAULT_HUMAN_DELAY_MIN_MS = 800;
const DEFAULT_HUMAN_DELAY_MAX_MS = 2500;
function getHumanDelay(config) {
  const mode = config?.mode ?? 'off';
  if (mode === 'off') {
    return 0;
  }
  const min = mode === 'custom' ? config?.minMs ?? DEFAULT_HUMAN_DELAY_MIN_MS : DEFAULT_HUMAN_DELAY_MIN_MS;
  const max = mode === 'custom' ? config?.maxMs ?? DEFAULT_HUMAN_DELAY_MAX_MS : DEFAULT_HUMAN_DELAY_MAX_MS;
  if (max <= min) {
    return min;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function normalizeReplyPayloadInternal(payload, opts) {
  const prefixContext = opts.responsePrefixContextProvider?.() ?? opts.responsePrefixContext;
  return normalizeReplyPayload(payload, {
    responsePrefix: opts.responsePrefix,
    responsePrefixContext: prefixContext,
    onHeartbeatStrip: opts.onHeartbeatStrip,
    onSkip: opts.onSkip
  });
}
function createReplyDispatcher(options) {
  let sendChain = Promise.resolve();
  let pending = 0;
  let sentFirstBlock = false;
  const queuedCounts = {
    tool: 0,
    block: 0,
    final: 0
  };
  const enqueue = (kind, payload) => {
    const normalized = normalizeReplyPayloadInternal(payload, {
      responsePrefix: options.responsePrefix,
      responsePrefixContext: options.responsePrefixContext,
      responsePrefixContextProvider: options.responsePrefixContextProvider,
      onHeartbeatStrip: options.onHeartbeatStrip,
      onSkip: (reason) => options.onSkip?.(payload, { kind, reason })
    });
    if (!normalized) {
      return false;
    }
    queuedCounts[kind] += 1;
    pending += 1;
    const shouldDelay = kind === 'block' && sentFirstBlock;
    if (kind === 'block') {
      sentFirstBlock = true;
    }
    sendChain = sendChain.then(async () => {
      if (shouldDelay) {
        const delayMs = getHumanDelay(options.humanDelay);
        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }
      await options.deliver(normalized, { kind });
    }).catch((err) => {
      options.onError?.(err, { kind });
    }).finally(() => {
      pending -= 1;
      if (pending === 0) {
        options.onIdle?.();
      }
    });
    return true;
  };
  return {
    sendToolResult: (payload) => enqueue('tool', payload),
    sendBlockReply: (payload) => enqueue('block', payload),
    sendFinalReply: (payload) => enqueue('final', payload),
    waitForIdle: () => sendChain,
    getQueuedCounts: () => ({ ...queuedCounts })
  };
}
function createReplyDispatcherWithTyping(options) {
  const { onReplyStart, onIdle, ...dispatcherOptions } = options;
  let typingController;
  const dispatcher = createReplyDispatcher({
    ...dispatcherOptions,
    onIdle: () => {
      typingController?.markDispatchIdle();
      onIdle?.();
    }
  });
  return {
    dispatcher,
    replyOptions: {
      onReplyStart,
      onTypingController: (typing) => {
        typingController = typing;
      }
    },
    markDispatchIdle: () => {
      typingController?.markDispatchIdle();
      onIdle?.();
    }
  };
}
export {
  createReplyDispatcher,
  createReplyDispatcherWithTyping
};
