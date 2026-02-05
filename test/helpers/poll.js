function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function pollUntil(fn, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 2e3;
  const intervalMs = opts.intervalMs ?? 25;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await fn();
    if (value !== null && value !== void 0) {
      return value;
    }
    await sleep(intervalMs);
  }
  return void 0;
}
export {
  pollUntil
};
