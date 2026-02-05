/**
 * Safe stream writer with broken pipe handling.
 *
 * Wraps Node.js WriteStream writes to gracefully handle EPIPE and EIO
 * errors (broken pipes). Once a pipe breaks, subsequent writes are
 * silently dropped and callers are notified via callback.
 * @typedef {object} SafeStreamWriterOptions
 * @property {() => void} [beforeWrite]
 * @property {(err: Error, stream: NodeJS.WriteStream) => void} [onBrokenPipe]
 */

/**
 * @typedef {object} SafeStreamWriter
 * @property {(stream: NodeJS.WriteStream, text: string) => boolean} write
 * @property {(stream: NodeJS.WriteStream, text: string) => boolean} writeLine
 * @property {() => void} reset
 * @property {() => boolean} isClosed
 */

const isBrokenPipeError = (err) => {
  const code = err?.code;
  return code === 'EPIPE' || code === 'EIO';
};

/**
 * @param {SafeStreamWriterOptions} [options]
 * @returns {SafeStreamWriter}
 */
export const createSafeStreamWriter = (options = {}) => {
  let closed = false;
  let notified = false;

  const noteBrokenPipe = (err, stream) => {
    if (notified) {
      return;
    }
    notified = true;
    options.onBrokenPipe?.(err, stream);
  };

  const handleError = (err, stream) => {
    if (!isBrokenPipeError(err)) {
      throw err;
    }
    closed = true;
    noteBrokenPipe(err, stream);
    return false;
  };

  const write = (stream, text) => {
    if (closed) {
      return false;
    }
    try {
      options.beforeWrite?.();
    } catch (err) {
      return handleError(err, process.stderr);
    }
    try {
      stream.write(text);
      return !closed;
    } catch (err) {
      return handleError(err, stream);
    }
  };

  const writeLine = (stream, text) =>
    write(stream, `${text}\n`);

  return {
    write,
    writeLine,
    reset: () => {
      closed = false;
      notified = false;
    },
    isClosed: () => closed
  };
};
