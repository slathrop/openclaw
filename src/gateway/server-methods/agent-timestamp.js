/** @module gateway/server-methods/agent-timestamp -- Agent timestamp tracking for activity monitoring. */
import { resolveUserTimezone } from '../../agents/date-time.js';
import { formatZonedTimestamp } from '../../auto-reply/envelope.js';
const CRON_TIME_PATTERN = /Current time: /;
const TIMESTAMP_ENVELOPE_PATTERN = /^\[.*\d{4}-\d{2}-\d{2} \d{2}:\d{2}/;
function injectTimestamp(message, opts) {
  if (!message.trim()) {
    return message;
  }
  if (TIMESTAMP_ENVELOPE_PATTERN.test(message)) {
    return message;
  }
  if (CRON_TIME_PATTERN.test(message)) {
    return message;
  }
  const now = opts?.now ?? /* @__PURE__ */ new Date();
  const timezone = opts?.timezone ?? 'UTC';
  const formatted = formatZonedTimestamp(now, timezone);
  if (!formatted) {
    return message;
  }
  const dow = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(
    now
  );
  return `[${dow} ${formatted}] ${message}`;
}
function timestampOptsFromConfig(cfg) {
  return {
    timezone: resolveUserTimezone(cfg.agents?.defaults?.userTimezone)
  };
}
export {
  injectTimestamp,
  timestampOptsFromConfig
};
