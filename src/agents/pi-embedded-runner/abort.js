/**
 * Abort signal handling for Pi embedded runner executions.
 * @param err
 * @module agents/pi-embedded-runner/abort
 */
function isAbortError(err) {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const name = 'name' in err ? String(err.name) : '';
  if (name === 'AbortError') {
    return true;
  }
  const message = 'message' in err && typeof err.message === 'string' ? err.message.toLowerCase() : '';
  return message.includes('aborted');
}
export {
  isAbortError
};
