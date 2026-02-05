import fs from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTempHome as withTempHomeBase } from '../../test/helpers/temp-home.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

vi.mock('../agents/pi-embedded.js', () => ({
  abortEmbeddedPiRun: vi.fn().mockReturnValue(false),
  compactEmbeddedPiSession: vi.fn(),
  runEmbeddedPiAgent: vi.fn(),
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
  resolveEmbeddedSessionLane: (key) => `session:${key.trim() || 'main'}`,
  isEmbeddedPiRunActive: vi.fn().mockReturnValue(false),
  isEmbeddedPiRunStreaming: vi.fn().mockReturnValue(false)
}));
const usageMocks = vi.hoisted(() => ({
  loadProviderUsageSummary: vi.fn().mockResolvedValue({
    updatedAt: 0,
    providers: []
  }),
  formatUsageSummaryLine: vi.fn().mockReturnValue('\u{1F4CA} Usage: Claude 80% left'),
  resolveUsageProviderId: vi.fn((provider) => provider.split('/')[0])
}));
vi.mock('../infra/provider-usage.js', () => usageMocks);
const modelCatalogMocks = vi.hoisted(() => ({
  loadModelCatalog: vi.fn().mockResolvedValue([
    {
      provider: 'anthropic',
      id: 'claude-opus-4-5',
      name: 'Claude Opus 4.5',
      contextWindow: 2e5
    },
    {
      provider: 'openrouter',
      id: 'anthropic/claude-opus-4-5',
      name: 'Claude Opus 4.5 (OpenRouter)',
      contextWindow: 2e5
    },
    { provider: 'openai', id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
    { provider: 'openai', id: 'gpt-5.2', name: 'GPT-5.2' },
    { provider: 'openai-codex', id: 'gpt-5.2', name: 'GPT-5.2 (Codex)' },
    { provider: 'minimax', id: 'MiniMax-M2.1', name: 'MiniMax M2.1' }
  ]),
  resetModelCatalogCacheForTest: vi.fn()
}));
vi.mock('../agents/model-catalog.js', () => modelCatalogMocks);
import { abortEmbeddedPiRun, runEmbeddedPiAgent } from '../agents/pi-embedded.js';
import { getReplyFromConfig } from './reply.js';
const MAIN_SESSION_KEY = 'agent:main:main';
const webMocks = vi.hoisted(() => ({
  webAuthExists: vi.fn().mockResolvedValue(true),
  getWebAuthAgeMs: vi.fn().mockReturnValue(12e4),
  readWebSelfId: vi.fn().mockReturnValue({ e164: '+1999' })
}));
vi.mock('../web/session.js', () => webMocks);
async function withTempHome(fn) {
  return withTempHomeBase(
    async (home) => {
      vi.mocked(runEmbeddedPiAgent).mockClear();
      vi.mocked(abortEmbeddedPiRun).mockClear();
      return await fn(home);
    },
    { prefix: 'openclaw-triggers-' }
  );
}
// eslint-disable-next-line no-unused-vars
function _makeCfg(home) {
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
describe('trigger handling', () => {
  it('allows approved sender to toggle elevated mode', async () => {
    await withTempHome(async (home) => {
      const cfg = {
        agents: {
          defaults: {
            model: 'anthropic/claude-opus-4-5',
            workspace: join(home, 'openclaw')
          }
        },
        tools: {
          elevated: {
            allowFrom: { whatsapp: ['+1000'] }
          }
        },
        channels: {
          whatsapp: {
            allowFrom: ['+1000']
          }
        },
        session: { store: join(home, 'sessions.json') }
      };
      const res = await getReplyFromConfig(
        {
          Body: '/elevated on',
          From: '+1000',
          To: '+2000',
          Provider: 'whatsapp',
          SenderE164: '+1000',
          CommandAuthorized: true
        },
        {},
        cfg
      );
      const text = Array.isArray(res) ? res[0]?.text : res?.text;
      expect(text).toContain('Elevated mode set to ask');
      const storeRaw = await fs.readFile(cfg.session.store, 'utf-8');
      const store = JSON.parse(storeRaw);
      expect(store[MAIN_SESSION_KEY]?.elevatedLevel).toBe('on');
    });
  });
  it('rejects elevated toggles when disabled', async () => {
    await withTempHome(async (home) => {
      const cfg = {
        agents: {
          defaults: {
            model: 'anthropic/claude-opus-4-5',
            workspace: join(home, 'openclaw')
          }
        },
        tools: {
          elevated: {
            enabled: false,
            allowFrom: { whatsapp: ['+1000'] }
          }
        },
        channels: {
          whatsapp: {
            allowFrom: ['+1000']
          }
        },
        session: { store: join(home, 'sessions.json') }
      };
      const res = await getReplyFromConfig(
        {
          Body: '/elevated on',
          From: '+1000',
          To: '+2000',
          Provider: 'whatsapp',
          SenderE164: '+1000'
        },
        {},
        cfg
      );
      const text = Array.isArray(res) ? res[0]?.text : res?.text;
      expect(text).toContain('tools.elevated.enabled');
      const storeRaw = await fs.readFile(cfg.session.store, 'utf-8');
      const store = JSON.parse(storeRaw);
      expect(store[MAIN_SESSION_KEY]?.elevatedLevel).toBeUndefined();
    });
  });
  it('ignores elevated directive in groups when not mentioned', async () => {
    await withTempHome(async (home) => {
      vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
        payloads: [{ text: 'ok' }],
        meta: {
          durationMs: 1,
          agentMeta: { sessionId: 's', provider: 'p', model: 'm' }
        }
      });
      const cfg = {
        agents: {
          defaults: {
            model: 'anthropic/claude-opus-4-5',
            workspace: join(home, 'openclaw')
          }
        },
        tools: {
          elevated: {
            allowFrom: { whatsapp: ['+1000'] }
          }
        },
        channels: {
          whatsapp: {
            allowFrom: ['+1000'],
            groups: { '*': { requireMention: false } }
          }
        },
        session: { store: join(home, 'sessions.json') }
      };
      const res = await getReplyFromConfig(
        {
          Body: '/elevated on',
          From: 'whatsapp:group:123@g.us',
          To: 'whatsapp:+2000',
          Provider: 'whatsapp',
          SenderE164: '+1000',
          ChatType: 'group',
          WasMentioned: false
        },
        {},
        cfg
      );
      const text = Array.isArray(res) ? res[0]?.text : res?.text;
      expect(text).toBe('ok');
      expect(text).not.toContain('Elevated mode set to ask');
    });
  });
});
