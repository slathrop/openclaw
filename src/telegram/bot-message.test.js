const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { beforeEach, describe, expect, it, vi } from 'vitest';
const buildTelegramMessageContext = vi.hoisted(() => vi.fn());
const dispatchTelegramMessage = vi.hoisted(() => vi.fn());
vi.mock('./bot-message-context.js', () => ({
  buildTelegramMessageContext
}));
vi.mock('./bot-message-dispatch.js', () => ({
  dispatchTelegramMessage
}));
import { createTelegramMessageProcessor } from './bot-message.js';
describe('telegram bot message processor', () => {
  beforeEach(() => {
    buildTelegramMessageContext.mockReset();
    dispatchTelegramMessage.mockReset();
  });
  const baseDeps = {
    bot: {},
    cfg: {},
    account: {},
    telegramCfg: {},
    historyLimit: 0,
    groupHistories: {},
    dmPolicy: {},
    allowFrom: [],
    groupAllowFrom: [],
    ackReactionScope: 'none',
    logger: {},
    resolveGroupActivation: /* @__PURE__ */ __name(() => true, 'resolveGroupActivation'),
    resolveGroupRequireMention: /* @__PURE__ */ __name(() => false, 'resolveGroupRequireMention'),
    resolveTelegramGroupConfig: /* @__PURE__ */ __name(() => ({}), 'resolveTelegramGroupConfig'),
    runtime: {},
    replyToMode: 'auto',
    streamMode: 'auto',
    textLimit: 4096,
    opts: {},
    resolveBotTopicsEnabled: /* @__PURE__ */ __name(() => false, 'resolveBotTopicsEnabled')
  };
  it('dispatches when context is available', async () => {
    buildTelegramMessageContext.mockResolvedValue({ route: { sessionKey: 'agent:main:main' } });
    const processMessage = createTelegramMessageProcessor(baseDeps);
    await processMessage({ message: { chat: { id: 123 }, message_id: 456 } }, [], [], {});
    expect(dispatchTelegramMessage).toHaveBeenCalledTimes(1);
  });
  it('skips dispatch when no context is produced', async () => {
    buildTelegramMessageContext.mockResolvedValue(null);
    const processMessage = createTelegramMessageProcessor(baseDeps);
    await processMessage({ message: { chat: { id: 123 }, message_id: 456 } }, [], [], {});
    expect(dispatchTelegramMessage).not.toHaveBeenCalled();
  });
});
