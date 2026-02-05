let runtime = null;
function setNextcloudTalkRuntime(next) {
  runtime = next;
}
function getNextcloudTalkRuntime() {
  if (!runtime) {
    throw new Error('Nextcloud Talk runtime not initialized');
  }
  return runtime;
}
export {
  getNextcloudTalkRuntime,
  setNextcloudTalkRuntime
};
