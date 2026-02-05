import { formatAgo, formatDurationMs, formatMs } from './format.js';
function formatPresenceSummary(entry) {
  const host = entry.host ?? 'unknown';
  const ip = entry.ip ? `(${entry.ip})` : '';
  const mode = entry.mode ?? '';
  const version = entry.version ?? '';
  return `${host} ${ip} ${mode} ${version}`.trim();
}
function formatPresenceAge(entry) {
  const ts = entry.ts ?? null;
  return ts ? formatAgo(ts) : 'n/a';
}
function formatNextRun(ms) {
  if (!ms) {
    return 'n/a';
  }
  return `${formatMs(ms)} (${formatAgo(ms)})`;
}
function formatSessionTokens(row) {
  if (row.totalTokens === null || row.totalTokens === undefined) {
    return 'n/a';
  }
  const total = row.totalTokens ?? 0;
  const ctx = row.contextTokens ?? 0;
  return ctx ? `${total} / ${ctx}` : String(total);
}
function formatEventPayload(payload) {
  if (payload === null || payload === undefined) {
    return '';
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}
function formatCronState(job) {
  const state = job.state ?? {};
  const next = state.nextRunAtMs ? formatMs(state.nextRunAtMs) : 'n/a';
  const last = state.lastRunAtMs ? formatMs(state.lastRunAtMs) : 'n/a';
  const status = state.lastStatus ?? 'n/a';
  return `${status} \xB7 next ${next} \xB7 last ${last}`;
}
function formatCronSchedule(job) {
  const s = job.schedule;
  if (s.kind === 'at') {
    const atMs = Date.parse(s.at);
    return Number.isFinite(atMs) ? `At ${formatMs(atMs)}` : `At ${s.at}`;
  }
  if (s.kind === 'every') {
    return `Every ${formatDurationMs(s.everyMs)}`;
  }
  return `Cron ${s.expr}${s.tz ? ` (${s.tz})` : ''}`;
}
function formatCronPayload(job) {
  const p = job.payload;
  if (p.kind === 'systemEvent') {
    return `System: ${p.text}`;
  }
  const base = `Agent: ${p.message}`;
  const delivery = job.delivery;
  if (delivery && delivery.mode !== 'none') {
    const target = delivery.channel || delivery.to ? ` (${delivery.channel ?? 'last'}${delivery.to ? ` -> ${delivery.to}` : ''})` : '';
    return `${base} \xB7 ${delivery.mode}${target}`;
  }
  return base;
}
export {
  formatCronPayload,
  formatCronSchedule,
  formatCronState,
  formatEventPayload,
  formatNextRun,
  formatPresenceAge,
  formatPresenceSummary,
  formatSessionTokens
};
