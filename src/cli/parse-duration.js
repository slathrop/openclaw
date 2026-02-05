const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
function parseDurationMs(raw, opts) {
  const trimmed = String(raw ?? '').trim().toLowerCase();
  if (!trimmed) {
    throw new Error('invalid duration (empty)');
  }
  const m = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/.exec(trimmed);
  if (!m) {
    throw new Error(`invalid duration: ${raw}`);
  }
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`invalid duration: ${raw}`);
  }
  const unit = m[2] ?? opts?.defaultUnit ?? 'ms';
  const multiplier = unit === 'ms' ? 1 : unit === 's' ? 1e3 : unit === 'm' ? 6e4 : unit === 'h' ? 36e5 : 864e5;
  const ms = Math.round(value * multiplier);
  if (!Number.isFinite(ms)) {
    throw new Error(`invalid duration: ${raw}`);
  }
  return ms;
}
__name(parseDurationMs, 'parseDurationMs');
export {
  parseDurationMs
};
