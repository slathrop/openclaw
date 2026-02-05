import {
  dispatchInboundMessageWithBufferedDispatcher,
  dispatchInboundMessageWithDispatcher
} from '../dispatch.js';
async function dispatchReplyWithBufferedBlockDispatcher(params) {
  return await dispatchInboundMessageWithBufferedDispatcher({
    ctx: params.ctx,
    cfg: params.cfg,
    dispatcherOptions: params.dispatcherOptions,
    replyResolver: params.replyResolver,
    replyOptions: params.replyOptions
  });
}
async function dispatchReplyWithDispatcher(params) {
  return await dispatchInboundMessageWithDispatcher({
    ctx: params.ctx,
    cfg: params.cfg,
    dispatcherOptions: params.dispatcherOptions,
    replyResolver: params.replyResolver,
    replyOptions: params.replyOptions
  });
}
export {
  dispatchReplyWithBufferedBlockDispatcher,
  dispatchReplyWithDispatcher
};
