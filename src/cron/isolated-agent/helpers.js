import {
  DEFAULT_HEARTBEAT_ACK_MAX_CHARS,
  stripHeartbeatToken
} from '../../auto-reply/heartbeat.js';
import { truncateUtf16Safe } from '../../utils.js';
function pickSummaryFromOutput(text) {
  const clean = (text ?? '').trim();
  if (!clean) {
    return void 0;
  }
  const limit = 2e3;
  return clean.length > limit ? `${truncateUtf16Safe(clean, limit)}\u2026` : clean;
}
function pickSummaryFromPayloads(payloads) {
  for (let i = payloads.length - 1; i >= 0; i--) {
    const summary = pickSummaryFromOutput(payloads[i]?.text);
    if (summary) {
      return summary;
    }
  }
  return void 0;
}
function pickLastNonEmptyTextFromPayloads(payloads) {
  for (let i = payloads.length - 1; i >= 0; i--) {
    const clean = (payloads[i]?.text ?? '').trim();
    if (clean) {
      return clean;
    }
  }
  return void 0;
}
function isHeartbeatOnlyResponse(payloads, ackMaxChars) {
  if (payloads.length === 0) {
    return true;
  }
  return payloads.every((payload) => {
    const hasMedia = (payload.mediaUrls?.length ?? 0) > 0 || Boolean(payload.mediaUrl);
    if (hasMedia) {
      return false;
    }
    const result = stripHeartbeatToken(payload.text, {
      mode: 'heartbeat',
      maxAckChars: ackMaxChars
    });
    return result.shouldSkip;
  });
}
function resolveHeartbeatAckMaxChars(agentCfg) {
  const raw = agentCfg?.heartbeat?.ackMaxChars ?? DEFAULT_HEARTBEAT_ACK_MAX_CHARS;
  return Math.max(0, raw);
}
export {
  isHeartbeatOnlyResponse,
  pickLastNonEmptyTextFromPayloads,
  pickSummaryFromOutput,
  pickSummaryFromPayloads,
  resolveHeartbeatAckMaxChars
};
