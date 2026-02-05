/**
 * Agent step execution for multi-step tool workflows.
 * @module agents/tools/agent-step
 */
import crypto from 'node:crypto';
import { callGateway } from '../../gateway/call.js';
import { INTERNAL_MESSAGE_CHANNEL } from '../../utils/message-channel.js';
import { AGENT_LANE_NESTED } from '../lanes.js';
import { extractAssistantText, stripToolMessages } from './sessions-helpers.js';
async function readLatestAssistantReply(params) {
  const history = await callGateway({
    method: 'chat.history',
    params: { sessionKey: params.sessionKey, limit: params.limit ?? 50 }
  });
  const filtered = stripToolMessages(Array.isArray(history?.messages) ? history.messages : []);
  const last = filtered.length > 0 ? filtered[filtered.length - 1] : void 0;
  return last ? extractAssistantText(last) : void 0;
}
async function runAgentStep(params) {
  const stepIdem = crypto.randomUUID();
  const response = await callGateway({
    method: 'agent',
    params: {
      message: params.message,
      sessionKey: params.sessionKey,
      idempotencyKey: stepIdem,
      deliver: false,
      channel: params.channel ?? INTERNAL_MESSAGE_CHANNEL,
      lane: params.lane ?? AGENT_LANE_NESTED,
      extraSystemPrompt: params.extraSystemPrompt
    },
    timeoutMs: 1e4
  });
  const stepRunId = typeof response?.runId === 'string' && response.runId ? response.runId : '';
  const resolvedRunId = stepRunId || stepIdem;
  const stepWaitMs = Math.min(params.timeoutMs, 6e4);
  const wait = await callGateway({
    method: 'agent.wait',
    params: {
      runId: resolvedRunId,
      timeoutMs: stepWaitMs
    },
    timeoutMs: stepWaitMs + 2e3
  });
  if (wait?.status !== 'ok') {
    return void 0;
  }
  return await readLatestAssistantReply({ sessionKey: params.sessionKey });
}
export {
  readLatestAssistantReply,
  runAgentStep
};
