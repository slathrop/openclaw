let runtime = null;
function setDiscordRuntime(next) {
  runtime = next;
}
function getDiscordRuntime() {
  if (!runtime) {
    throw new Error('Discord runtime not initialized');
  }
  return runtime;
}
export {
  getDiscordRuntime,
  setDiscordRuntime
};
