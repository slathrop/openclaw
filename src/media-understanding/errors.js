class MediaUnderstandingSkipError extends Error {
  reason;
  constructor(reason, message) {
    super(message);
    this.reason = reason;
    this.name = 'MediaUnderstandingSkipError';
  }
}
function isMediaUnderstandingSkipError(err) {
  return err instanceof MediaUnderstandingSkipError;
}
export {
  MediaUnderstandingSkipError,
  isMediaUnderstandingSkipError
};
