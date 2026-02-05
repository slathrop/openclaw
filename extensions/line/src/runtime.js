let runtime = null;
function setLineRuntime(r) {
  runtime = r;
}
function getLineRuntime() {
  if (!runtime) {
    throw new Error('LINE runtime not initialized - plugin not registered');
  }
  return runtime;
}
export {
  getLineRuntime,
  setLineRuntime
};
