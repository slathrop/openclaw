let runtime = null;
function setMattermostRuntime(next) {
  runtime = next;
}
function getMattermostRuntime() {
  if (!runtime) {
    throw new Error('Mattermost runtime not initialized');
  }
  return runtime;
}
export {
  getMattermostRuntime,
  setMattermostRuntime
};
