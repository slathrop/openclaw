/** @module gateway/http-utils -- HTTP request/response helpers for gateway endpoints. */
import { randomUUID } from 'node:crypto';
import { buildAgentMainSessionKey, normalizeAgentId } from '../routing/session-key.js';
function getHeader(req, name) {
  const raw = req.headers[name.toLowerCase()];
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return void 0;
}
function getBearerToken(req) {
  const raw = getHeader(req, 'authorization')?.trim() ?? '';
  if (!raw.toLowerCase().startsWith('bearer ')) {
    return void 0;
  }
  const token = raw.slice(7).trim();
  return token || void 0;
}
function resolveAgentIdFromHeader(req) {
  const raw = getHeader(req, 'x-openclaw-agent-id')?.trim() || getHeader(req, 'x-openclaw-agent')?.trim() || '';
  if (!raw) {
    return void 0;
  }
  return normalizeAgentId(raw);
}
function resolveAgentIdFromModel(model) {
  const raw = model?.trim();
  if (!raw) {
    return void 0;
  }
  const m = raw.match(/^openclaw[:/](?<agentId>[a-z0-9][a-z0-9_-]{0,63})$/i) ?? raw.match(/^agent:(?<agentId>[a-z0-9][a-z0-9_-]{0,63})$/i);
  const agentId = m?.groups?.agentId;
  if (!agentId) {
    return void 0;
  }
  return normalizeAgentId(agentId);
}
function resolveAgentIdForRequest(params) {
  const fromHeader = resolveAgentIdFromHeader(params.req);
  if (fromHeader) {
    return fromHeader;
  }
  const fromModel = resolveAgentIdFromModel(params.model);
  return fromModel ?? 'main';
}
function resolveSessionKey(params) {
  const explicit = getHeader(params.req, 'x-openclaw-session-key')?.trim();
  if (explicit) {
    return explicit;
  }
  const user = params.user?.trim();
  const mainKey = user ? `${params.prefix}-user:${user}` : `${params.prefix}:${randomUUID()}`;
  return buildAgentMainSessionKey({ agentId: params.agentId, mainKey });
}
export {
  getBearerToken,
  getHeader,
  resolveAgentIdForRequest,
  resolveAgentIdFromHeader,
  resolveAgentIdFromModel,
  resolveSessionKey
};
