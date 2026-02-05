/** @module memory/node-llama - Local embedding provider using node-llama-cpp. */
async function importNodeLlamaCpp() {
  return import('node-llama-cpp');
}
export {
  importNodeLlamaCpp
};
