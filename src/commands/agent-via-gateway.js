const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { listAgentIds } from '../agents/agent-scope.js';
import { DEFAULT_CHAT_CHANNEL } from '../channels/registry.js';
import { formatCliCommand } from '../cli/command-format.js';
import { withProgress } from '../cli/progress.js';
import { loadConfig } from '../config/config.js';
import { callGateway, randomIdempotencyKey } from '../gateway/call.js';
import { normalizeAgentId } from '../routing/session-key.js';
import {
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES,
  normalizeMessageChannel
} from '../utils/message-channel.js';
import { agentCommand } from './agent.js';
import { resolveSessionKeyForRequest } from './agent/session.js';
function parseTimeoutSeconds(opts) {
  const raw = opts.timeout !== void 0 ? Number.parseInt(String(opts.timeout), 10) : opts.cfg.agents?.defaults?.timeoutSeconds ?? 600;
  if (Number.isNaN(raw) || raw <= 0) {
    throw new Error('--timeout must be a positive integer (seconds)');
  }
  return raw;
}
__name(parseTimeoutSeconds, 'parseTimeoutSeconds');
function formatPayloadForLog(payload) {
  const lines = [];
  if (payload.text) {
    lines.push(payload.text.trimEnd());
  }
  const mediaUrl = typeof payload.mediaUrl === 'string' && payload.mediaUrl.trim() ? payload.mediaUrl.trim() : void 0;
  const media = payload.mediaUrls ?? (mediaUrl ? [mediaUrl] : []);
  for (const url of media) {
    lines.push(`MEDIA:${url}`);
  }
  return lines.join('\n').trimEnd();
}
__name(formatPayloadForLog, 'formatPayloadForLog');
async function agentViaGatewayCommand(opts, runtime) {
  const body = (opts.message ?? '').trim();
  if (!body) {
    throw new Error('Message (--message) is required');
  }
  if (!opts.to && !opts.sessionId && !opts.agent) {
    throw new Error('Pass --to <E.164>, --session-id, or --agent to choose a session');
  }
  const cfg = loadConfig();
  const agentIdRaw = opts.agent?.trim();
  const agentId = agentIdRaw ? normalizeAgentId(agentIdRaw) : void 0;
  if (agentId) {
    const knownAgents = listAgentIds(cfg);
    if (!knownAgents.includes(agentId)) {
      throw new Error(
        `Unknown agent id "${agentIdRaw}". Use "${formatCliCommand('openclaw agents list')}" to see configured agents.`
      );
    }
  }
  const timeoutSeconds = parseTimeoutSeconds({ cfg, timeout: opts.timeout });
  const gatewayTimeoutMs = Math.max(1e4, (timeoutSeconds + 30) * 1e3);
  const sessionKey = resolveSessionKeyForRequest({
    cfg,
    agentId,
    to: opts.to,
    sessionId: opts.sessionId
  }).sessionKey;
  const channel = normalizeMessageChannel(opts.channel) ?? DEFAULT_CHAT_CHANNEL;
  const idempotencyKey = opts.runId?.trim() || randomIdempotencyKey();
  const response = await withProgress(
    {
      label: 'Waiting for agent reply\u2026',
      indeterminate: true,
      enabled: opts.json !== true
    },
    async () => await callGateway({
      method: 'agent',
      params: {
        message: body,
        agentId,
        to: opts.to,
        replyTo: opts.replyTo,
        sessionId: opts.sessionId,
        sessionKey,
        thinking: opts.thinking,
        deliver: Boolean(opts.deliver),
        channel,
        replyChannel: opts.replyChannel,
        replyAccountId: opts.replyAccount,
        timeout: timeoutSeconds,
        lane: opts.lane,
        extraSystemPrompt: opts.extraSystemPrompt,
        idempotencyKey
      },
      expectFinal: true,
      timeoutMs: gatewayTimeoutMs,
      clientName: GATEWAY_CLIENT_NAMES.CLI,
      mode: GATEWAY_CLIENT_MODES.CLI
    })
  );
  if (opts.json) {
    runtime.log(JSON.stringify(response, null, 2));
    return response;
  }
  const result = response?.result;
  const payloads = result?.payloads ?? [];
  if (payloads.length === 0) {
    runtime.log(response?.summary ? String(response.summary) : 'No reply from agent.');
    return response;
  }
  for (const payload of payloads) {
    const out = formatPayloadForLog(payload);
    if (out) {
      runtime.log(out);
    }
  }
  return response;
}
__name(agentViaGatewayCommand, 'agentViaGatewayCommand');
async function agentCliCommand(opts, runtime, deps) {
  const localOpts = {
    ...opts,
    agentId: opts.agent,
    replyAccountId: opts.replyAccount
  };
  if (opts.local === true) {
    return await agentCommand(localOpts, runtime, deps);
  }
  try {
    return await agentViaGatewayCommand(opts, runtime);
  } catch (err) {
    runtime.error?.(`Gateway agent failed; falling back to embedded: ${String(err)}`);
    return await agentCommand(localOpts, runtime, deps);
  }
}
__name(agentCliCommand, 'agentCliCommand');
export {
  agentCliCommand,
  agentViaGatewayCommand
};
