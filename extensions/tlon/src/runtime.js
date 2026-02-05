let runtime = null;
function setTlonRuntime(next) {
  runtime = next;
}
function getTlonRuntime() {
  if (!runtime) {
    throw new Error('Tlon runtime not initialized');
  }
  return runtime;
}
export {
  getTlonRuntime,
  setTlonRuntime
};
