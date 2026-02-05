const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
const formatAge = /* @__PURE__ */ __name((ms) => {
  if (!ms || ms < 0) {
    return 'unknown';
  }
  const minutes = Math.round(ms / 6e4);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}, 'formatAge');
const formatDuration = /* @__PURE__ */ __name((ms) => {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) {
    return 'unknown';
  }
  if (ms < 1e3) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1e3).toFixed(1)}s`;
}, 'formatDuration');
function formatGatewayAuthUsed(auth) {
  const hasToken = Boolean(auth?.token?.trim());
  const hasPassword = Boolean(auth?.password?.trim());
  if (hasToken && hasPassword) {
    return 'token+password';
  }
  if (hasToken) {
    return 'token';
  }
  if (hasPassword) {
    return 'password';
  }
  return 'none';
}
__name(formatGatewayAuthUsed, 'formatGatewayAuthUsed');
function redactSecrets(text) {
  if (!text) {
    return text;
  }
  let out = text;
  out = out.replace(
    /(\b(?:access[_-]?token|refresh[_-]?token|token|password|secret|api[_-]?key)\b\s*[:=]\s*)("?)([^"\\s]+)("?)/gi,
    '$1$2***$4'
  );
  out = out.replace(/\bBearer\s+[A-Za-z0-9._-]+\b/g, 'Bearer ***');
  out = out.replace(/\bsk-[A-Za-z0-9]{10,}\b/g, 'sk-***');
  return out;
}
__name(redactSecrets, 'redactSecrets');
export {
  formatAge,
  formatDuration,
  formatGatewayAuthUsed,
  redactSecrets
};
