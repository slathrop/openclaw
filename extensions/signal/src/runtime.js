let runtime = null;
function setSignalRuntime(next) {
  runtime = next;
}
function getSignalRuntime() {
  if (!runtime) {
    throw new Error('Signal runtime not initialized');
  }
  return runtime;
}
export {
  getSignalRuntime,
  setSignalRuntime
};
