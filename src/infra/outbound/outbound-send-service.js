/**
 * SECURITY: Outbound send orchestration service.
 * Coordinates between plugin-handled and core message sending paths.
 * Enforces abort signal cancellation to prevent runaway sends.
 * @module
 */

import { dispatchChannelMessageAction } from '../../channels/plugins/message-actions.js';
import { appendAssistantMessageToSessionTranscript } from '../../config/sessions.js';
import { sendMessage, sendPoll } from './message.js';
function extractToolPayload(result) {
  if (result.details !== void 0) {
    return result.details;
  }
  const textBlock = Array.isArray(result.content) ? result.content.find(
    (block) => block && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string'
  ) : void 0;
  const text = textBlock?.text;
  if (text) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return result.content ?? result;
}
function throwIfAborted(abortSignal) {
  if (abortSignal?.aborted) {
    const err = new Error('Message send aborted');
    err.name = 'AbortError';
    throw err;
  }
}
async function executeSendAction(params) {
  throwIfAborted(params.ctx.abortSignal);
  if (!params.ctx.dryRun) {
    const handled = await dispatchChannelMessageAction({
      channel: params.ctx.channel,
      action: 'send',
      cfg: params.ctx.cfg,
      params: params.ctx.params,
      accountId: params.ctx.accountId ?? void 0,
      gateway: params.ctx.gateway,
      toolContext: params.ctx.toolContext,
      dryRun: params.ctx.dryRun
    });
    if (handled) {
      if (params.ctx.mirror) {
        const mirrorText = params.ctx.mirror.text ?? params.message;
        const mirrorMediaUrls = params.ctx.mirror.mediaUrls ?? params.mediaUrls ?? (params.mediaUrl ? [params.mediaUrl] : void 0);
        await appendAssistantMessageToSessionTranscript({
          agentId: params.ctx.mirror.agentId,
          sessionKey: params.ctx.mirror.sessionKey,
          text: mirrorText,
          mediaUrls: mirrorMediaUrls
        });
      }
      return {
        handledBy: 'plugin',
        payload: extractToolPayload(handled),
        toolResult: handled
      };
    }
  }
  throwIfAborted(params.ctx.abortSignal);
  const result = await sendMessage({
    cfg: params.ctx.cfg,
    to: params.to,
    content: params.message,
    mediaUrl: params.mediaUrl || void 0,
    mediaUrls: params.mediaUrls,
    channel: params.ctx.channel || void 0,
    accountId: params.ctx.accountId ?? void 0,
    gifPlayback: params.gifPlayback,
    dryRun: params.ctx.dryRun,
    bestEffort: params.bestEffort ?? void 0,
    deps: params.ctx.deps,
    gateway: params.ctx.gateway,
    mirror: params.ctx.mirror,
    abortSignal: params.ctx.abortSignal
  });
  return {
    handledBy: 'core',
    payload: result,
    sendResult: result
  };
}
async function executePollAction(params) {
  if (!params.ctx.dryRun) {
    const handled = await dispatchChannelMessageAction({
      channel: params.ctx.channel,
      action: 'poll',
      cfg: params.ctx.cfg,
      params: params.ctx.params,
      accountId: params.ctx.accountId ?? void 0,
      gateway: params.ctx.gateway,
      toolContext: params.ctx.toolContext,
      dryRun: params.ctx.dryRun
    });
    if (handled) {
      return {
        handledBy: 'plugin',
        payload: extractToolPayload(handled),
        toolResult: handled
      };
    }
  }
  const result = await sendPoll({
    cfg: params.ctx.cfg,
    to: params.to,
    question: params.question,
    options: params.options,
    maxSelections: params.maxSelections,
    durationHours: params.durationHours ?? void 0,
    channel: params.ctx.channel,
    dryRun: params.ctx.dryRun,
    gateway: params.ctx.gateway
  });
  return {
    handledBy: 'core',
    payload: result,
    pollResult: result
  };
}
export {
  executePollAction,
  executeSendAction
};
