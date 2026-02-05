let runtime = null;
function setWhatsAppRuntime(next) {
  runtime = next;
}
function getWhatsAppRuntime() {
  if (!runtime) {
    throw new Error('WhatsApp runtime not initialized');
  }
  return runtime;
}
export {
  getWhatsAppRuntime,
  setWhatsAppRuntime
};
