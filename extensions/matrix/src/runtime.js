let runtime = null;
function setMatrixRuntime(next) {
  runtime = next;
}
function getMatrixRuntime() {
  if (!runtime) {
    throw new Error('Matrix runtime not initialized');
  }
  return runtime;
}
export {
  getMatrixRuntime,
  setMatrixRuntime
};
