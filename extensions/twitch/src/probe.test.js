import { beforeEach, describe, expect, it, vi } from 'vitest';
import { probeTwitch } from './probe.js';
const mockUnbind = vi.fn();
let connectHandler = null;
let disconnectHandler = null;
const mockOnConnect = vi.fn((handler) => {
  connectHandler = handler;
  return { unbind: mockUnbind };
});
const mockOnDisconnect = vi.fn((handler) => {
  disconnectHandler = handler;
  return { unbind: mockUnbind };
});
const mockOnAuthenticationFailure = vi.fn((_handler) => {
  return { unbind: mockUnbind };
});
const defaultConnectImpl = async () => {
  if (connectHandler) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    connectHandler();
  }
};
const mockConnect = vi.fn().mockImplementation(defaultConnectImpl);
const mockQuit = vi.fn().mockResolvedValue(void 0);
vi.mock('@twurple/chat', () => ({
  ChatClient: class {
    connect = mockConnect;
    quit = mockQuit;
    onConnect = mockOnConnect;
    onDisconnect = mockOnDisconnect;
    onAuthenticationFailure = mockOnAuthenticationFailure;
  }
}));
vi.mock('@twurple/auth', () => ({
  StaticAuthProvider: class {
  }
}));
describe('probeTwitch', () => {
  const mockAccount = {
    username: 'testbot',
    token: 'oauth:test123456789',
    channel: 'testchannel'
  };
  beforeEach(() => {
    vi.clearAllMocks();
    connectHandler = null;
    disconnectHandler = null;
  });
  it('returns error when username is missing', async () => {
    const account = { ...mockAccount, username: '' };
    const result = await probeTwitch(account, 5e3);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('missing credentials');
  });
  it('returns error when token is missing', async () => {
    const account = { ...mockAccount, token: '' };
    const result = await probeTwitch(account, 5e3);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('missing credentials');
  });
  it('attempts connection regardless of token prefix', async () => {
    const account = { ...mockAccount, token: 'raw_token_no_prefix' };
    const result = await probeTwitch(account, 5e3);
    expect(result.ok).toBe(true);
  });
  it('successfully connects with valid credentials', async () => {
    const result = await probeTwitch(mockAccount, 5e3);
    expect(result.ok).toBe(true);
    expect(result.connected).toBe(true);
    expect(result.username).toBe('testbot');
    expect(result.channel).toBe('testchannel');
  });
  it('uses custom channel when specified', async () => {
    const account = {
      ...mockAccount,
      channel: 'customchannel'
    };
    const result = await probeTwitch(account, 5e3);
    expect(result.ok).toBe(true);
    expect(result.channel).toBe('customchannel');
  });
  it('times out when connection takes too long', async () => {
    mockConnect.mockImplementationOnce(() => new Promise(() => {
    }));
    const result = await probeTwitch(mockAccount, 100);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('timeout');
    mockConnect.mockImplementation(defaultConnectImpl);
  });
  it('cleans up client even on failure', async () => {
    mockConnect.mockImplementationOnce(async () => {
      if (disconnectHandler) {
        await new Promise((resolve) => setTimeout(resolve, 1));
        disconnectHandler(false, new Error('Connection failed'));
      }
    });
    const result = await probeTwitch(mockAccount, 5e3);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Connection failed');
    expect(mockQuit).toHaveBeenCalled();
    mockConnect.mockImplementation(defaultConnectImpl);
  });
  it('handles connection errors gracefully', async () => {
    mockConnect.mockImplementationOnce(async () => {
      if (disconnectHandler) {
        await new Promise((resolve) => setTimeout(resolve, 1));
        disconnectHandler(false, new Error('Network error'));
      }
    });
    const result = await probeTwitch(mockAccount, 5e3);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Network error');
    mockConnect.mockImplementation(defaultConnectImpl);
  });
  it('trims token before validation', async () => {
    const account = {
      ...mockAccount,
      token: '  oauth:test123456789  '
    };
    const result = await probeTwitch(account, 5e3);
    expect(result.ok).toBe(true);
  });
  it('handles non-Error objects in catch block', async () => {
    mockConnect.mockImplementationOnce(async () => {
      if (disconnectHandler) {
        await new Promise((resolve) => setTimeout(resolve, 1));
        disconnectHandler(false, 'String error');
      }
    });
    const result = await probeTwitch(mockAccount, 5e3);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('String error');
    mockConnect.mockImplementation(defaultConnectImpl);
  });
});
