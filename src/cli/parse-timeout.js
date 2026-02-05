const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
function parseTimeoutMs(raw) {
  if (raw === void 0 || raw === null) {
    return void 0;
  }
  let value = Number.NaN;
  if (typeof raw === 'number') {
    value = raw;
  } else if (typeof raw === 'bigint') {
    value = Number(raw);
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return void 0;
    }
    value = Number.parseInt(trimmed, 10);
  }
  return Number.isFinite(value) ? value : void 0;
}
__name(parseTimeoutMs, 'parseTimeoutMs');
export {
  parseTimeoutMs
};
