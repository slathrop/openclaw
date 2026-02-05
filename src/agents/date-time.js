/**
 * @module date-time
 * Date and time formatting utilities for agent prompts.
 */
import { execSync } from 'node:child_process';
let cachedTimeFormat;
function resolveUserTimezone(configured) {
  const trimmed = configured?.trim();
  if (trimmed) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).format(/* @__PURE__ */ new Date());
      return trimmed;
    } catch { /* ignored */ }
  }
  const host = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return host?.trim() || 'UTC';
}
function resolveUserTimeFormat(preference) {
  if (preference === '12' || preference === '24') {
    return preference;
  }
  if (cachedTimeFormat) {
    return cachedTimeFormat;
  }
  cachedTimeFormat = detectSystemTimeFormat() ? '24' : '12';
  return cachedTimeFormat;
}
function normalizeTimestamp(raw) {
  if (raw === null || raw === undefined) {
    return void 0;
  }
  let timestampMs;
  if (raw instanceof Date) {
    timestampMs = raw.getTime();
  } else if (typeof raw === 'number' && Number.isFinite(raw)) {
    timestampMs = raw < 1e12 ? Math.round(raw * 1e3) : Math.round(raw);
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return void 0;
    }
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (Number.isFinite(num)) {
        if (trimmed.includes('.')) {
          timestampMs = Math.round(num * 1e3);
        } else if (trimmed.length >= 13) {
          timestampMs = Math.round(num);
        } else {
          timestampMs = Math.round(num * 1e3);
        }
      }
    } else {
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        timestampMs = parsed;
      }
    }
  }
  if (timestampMs === void 0 || !Number.isFinite(timestampMs)) {
    return void 0;
  }
  return { timestampMs, timestampUtc: new Date(timestampMs).toISOString() };
}
function withNormalizedTimestamp(value, rawTimestamp) {
  const normalized = normalizeTimestamp(rawTimestamp);
  if (!normalized) {
    return value;
  }
  return {
    ...value,
    timestampMs: typeof value.timestampMs === 'number' && Number.isFinite(value.timestampMs) ? value.timestampMs : normalized.timestampMs,
    timestampUtc: typeof value.timestampUtc === 'string' && value.timestampUtc.trim() ? value.timestampUtc : normalized.timestampUtc
  };
}
function detectSystemTimeFormat() {
  if (process.platform === 'darwin') {
    try {
      const result = execSync('defaults read -g AppleICUForce24HourTime 2>/dev/null', {
        encoding: 'utf8',
        timeout: 500
      }).trim();
      if (result === '1') {
        return true;
      }
      if (result === '0') {
        return false;
      }
    } catch { /* ignored */ }
  }
  if (process.platform === 'win32') {
    try {
      const result = execSync(
        'powershell -Command "(Get-Culture).DateTimeFormat.ShortTimePattern"',
        { encoding: 'utf8', timeout: 1e3 }
      ).trim();
      if (result.startsWith('H')) {
        return true;
      }
      if (result.startsWith('h')) {
        return false;
      }
    } catch { /* ignored */ }
  }
  try {
    const sample = new Date(2e3, 0, 1, 13, 0);
    const formatted = new Intl.DateTimeFormat(void 0, { hour: 'numeric' }).format(sample);
    return formatted.includes('13');
  } catch {
    return false;
  }
}
function ordinalSuffix(day) {
  if (day >= 11 && day <= 13) {
    return 'th';
  }
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
function formatUserTime(date, timeZone, format) {
  const use24Hour = format === '24';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: use24Hour ? '2-digit' : 'numeric',
      minute: '2-digit',
      hourCycle: use24Hour ? 'h23' : 'h12'
    }).formatToParts(date);
    const map = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        map[part.type] = part.value;
      }
    }
    if (!map.weekday || !map.year || !map.month || !map.day || !map.hour || !map.minute) {
      return void 0;
    }
    const dayNum = parseInt(map.day, 10);
    const suffix = ordinalSuffix(dayNum);
    const timePart = use24Hour ? `${map.hour}:${map.minute}` : `${map.hour}:${map.minute} ${map.dayPeriod ?? ''}`.trim();
    return `${map.weekday}, ${map.month} ${dayNum}${suffix}, ${map.year} \u2014 ${timePart}`;
  } catch {
    return void 0;
  }
}
export {
  formatUserTime,
  normalizeTimestamp,
  resolveUserTimeFormat,
  resolveUserTimezone,
  withNormalizedTimestamp
};
