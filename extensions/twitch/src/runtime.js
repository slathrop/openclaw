let runtime = null;
function setTwitchRuntime(next) {
  runtime = next;
}
function getTwitchRuntime() {
  if (!runtime) {
    throw new Error('Twitch runtime not initialized');
  }
  return runtime;
}
export {
  getTwitchRuntime,
  setTwitchRuntime
};
