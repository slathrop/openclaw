import { vi } from 'vitest';
function createMockTypingController(overrides = {}) {
  return {
    onReplyStart: vi.fn(async () => {
    }),
    startTypingLoop: vi.fn(async () => {
    }),
    startTypingOnText: vi.fn(async () => {
    }),
    refreshTypingTtl: vi.fn(),
    isActive: vi.fn(() => false),
    markRunComplete: vi.fn(),
    markDispatchIdle: vi.fn(),
    cleanup: vi.fn(),
    ...overrides
  };
}
export {
  createMockTypingController
};
