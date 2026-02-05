import { describe, expect, it } from 'vitest';
import { buildThreadingToolContext } from './agent-runner-utils.js';
describe('buildThreadingToolContext', () => {
  const cfg = {};
  it('uses conversation id for WhatsApp', () => {
    const sessionCtx = {
      Provider: 'whatsapp',
      From: '123@g.us',
      To: '+15550001'
    };
    const result = buildThreadingToolContext({
      sessionCtx,
      config: cfg,
      hasRepliedRef: void 0
    });
    expect(result.currentChannelId).toBe('123@g.us');
  });
  it('falls back to To for WhatsApp when From is missing', () => {
    const sessionCtx = {
      Provider: 'whatsapp',
      To: '+15550001'
    };
    const result = buildThreadingToolContext({
      sessionCtx,
      config: cfg,
      hasRepliedRef: void 0
    });
    expect(result.currentChannelId).toBe('+15550001');
  });
  it('uses the recipient id for other channels', () => {
    const sessionCtx = {
      Provider: 'telegram',
      From: 'user:42',
      To: 'chat:99'
    };
    const result = buildThreadingToolContext({
      sessionCtx,
      config: cfg,
      hasRepliedRef: void 0
    });
    expect(result.currentChannelId).toBe('chat:99');
  });
  it('uses the sender handle for iMessage direct chats', () => {
    const sessionCtx = {
      Provider: 'imessage',
      ChatType: 'direct',
      From: 'imessage:+15550001',
      To: 'chat_id:12'
    };
    const result = buildThreadingToolContext({
      sessionCtx,
      config: cfg,
      hasRepliedRef: void 0
    });
    expect(result.currentChannelId).toBe('imessage:+15550001');
  });
  it('uses chat_id for iMessage groups', () => {
    const sessionCtx = {
      Provider: 'imessage',
      ChatType: 'group',
      From: 'imessage:group:7',
      To: 'chat_id:7'
    };
    const result = buildThreadingToolContext({
      sessionCtx,
      config: cfg,
      hasRepliedRef: void 0
    });
    expect(result.currentChannelId).toBe('chat_id:7');
  });
  it('prefers MessageThreadId for Slack tool threading', () => {
    const sessionCtx = {
      Provider: 'slack',
      To: 'channel:C1',
      MessageThreadId: '123.456'
    };
    const result = buildThreadingToolContext({
      sessionCtx,
      config: { channels: { slack: { replyToMode: 'all' } } },
      hasRepliedRef: void 0
    });
    expect(result.currentChannelId).toBe('C1');
    expect(result.currentThreadTs).toBe('123.456');
  });
});
