/** @module gateway/http-common -- Shared HTTP utilities (JSON responses, error formatting) for gateway routes. */
import { readJsonBody } from './hooks.js';
function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
function sendText(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(body);
}
function sendMethodNotAllowed(res, allow = 'POST') {
  res.setHeader('Allow', allow);
  sendText(res, 405, 'Method Not Allowed');
}
function sendUnauthorized(res) {
  sendJson(res, 401, {
    error: { message: 'Unauthorized', type: 'unauthorized' }
  });
}
function sendInvalidRequest(res, message) {
  sendJson(res, 400, {
    error: { message, type: 'invalid_request_error' }
  });
}
async function readJsonBodyOrError(req, res, maxBytes) {
  const body = await readJsonBody(req, maxBytes);
  if (!body.ok) {
    sendInvalidRequest(res, body.error);
    return void 0;
  }
  return body.value;
}
function writeDone(res) {
  res.write('data: [DONE]\n\n');
}
function setSseHeaders(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}
export {
  readJsonBodyOrError,
  sendInvalidRequest,
  sendJson,
  sendMethodNotAllowed,
  sendText,
  sendUnauthorized,
  setSseHeaders,
  writeDone
};
