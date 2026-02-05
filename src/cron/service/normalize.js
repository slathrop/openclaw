import { normalizeAgentId } from '../../routing/session-key.js';
import { truncateUtf16Safe } from '../../utils.js';
function normalizeRequiredName(raw) {
  if (typeof raw !== 'string') {
    throw new Error('cron job name is required');
  }
  const name = raw.trim();
  if (!name) {
    throw new Error('cron job name is required');
  }
  return name;
}
function normalizeOptionalText(raw) {
  if (typeof raw !== 'string') {
    return void 0;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed : void 0;
}
function truncateText(input, maxLen) {
  if (input.length <= maxLen) {
    return input;
  }
  return `${truncateUtf16Safe(input, Math.max(0, maxLen - 1)).trimEnd()}\u2026`;
}
function normalizeOptionalAgentId(raw) {
  if (typeof raw !== 'string') {
    return void 0;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return void 0;
  }
  return normalizeAgentId(trimmed);
}
function inferLegacyName(job) {
  const text = job?.payload?.kind === 'systemEvent' && typeof job.payload.text === 'string' ? job.payload.text : job?.payload?.kind === 'agentTurn' && typeof job.payload.message === 'string' ? job.payload.message : '';
  const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  if (firstLine) {
    return truncateText(firstLine, 60);
  }
  const kind = typeof job?.schedule?.kind === 'string' ? job.schedule.kind : '';
  if (kind === 'cron' && typeof job?.schedule?.expr === 'string') {
    return `Cron: ${truncateText(job.schedule.expr, 52)}`;
  }
  if (kind === 'every' && typeof job?.schedule?.everyMs === 'number') {
    return `Every: ${job.schedule.everyMs}ms`;
  }
  if (kind === 'at') {
    return 'One-shot';
  }
  return 'Cron job';
}
function normalizePayloadToSystemText(payload) {
  if (payload.kind === 'systemEvent') {
    return payload.text.trim();
  }
  return payload.message.trim();
}
export {
  inferLegacyName,
  normalizeOptionalAgentId,
  normalizeOptionalText,
  normalizePayloadToSystemText,
  normalizeRequiredName
};
