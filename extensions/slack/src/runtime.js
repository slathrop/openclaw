let runtime = null;
function setSlackRuntime(next) {
  runtime = next;
}
function getSlackRuntime() {
  if (!runtime) {
    throw new Error('Slack runtime not initialized');
  }
  return runtime;
}
export {
  getSlackRuntime,
  setSlackRuntime
};
