import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTempHome as withTempHomeBase } from '../../test/helpers/temp-home.js';
const runEmbeddedPiAgentMock = vi.fn();
vi.mock('../agents/model-fallback.js', () => ({
  runWithModelFallback: async ({
    provider,
    model,
    run
  }) => ({
    result: await run(provider, model),
    provider,
    model
  })
}));
vi.mock('../agents/pi-embedded.js', () => ({
  abortEmbeddedPiRun: vi.fn().mockReturnValue(false),
  runEmbeddedPiAgent: (params) => runEmbeddedPiAgentMock(params),
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
  resolveEmbeddedSessionLane: (key) => `session:${key.trim() || 'main'}`,
  isEmbeddedPiRunActive: vi.fn().mockReturnValue(false),
  isEmbeddedPiRunStreaming: vi.fn().mockReturnValue(false)
}));
const webMocks = vi.hoisted(() => ({
  webAuthExists: vi.fn().mockResolvedValue(true),
  getWebAuthAgeMs: vi.fn().mockReturnValue(12e4),
  readWebSelfId: vi.fn().mockReturnValue({ e164: '+1999' })
}));
vi.mock('../web/session.js', () => webMocks);
import { getReplyFromConfig } from './reply.js';
async function withTempHome(fn) {
  return withTempHomeBase(
    async (home) => {
      runEmbeddedPiAgentMock.mockClear();
      return await fn(home);
    },
    { prefix: 'openclaw-typing-' }
  );
}
function makeCfg(home) {
  return {
    agents: {
      defaults: {
        model: 'anthropic/claude-opus-4-5',
        workspace: join(home, 'openclaw')
      }
    },
    channels: {
      whatsapp: {
        allowFrom: ['*']
      }
    },
    session: { store: join(home, 'sessions.json') }
  };
}
afterEach(() => {
  vi.restoreAllMocks();
});
describe('getReplyFromConfig typing (heartbeat)', () => {
  it('starts typing for normal runs', async () => {
    await withTempHome(async (home) => {
      runEmbeddedPiAgentMock.mockResolvedValueOnce({
        payloads: [{ text: 'ok' }],
        meta: {}
      });
      const onReplyStart = vi.fn();
      await getReplyFromConfig(
        { Body: 'hi', From: '+1000', To: '+2000', Provider: 'whatsapp' },
        { onReplyStart, isHeartbeat: false },
        makeCfg(home)
      );
      expect(onReplyStart).toHaveBeenCalled();
    });
  });
  it('does not start typing for heartbeat runs', async () => {
    await withTempHome(async (home) => {
      runEmbeddedPiAgentMock.mockResolvedValueOnce({
        payloads: [{ text: 'ok' }],
        meta: {}
      });
      const onReplyStart = vi.fn();
      await getReplyFromConfig(
        { Body: 'hi', From: '+1000', To: '+2000', Provider: 'whatsapp' },
        { onReplyStart, isHeartbeat: true },
        makeCfg(home)
      );
      expect(onReplyStart).not.toHaveBeenCalled();
    });
  });
});
