let runtime = null;
function setMSTeamsRuntime(next) {
  runtime = next;
}
function getMSTeamsRuntime() {
  if (!runtime) {
    throw new Error('MSTeams runtime not initialized');
  }
  return runtime;
}
export {
  getMSTeamsRuntime,
  setMSTeamsRuntime
};
