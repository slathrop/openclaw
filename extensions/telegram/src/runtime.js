let runtime = null;
function setTelegramRuntime(next) {
  runtime = next;
}
function getTelegramRuntime() {
  if (!runtime) {
    throw new Error('Telegram runtime not initialized');
  }
  return runtime;
}
export {
  getTelegramRuntime,
  setTelegramRuntime
};
