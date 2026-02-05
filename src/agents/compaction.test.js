import { describe, expect, it } from 'vitest';
import {
  estimateMessagesTokens,
  pruneHistoryForContextShare,
  splitMessagesByTokenShare
} from './compaction.js';
function makeMessage(id, size) {
  return {
    role: 'user',
    content: 'x'.repeat(size),
    timestamp: id
  };
}
describe('splitMessagesByTokenShare', () => {
  it('splits messages into two non-empty parts', () => {
    const messages = [
      makeMessage(1, 4e3),
      makeMessage(2, 4e3),
      makeMessage(3, 4e3),
      makeMessage(4, 4e3)
    ];
    const parts = splitMessagesByTokenShare(messages, 2);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts[0]?.length).toBeGreaterThan(0);
    expect(parts[1]?.length).toBeGreaterThan(0);
    expect(parts.flat().length).toBe(messages.length);
  });
  it('preserves message order across parts', () => {
    const messages = [
      makeMessage(1, 4e3),
      makeMessage(2, 4e3),
      makeMessage(3, 4e3),
      makeMessage(4, 4e3),
      makeMessage(5, 4e3),
      makeMessage(6, 4e3)
    ];
    const parts = splitMessagesByTokenShare(messages, 3);
    expect(parts.flat().map((msg) => msg.timestamp)).toEqual(messages.map((msg) => msg.timestamp));
  });
});
describe('pruneHistoryForContextShare', () => {
  it('drops older chunks until the history budget is met', () => {
    const messages = [
      makeMessage(1, 4e3),
      makeMessage(2, 4e3),
      makeMessage(3, 4e3),
      makeMessage(4, 4e3)
    ];
    const maxContextTokens = 2e3;
    const pruned = pruneHistoryForContextShare({
      messages,
      maxContextTokens,
      maxHistoryShare: 0.5,
      parts: 2
    });
    expect(pruned.droppedChunks).toBeGreaterThan(0);
    expect(pruned.keptTokens).toBeLessThanOrEqual(Math.floor(maxContextTokens * 0.5));
    expect(pruned.messages.length).toBeGreaterThan(0);
  });
  it('keeps the newest messages when pruning', () => {
    const messages = [
      makeMessage(1, 4e3),
      makeMessage(2, 4e3),
      makeMessage(3, 4e3),
      makeMessage(4, 4e3),
      makeMessage(5, 4e3),
      makeMessage(6, 4e3)
    ];
    const totalTokens = estimateMessagesTokens(messages);
    const maxContextTokens = Math.max(1, Math.floor(totalTokens * 0.5));
    const pruned = pruneHistoryForContextShare({
      messages,
      maxContextTokens,
      maxHistoryShare: 0.5,
      parts: 2
    });
    const keptIds = pruned.messages.map((msg) => msg.timestamp);
    const expectedSuffix = messages.slice(-keptIds.length).map((msg) => msg.timestamp);
    expect(keptIds).toEqual(expectedSuffix);
  });
  it('keeps history when already within budget', () => {
    const messages = [makeMessage(1, 1e3)];
    const maxContextTokens = 2e3;
    const pruned = pruneHistoryForContextShare({
      messages,
      maxContextTokens,
      maxHistoryShare: 0.5,
      parts: 2
    });
    expect(pruned.droppedChunks).toBe(0);
    expect(pruned.messages.length).toBe(messages.length);
    expect(pruned.keptTokens).toBe(estimateMessagesTokens(messages));
    expect(pruned.droppedMessagesList).toEqual([]);
  });
  it('returns droppedMessagesList containing dropped messages', () => {
    const messages = [
      makeMessage(1, 4e3),
      makeMessage(2, 4e3),
      makeMessage(3, 4e3),
      makeMessage(4, 4e3)
    ];
    const maxContextTokens = 2e3;
    const pruned = pruneHistoryForContextShare({
      messages,
      maxContextTokens,
      maxHistoryShare: 0.5,
      parts: 2
    });
    expect(pruned.droppedChunks).toBeGreaterThan(0);
    expect(pruned.droppedMessagesList.length).toBe(pruned.droppedMessages);
    const allIds = [
      ...pruned.droppedMessagesList.map((m) => m.timestamp),
      ...pruned.messages.map((m) => m.timestamp)
    ].toSorted((a, b) => a - b);
    const originalIds = messages.map((m) => m.timestamp).toSorted((a, b) => a - b);
    expect(allIds).toEqual(originalIds);
  });
  it('returns empty droppedMessagesList when no pruning needed', () => {
    const messages = [makeMessage(1, 100)];
    const pruned = pruneHistoryForContextShare({
      messages,
      maxContextTokens: 1e5,
      maxHistoryShare: 0.5,
      parts: 2
    });
    expect(pruned.droppedChunks).toBe(0);
    expect(pruned.droppedMessagesList).toEqual([]);
    expect(pruned.messages.length).toBe(1);
  });
});
