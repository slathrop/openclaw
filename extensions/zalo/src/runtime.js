let runtime = null;
function setZaloRuntime(next) {
  runtime = next;
}
function getZaloRuntime() {
  if (!runtime) {
    throw new Error('Zalo runtime not initialized');
  }
  return runtime;
}
export {
  getZaloRuntime,
  setZaloRuntime
};
