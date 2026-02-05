import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { wrapFetchWithAbortSignal } from '../infra/fetch.js';
function makeProxyFetch(proxyUrl) {
  const agent = new ProxyAgent(proxyUrl);
  const fetcher = ((input, init) => undiciFetch(input, {
    ...init,
    dispatcher: agent
  }));
  return wrapFetchWithAbortSignal(fetcher);
}
export {
  makeProxyFetch
};
