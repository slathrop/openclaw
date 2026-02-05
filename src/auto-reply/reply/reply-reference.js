function createReplyReferencePlanner(options) {
  let hasReplied = options.hasReplied ?? false;
  const allowReference = options.allowReference !== false;
  const existingId = options.existingId?.trim();
  const startId = options.startId?.trim();
  const use = () => {
    if (!allowReference) {
      return void 0;
    }
    if (existingId) {
      hasReplied = true;
      return existingId;
    }
    if (!startId) {
      return void 0;
    }
    if (options.replyToMode === 'off') {
      return void 0;
    }
    if (options.replyToMode === 'all') {
      hasReplied = true;
      return startId;
    }
    if (!hasReplied) {
      hasReplied = true;
      return startId;
    }
    return void 0;
  };
  const markSent = () => {
    hasReplied = true;
  };
  return {
    use,
    markSent,
    hasReplied: () => hasReplied
  };
}
export {
  createReplyReferencePlanner
};
