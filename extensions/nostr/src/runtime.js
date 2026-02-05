let runtime = null;
function setNostrRuntime(next) {
  runtime = next;
}
function getNostrRuntime() {
  if (!runtime) {
    throw new Error('Nostr runtime not initialized');
  }
  return runtime;
}
export {
  getNostrRuntime,
  setNostrRuntime
};
