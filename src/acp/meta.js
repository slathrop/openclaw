function readString(meta, keys) {
  if (!meta) {
    return void 0;
  }
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return void 0;
}
function readBool(meta, keys) {
  if (!meta) {
    return void 0;
  }
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }
  return void 0;
}
function readNumber(meta, keys) {
  if (!meta) {
    return void 0;
  }
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return void 0;
}
export {
  readBool,
  readNumber,
  readString
};
