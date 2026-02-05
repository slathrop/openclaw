import { formatCliCommand } from '../cli/command-format.js';
import { ensurePageState, getPageForTargetId } from './pw-session.js';
import { normalizeTimeoutMs } from './pw-tools-core.shared.js';
function matchUrlPattern(pattern, url) {
  const p = pattern.trim();
  if (!p) {
    return false;
  }
  if (p === url) {
    return true;
  }
  if (p.includes('*')) {
    const escaped = p.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    const regex = new RegExp(`^${escaped.replace(/\*\*/g, '.*').replace(/\*/g, '.*')}$`);
    return regex.test(url);
  }
  return url.includes(p);
}
async function responseBodyViaPlaywright(opts) {
  const pattern = String(opts.url ?? '').trim();
  if (!pattern) {
    throw new Error('url is required');
  }
  const maxChars = typeof opts.maxChars === 'number' && Number.isFinite(opts.maxChars) ? Math.max(1, Math.min(5e6, Math.floor(opts.maxChars))) : 2e5;
  const timeout = normalizeTimeoutMs(opts.timeoutMs, 2e4);
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const promise = new Promise((resolve, reject) => {
    let done = false;
    let timer;
    // eslint-disable-next-line prefer-const -- circular reference: used in cleanup before assignment
    let handler;
    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = void 0;
      if (handler) {
        page.off('response', handler);
      }
    };
    handler = (resp2) => {
      if (done) {
        return;
      }
      const r = resp2;
      const u = r.url?.() || '';
      if (!matchUrlPattern(pattern, u)) {
        return;
      }
      done = true;
      cleanup();
      resolve(resp2);
    };
    page.on('response', handler);
    timer = setTimeout(() => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      reject(
        new Error(
          `Response not found for url pattern "${pattern}". Run '${formatCliCommand('openclaw browser requests')}' to inspect recent network activity.`
        )
      );
    }, timeout);
  });
  const resp = await promise;
  const url = resp.url?.() || '';
  const status = resp.status?.();
  const headers = resp.headers?.();
  let bodyText = '';
  try {
    if (typeof resp.text === 'function') {
      bodyText = await resp.text();
    } else if (typeof resp.body === 'function') {
      const buf = await resp.body();
      bodyText = new TextDecoder('utf-8').decode(buf);
    }
  } catch (err) {
    throw new Error(`Failed to read response body for "${url}": ${String(err)}`, { cause: err });
  }
  const trimmed = bodyText.length > maxChars ? bodyText.slice(0, maxChars) : bodyText;
  return {
    url,
    status,
    headers,
    body: trimmed,
    truncated: bodyText.length > maxChars ? true : void 0
  };
}
export {
  responseBodyViaPlaywright
};
