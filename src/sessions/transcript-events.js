/**
 * Session transcript update event emitter.
 *
 * Provides a pub/sub mechanism for notifying listeners when a session
 * transcript file is updated. Used by the gateway to trigger UI refreshes.
 */

const SESSION_TRANSCRIPT_LISTENERS = new Set();

/**
 * @param {(update: { sessionFile: string }) => void} listener
 * @returns {() => void}
 */
export const onSessionTranscriptUpdate = (listener) => {
  SESSION_TRANSCRIPT_LISTENERS.add(listener);
  return () => {
    SESSION_TRANSCRIPT_LISTENERS.delete(listener);
  };
};

/**
 * @param {string} sessionFile
 */
export const emitSessionTranscriptUpdate = (sessionFile) => {
  const trimmed = sessionFile.trim();
  if (!trimmed) {
    return;
  }
  const update = { sessionFile: trimmed };
  for (const listener of SESSION_TRANSCRIPT_LISTENERS) {
    listener(update);
  }
};
