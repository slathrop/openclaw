/**
 * Active progress line management for TTY output.
 *
 * Tracks the current progress line stream so it can be cleared
 * before writing new console output, preventing visual corruption.
 */

/** @type {NodeJS.WriteStream | null} */
let activeStream = null;

/**
 * @param {NodeJS.WriteStream} stream
 */
export const registerActiveProgressLine = (stream) => {
  if (!stream.isTTY) {
    return;
  }
  activeStream = stream;
};

export const clearActiveProgressLine = () => {
  if (!activeStream?.isTTY) {
    return;
  }
  activeStream.write('\r\x1b[2K');
};

/**
 * @param {NodeJS.WriteStream} [stream]
 */
export const unregisterActiveProgressLine = (stream) => {
  if (!activeStream) {
    return;
  }
  if (stream && activeStream !== stream) {
    return;
  }
  activeStream = null;
};
