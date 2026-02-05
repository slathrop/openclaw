import { describe, expect, it, vi } from 'vitest';
import { signalMessageActions } from './signal.js';
const sendReactionSignal = vi.fn(async () => ({ ok: true }));
const removeReactionSignal = vi.fn(async () => ({ ok: true }));
vi.mock('../../../signal/send-reactions.js', () => ({
  sendReactionSignal: (...args) => sendReactionSignal(...args),
  removeReactionSignal: (...args) => removeReactionSignal(...args)
}));
describe('signalMessageActions', () => {
  it('returns no actions when no configured accounts exist', () => {
    const cfg = {};
    expect(signalMessageActions.listActions({ cfg })).toEqual([]);
  });
  it('hides react when reactions are disabled', () => {
    const cfg = {
      channels: { signal: { account: '+15550001111', actions: { reactions: false } } }
    };
    expect(signalMessageActions.listActions({ cfg })).toEqual(['send']);
  });
  it('enables react when at least one account allows reactions', () => {
    const cfg = {
      channels: {
        signal: {
          actions: { reactions: false },
          accounts: {
            work: { account: '+15550001111', actions: { reactions: true } }
          }
        }
      }
    };
    expect(signalMessageActions.listActions({ cfg })).toEqual(['send', 'react']);
  });
  it('skips send for plugin dispatch', () => {
    expect(signalMessageActions.supportsAction?.({ action: 'send' })).toBe(false);
    expect(signalMessageActions.supportsAction?.({ action: 'react' })).toBe(true);
  });
  it('blocks reactions when action gate is disabled', async () => {
    const cfg = {
      channels: { signal: { account: '+15550001111', actions: { reactions: false } } }
    };
    await expect(
      signalMessageActions.handleAction({
        action: 'react',
        params: { to: '+15550001111', messageId: '123', emoji: '\u2705' },
        cfg,
        accountId: void 0
      })
    ).rejects.toThrow(/actions\.reactions/);
  });
  it('uses account-level actions when enabled', async () => {
    sendReactionSignal.mockClear();
    const cfg = {
      channels: {
        signal: {
          actions: { reactions: false },
          accounts: {
            work: { account: '+15550001111', actions: { reactions: true } }
          }
        }
      }
    };
    await signalMessageActions.handleAction({
      action: 'react',
      params: { to: '+15550001111', messageId: '123', emoji: '\u{1F44D}' },
      cfg,
      accountId: 'work'
    });
    expect(sendReactionSignal).toHaveBeenCalledWith('+15550001111', 123, '\u{1F44D}', {
      accountId: 'work'
    });
  });
  it('normalizes uuid recipients', async () => {
    sendReactionSignal.mockClear();
    const cfg = {
      channels: { signal: { account: '+15550001111' } }
    };
    await signalMessageActions.handleAction({
      action: 'react',
      params: {
        recipient: 'uuid:123e4567-e89b-12d3-a456-426614174000',
        messageId: '123',
        emoji: '\u{1F525}'
      },
      cfg,
      accountId: void 0
    });
    expect(sendReactionSignal).toHaveBeenCalledWith(
      '123e4567-e89b-12d3-a456-426614174000',
      123,
      '\u{1F525}',
      { accountId: void 0 }
    );
  });
  it('requires targetAuthor for group reactions', async () => {
    const cfg = {
      channels: { signal: { account: '+15550001111' } }
    };
    await expect(
      signalMessageActions.handleAction({
        action: 'react',
        params: { to: 'signal:group:group-id', messageId: '123', emoji: '\u2705' },
        cfg,
        accountId: void 0
      })
    ).rejects.toThrow(/targetAuthor/);
  });
  it('passes groupId and targetAuthor for group reactions', async () => {
    sendReactionSignal.mockClear();
    const cfg = {
      channels: { signal: { account: '+15550001111' } }
    };
    await signalMessageActions.handleAction({
      action: 'react',
      params: {
        to: 'signal:group:group-id',
        targetAuthor: 'uuid:123e4567-e89b-12d3-a456-426614174000',
        messageId: '123',
        emoji: '\u2705'
      },
      cfg,
      accountId: void 0
    });
    expect(sendReactionSignal).toHaveBeenCalledWith('', 123, '\u2705', {
      accountId: void 0,
      groupId: 'group-id',
      targetAuthor: 'uuid:123e4567-e89b-12d3-a456-426614174000',
      targetAuthorUuid: void 0
    });
  });
});
