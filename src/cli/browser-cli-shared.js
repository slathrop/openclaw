const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { callGatewayFromCli } from './gateway-rpc.js';
function normalizeQuery(query) {
  if (!query) {
    return void 0;
  }
  const out = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === void 0) {
      continue;
    }
    out[key] = String(value);
  }
  return Object.keys(out).length ? out : void 0;
}
__name(normalizeQuery, 'normalizeQuery');
async function callBrowserRequest(opts, params, extra) {
  const resolvedTimeoutMs = typeof extra?.timeoutMs === 'number' && Number.isFinite(extra.timeoutMs) ? Math.max(1, Math.floor(extra.timeoutMs)) : typeof opts.timeout === 'string' ? Number.parseInt(opts.timeout, 10) : void 0;
  const resolvedTimeout = typeof resolvedTimeoutMs === 'number' && Number.isFinite(resolvedTimeoutMs) ? resolvedTimeoutMs : void 0;
  const timeout = typeof resolvedTimeout === 'number' ? String(resolvedTimeout) : opts.timeout;
  const payload = await callGatewayFromCli(
    'browser.request',
    { ...opts, timeout },
    {
      method: params.method,
      path: params.path,
      query: normalizeQuery(params.query),
      body: params.body,
      timeoutMs: resolvedTimeout
    },
    { progress: extra?.progress }
  );
  if (payload === void 0) {
    throw new Error('Unexpected browser.request response');
  }
  return payload;
}
__name(callBrowserRequest, 'callBrowserRequest');
export {
  callBrowserRequest
};
