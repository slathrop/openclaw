import { parseBooleanValue } from '../../utils/boolean.js';
function getProfileContext(req, ctx) {
  let profileName;
  if (typeof req.query.profile === 'string') {
    profileName = req.query.profile.trim() || void 0;
  }
  if (!profileName && req.body && typeof req.body === 'object') {
    const body = req.body;
    if (typeof body.profile === 'string') {
      profileName = body.profile.trim() || void 0;
    }
  }
  try {
    return ctx.forProfile(profileName);
  } catch (err) {
    return { error: String(err), status: 404 };
  }
}
function jsonError(res, status, message) {
  res.status(status).json({ error: message });
}
function toStringOrEmpty(value) {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
}
function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : void 0;
  }
  return void 0;
}
function toBoolean(value) {
  return parseBooleanValue(value, {
    truthy: ['true', '1', 'yes'],
    falsy: ['false', '0', 'no']
  });
}
function toStringArray(value) {
  if (!Array.isArray(value)) {
    return void 0;
  }
  const strings = value.map((v) => toStringOrEmpty(v)).filter(Boolean);
  return strings.length ? strings : void 0;
}
export {
  getProfileContext,
  jsonError,
  toBoolean,
  toNumber,
  toStringArray,
  toStringOrEmpty
};
