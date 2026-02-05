import { describe, expect, it, vi } from 'vitest';
import { createSlackThreadTsResolver } from './thread-resolution.js';
describe('createSlackThreadTsResolver', () => {
  it('caches resolved thread_ts lookups', async () => {
    const historyMock = vi.fn().mockResolvedValue({
      messages: [{ ts: '1', thread_ts: '9' }]
    });
    const resolver = createSlackThreadTsResolver({
      // oxlint-disable-next-line typescript/no-explicit-any
      client: { conversations: { history: historyMock } },
      cacheTtlMs: 6e4,
      maxSize: 5
    });
    const message = {
      channel: 'C1',
      parent_user_id: 'U2',
      ts: '1'
    };
    const first = await resolver.resolve({ message, source: 'message' });
    const second = await resolver.resolve({ message, source: 'message' });
    expect(first.thread_ts).toBe('9');
    expect(second.thread_ts).toBe('9');
    expect(historyMock).toHaveBeenCalledTimes(1);
  });
});
