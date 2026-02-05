import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleChatScroll, scheduleChatScroll, resetChatScroll } from './app-scroll.js';
function createScrollHost(overrides = {}) {
  const {
    scrollHeight = 2e3,
    scrollTop = 1500,
    clientHeight = 500,
    overflowY = 'auto'
  } = overrides;
  const container = {
    scrollHeight,
    scrollTop,
    clientHeight,
    style: { overflowY }
  };
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    overflowY
  });
  const host = {
    updateComplete: Promise.resolve(),
    querySelector: vi.fn().mockReturnValue(container),
    style: { setProperty: vi.fn() },
    chatScrollFrame: null,
    chatScrollTimeout: null,
    chatHasAutoScrolled: false,
    chatUserNearBottom: true,
    chatNewMessagesBelow: false,
    logsScrollFrame: null,
    logsAtBottom: true,
    topbarObserver: null
  };
  return { host, container };
}
function createScrollEvent(scrollHeight, scrollTop, clientHeight) {
  return {
    currentTarget: { scrollHeight, scrollTop, clientHeight }
  };
}
describe('handleChatScroll', () => {
  it('sets chatUserNearBottom=true when within the 450px threshold', () => {
    const { host } = createScrollHost({});
    const event = createScrollEvent(2e3, 1600, 400);
    handleChatScroll(host, event);
    expect(host.chatUserNearBottom).toBe(true);
  });
  it('sets chatUserNearBottom=true when distance is just under threshold', () => {
    const { host } = createScrollHost({});
    const event = createScrollEvent(2e3, 1151, 400);
    handleChatScroll(host, event);
    expect(host.chatUserNearBottom).toBe(true);
  });
  it('sets chatUserNearBottom=false when distance is exactly at threshold', () => {
    const { host } = createScrollHost({});
    const event = createScrollEvent(2e3, 1150, 400);
    handleChatScroll(host, event);
    expect(host.chatUserNearBottom).toBe(false);
  });
  it('sets chatUserNearBottom=false when scrolled well above threshold', () => {
    const { host } = createScrollHost({});
    const event = createScrollEvent(2e3, 500, 400);
    handleChatScroll(host, event);
    expect(host.chatUserNearBottom).toBe(false);
  });
  it('sets chatUserNearBottom=false when user scrolled up past one long message (>200px <450px)', () => {
    const { host } = createScrollHost({});
    const event = createScrollEvent(2e3, 1100, 400);
    handleChatScroll(host, event);
    expect(host.chatUserNearBottom).toBe(false);
  });
});
describe('scheduleChatScroll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it('scrolls to bottom when user is near bottom (no force)', async () => {
    const { host, container } = createScrollHost({
      scrollHeight: 2e3,
      scrollTop: 1600,
      clientHeight: 400
    });
    host.chatUserNearBottom = true;
    scheduleChatScroll(host);
    await host.updateComplete;
    expect(container.scrollTop).toBe(container.scrollHeight);
  });
  it('does NOT scroll when user is scrolled up and no force', async () => {
    const { host, container } = createScrollHost({
      scrollHeight: 2e3,
      scrollTop: 500,
      clientHeight: 400
    });
    host.chatUserNearBottom = false;
    const originalScrollTop = container.scrollTop;
    scheduleChatScroll(host);
    await host.updateComplete;
    expect(container.scrollTop).toBe(originalScrollTop);
  });
  it('does NOT scroll with force=true when user has explicitly scrolled up', async () => {
    const { host, container } = createScrollHost({
      scrollHeight: 2e3,
      scrollTop: 500,
      clientHeight: 400
    });
    host.chatUserNearBottom = false;
    host.chatHasAutoScrolled = true;
    const originalScrollTop = container.scrollTop;
    scheduleChatScroll(host, true);
    await host.updateComplete;
    expect(container.scrollTop).toBe(originalScrollTop);
  });
  it('DOES scroll with force=true on initial load (chatHasAutoScrolled=false)', async () => {
    const { host, container } = createScrollHost({
      scrollHeight: 2e3,
      scrollTop: 500,
      clientHeight: 400
    });
    host.chatUserNearBottom = false;
    host.chatHasAutoScrolled = false;
    scheduleChatScroll(host, true);
    await host.updateComplete;
    expect(container.scrollTop).toBe(container.scrollHeight);
  });
  it('sets chatNewMessagesBelow when not scrolling due to user position', async () => {
    const { host } = createScrollHost({
      scrollHeight: 2e3,
      scrollTop: 500,
      clientHeight: 400
    });
    host.chatUserNearBottom = false;
    host.chatHasAutoScrolled = true;
    host.chatNewMessagesBelow = false;
    scheduleChatScroll(host);
    await host.updateComplete;
    expect(host.chatNewMessagesBelow).toBe(true);
  });
});
describe('streaming scroll behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it('multiple rapid scheduleChatScroll calls do not scroll when user is scrolled up', async () => {
    const { host, container } = createScrollHost({
      scrollHeight: 2e3,
      scrollTop: 500,
      clientHeight: 400
    });
    host.chatUserNearBottom = false;
    host.chatHasAutoScrolled = true;
    const originalScrollTop = container.scrollTop;
    scheduleChatScroll(host);
    scheduleChatScroll(host);
    scheduleChatScroll(host);
    await host.updateComplete;
    expect(container.scrollTop).toBe(originalScrollTop);
  });
  it('streaming scrolls correctly when user IS at bottom', async () => {
    const { host, container } = createScrollHost({
      scrollHeight: 2e3,
      scrollTop: 1600,
      clientHeight: 400
    });
    host.chatUserNearBottom = true;
    host.chatHasAutoScrolled = true;
    scheduleChatScroll(host);
    await host.updateComplete;
    expect(container.scrollTop).toBe(container.scrollHeight);
  });
});
describe('resetChatScroll', () => {
  it('resets state for new chat session', () => {
    const { host } = createScrollHost({});
    host.chatHasAutoScrolled = true;
    host.chatUserNearBottom = false;
    resetChatScroll(host);
    expect(host.chatHasAutoScrolled).toBe(false);
    expect(host.chatUserNearBottom).toBe(true);
  });
});
