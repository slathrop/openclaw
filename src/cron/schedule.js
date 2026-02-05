import { Cron } from 'croner';
import { parseAbsoluteTimeMs } from './parse.js';
function computeNextRunAtMs(schedule, nowMs) {
  if (schedule.kind === 'at') {
    const atMs = parseAbsoluteTimeMs(schedule.at);
    if (atMs === null) {
      return void 0;
    }
    return atMs > nowMs ? atMs : void 0;
  }
  if (schedule.kind === 'every') {
    const everyMs = Math.max(1, Math.floor(schedule.everyMs));
    const anchor = Math.max(0, Math.floor(schedule.anchorMs ?? nowMs));
    if (nowMs < anchor) {
      return anchor;
    }
    const elapsed = nowMs - anchor;
    const steps = Math.max(1, Math.floor((elapsed + everyMs - 1) / everyMs));
    return anchor + steps * everyMs;
  }
  const expr = schedule.expr.trim();
  if (!expr) {
    return void 0;
  }
  const cron = new Cron(expr, {
    timezone: schedule.tz?.trim() || void 0,
    catch: false
  });
  const next = cron.nextRun(new Date(nowMs));
  return next ? next.getTime() : void 0;
}
export {
  computeNextRunAtMs
};
