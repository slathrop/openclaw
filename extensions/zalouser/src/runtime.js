let runtime = null;
function setZalouserRuntime(next) {
  runtime = next;
}
function getZalouserRuntime() {
  if (!runtime) {
    throw new Error('Zalouser runtime not initialized');
  }
  return runtime;
}
export {
  getZalouserRuntime,
  setZalouserRuntime
};
