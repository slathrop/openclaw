/** @module gateway/server-methods/nodes.helpers -- Node operation helper utilities. */
import { ErrorCodes, errorShape, formatValidationErrors } from '../protocol/index.js';
import { formatForLog } from '../ws-log.js';
function respondInvalidParams(params) {
  params.respond(
    false,
    void 0,
    errorShape(
      ErrorCodes.INVALID_REQUEST,
      `invalid ${params.method} params: ${formatValidationErrors(params.validator.errors)}`
    )
  );
}
async function respondUnavailableOnThrow(respond, fn) {
  try {
    await fn();
  } catch (err) {
    respond(false, void 0, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
  }
}
function uniqueSortedStrings(values) {
  return [...new Set(values.filter((v) => typeof v === 'string'))].map((v) => v.trim()).filter(Boolean).toSorted();
}
function safeParseJson(value) {
  if (typeof value !== 'string') {
    return void 0;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return void 0;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return { payloadJSON: value };
  }
}
export {
  respondInvalidParams,
  respondUnavailableOnThrow,
  safeParseJson,
  uniqueSortedStrings
};
