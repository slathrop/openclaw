/**
 * Fetch wrapper with abort signal bridging and duplex support.
 *
 * Wraps the native fetch to automatically set `duplex: "half"` for
 * request bodies and bridge foreign abort signals to native AbortControllers.
 */

/**
 * Adds duplex: "half" to request init when a body is present.
 * @param {RequestInit | undefined} init
 * @param {RequestInfo | URL} input
 * @returns {RequestInit | undefined}
 */
function withDuplex(init, input) {
  const hasInitBody = init?.body !== null && init?.body !== undefined;
  const hasRequestBody =
    !hasInitBody &&
    typeof Request !== 'undefined' &&
    input instanceof Request &&
    input.body !== null &&
    input.body !== undefined;
  if (!hasInitBody && !hasRequestBody) {
    return init;
  }
  if (init && 'duplex' in init) {
    return init;
  }
  return init
    ? {...init, duplex: 'half'}
    : {duplex: 'half'};
}

/**
 * Wraps a fetch implementation with abort signal bridging.
 *
 * Converts foreign (non-native) abort signals into native AbortController
 * signals so that fetch implementations that only support native signals
 * still respect external cancellation.
 * @param {typeof fetch} fetchImpl
 * @returns {typeof fetch}
 */
export function wrapFetchWithAbortSignal(fetchImpl) {
  const wrapped = (input, init) => {
    const patchedInit = withDuplex(init, input);
    const signal = patchedInit?.signal;
    if (!signal) {
      return fetchImpl(input, patchedInit);
    }
    if (typeof AbortSignal !== 'undefined' && signal instanceof AbortSignal) {
      return fetchImpl(input, patchedInit);
    }
    if (typeof AbortController === 'undefined') {
      return fetchImpl(input, patchedInit);
    }
    if (typeof signal.addEventListener !== 'function') {
      return fetchImpl(input, patchedInit);
    }
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', onAbort, {once: true});
    }
    const response = fetchImpl(input, {...patchedInit, signal: controller.signal});
    if (typeof signal.removeEventListener === 'function') {
      void response.finally(() => {
        signal.removeEventListener('abort', onAbort);
      });
    }
    return response;
  };

  wrapped.preconnect =
    typeof fetchImpl.preconnect === 'function'
      ? fetchImpl.preconnect.bind(fetchImpl)
      : () => {};

  return Object.assign(wrapped, fetchImpl);
}

/**
 * Resolves a fetch implementation, applying abort signal wrapping.
 * @param {typeof fetch} [fetchImpl]
 * @returns {typeof fetch | undefined}
 */
export function resolveFetch(fetchImpl) {
  const resolved = fetchImpl ?? globalThis.fetch;
  if (!resolved) {
    return undefined;
  }
  return wrapFetchWithAbortSignal(resolved);
}
