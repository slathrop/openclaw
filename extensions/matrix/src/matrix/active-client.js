let activeClient = null;
function setActiveMatrixClient(client) {
  activeClient = client;
}
function getActiveMatrixClient() {
  return activeClient;
}
export {
  getActiveMatrixClient,
  setActiveMatrixClient
};
