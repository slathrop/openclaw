function formatUtcTimestamp(date) {
  const yyyy = String(date.getUTCFullYear()).padStart(4, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}Z`;
}
function formatZonedTimestamp(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short'
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  const yyyy = pick('year');
  const mm = pick('month');
  const dd = pick('day');
  const hh = pick('hour');
  const min = pick('minute');
  const tz = [...parts].toReversed().find((part) => part.type === 'timeZoneName')?.value?.trim();
  if (!yyyy || !mm || !dd || !hh || !min) {
    throw new Error('Missing date parts for envelope timestamp formatting.');
  }
  return `${yyyy}-${mm}-${dd} ${hh}:${min}${tz ? ` ${tz}` : ''}`;
}
function formatEnvelopeTimestamp(date, zone = 'utc') {
  const normalized = zone.trim().toLowerCase();
  if (normalized === 'utc' || normalized === 'gmt') {
    return formatUtcTimestamp(date);
  }
  if (normalized === 'local' || normalized === 'host') {
    return formatZonedTimestamp(date);
  }
  return formatZonedTimestamp(date, zone);
}
function formatLocalEnvelopeTimestamp(date) {
  return formatEnvelopeTimestamp(date, 'local');
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export {
  escapeRegExp,
  formatEnvelopeTimestamp,
  formatLocalEnvelopeTimestamp
};
