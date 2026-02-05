/**
 * @module pty-dsr
 * PTY Device Status Report (DSR) sequence stripping.
 */
const ESC = String.fromCharCode(27);
const DSR_PATTERN = new RegExp(`${ESC}\\[\\??6n`, 'g');
function stripDsrRequests(input) {
  let requests = 0;
  const cleaned = input.replace(DSR_PATTERN, () => {
    requests += 1;
    return '';
  });
  return { cleaned, requests };
}
function buildCursorPositionResponse(row = 1, col = 1) {
  return `\x1B[${row};${col}R`;
}
export {
  buildCursorPositionResponse,
  stripDsrRequests
};
