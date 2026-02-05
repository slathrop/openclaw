let runtime = null;
function setGoogleChatRuntime(next) {
  runtime = next;
}
function getGoogleChatRuntime() {
  if (!runtime) {
    throw new Error('Google Chat runtime not initialized');
  }
  return runtime;
}
export {
  getGoogleChatRuntime,
  setGoogleChatRuntime
};
