const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { wrapFetchWithAbortSignal } from '../infra/fetch.js';
function makeProxyFetch(proxyUrl) {
  const agent = new ProxyAgent(proxyUrl);
  const fetcher = /* @__PURE__ */ __name(((input, init) => undiciFetch(input, {
    ...init,
    dispatcher: agent
  })), 'fetcher');
  return wrapFetchWithAbortSignal(fetcher);
}
__name(makeProxyFetch, 'makeProxyFetch');
export {
  makeProxyFetch
};
