import {describe, expect, it, vi} from 'vitest';
import {wrapFetchWithAbortSignal} from './fetch.js';

describe('wrapFetchWithAbortSignal', () => {
  it('adds duplex for requests with a body', async () => {
    let seenInit;
    const fetchImpl = vi.fn(async (_input, init) => {
      seenInit = init;
      return {};
    });

    const wrapped = wrapFetchWithAbortSignal(fetchImpl);

    await wrapped('https://example.com', {method: 'POST', body: 'hi'});

    expect(seenInit?.duplex).toBe('half');
  });

  it('converts foreign abort signals to native controllers', async () => {
    let seenSignal;
    const fetchImpl = vi.fn(async (_input, init) => {
      seenSignal = init?.signal;
      return {};
    });

    const wrapped = wrapFetchWithAbortSignal(fetchImpl);

    let abortHandler = null;
    const fakeSignal = {
      aborted: false,
      addEventListener: (event, handler) => {
        if (event === 'abort') {
          abortHandler = handler;
        }
      },
      removeEventListener: (event, handler) => {
        if (event === 'abort' && abortHandler === handler) {
          abortHandler = null;
        }
      }
    };

    const promise = wrapped('https://example.com', {signal: fakeSignal});
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(seenSignal).toBeInstanceOf(AbortSignal);
    expect(seenSignal).not.toBe(fakeSignal);

    abortHandler?.();
    expect(seenSignal?.aborted).toBe(true);

    await promise;
  });
});
