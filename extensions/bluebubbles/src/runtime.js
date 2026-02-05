let runtime = null;
function setBlueBubblesRuntime(next) {
  runtime = next;
}
function getBlueBubblesRuntime() {
  if (!runtime) {
    throw new Error('BlueBubbles runtime not initialized');
  }
  return runtime;
}
export {
  getBlueBubblesRuntime,
  setBlueBubblesRuntime
};
