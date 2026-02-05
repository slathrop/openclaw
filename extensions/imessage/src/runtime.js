let runtime = null;
function setIMessageRuntime(next) {
  runtime = next;
}
function getIMessageRuntime() {
  if (!runtime) {
    throw new Error('iMessage runtime not initialized');
  }
  return runtime;
}
export {
  getIMessageRuntime,
  setIMessageRuntime
};
