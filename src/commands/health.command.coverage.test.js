import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePluginRegistry } from '../plugins/runtime.js';
import { stripAnsi } from '../terminal/ansi.js';
import { createTestRegistry } from '../test-utils/channel-plugins.js';
import { healthCommand } from './health.js';
const callGatewayMock = vi.fn();
const logWebSelfIdMock = vi.fn();
vi.mock('../gateway/call.js', () => ({
  callGateway: (...args) => callGatewayMock(...args)
}));
vi.mock('../web/auth-store.js', () => ({
  webAuthExists: vi.fn(async () => true),
  getWebAuthAgeMs: vi.fn(() => 0),
  logWebSelfId: (...args) => logWebSelfIdMock(...args)
}));
describe('healthCommand (coverage)', () => {
  const runtime = {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn()
  };
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePluginRegistry(
      createTestRegistry([
        {
          pluginId: 'whatsapp',
          source: 'test',
          plugin: {
            id: 'whatsapp',
            meta: {
              id: 'whatsapp',
              label: 'WhatsApp',
              selectionLabel: 'WhatsApp',
              docsPath: '/channels/whatsapp',
              blurb: 'WhatsApp test stub.'
            },
            capabilities: { chatTypes: ['direct', 'group'] },
            config: {
              listAccountIds: () => ['default'],
              resolveAccount: () => ({})
            },
            status: {
              logSelfId: () => logWebSelfIdMock()
            }
          }
        }
      ])
    );
  });
  it('prints the rich text summary when linked and configured', async () => {
    callGatewayMock.mockResolvedValueOnce({
      ok: true,
      ts: Date.now(),
      durationMs: 5,
      channels: {
        whatsapp: {
          accountId: 'default',
          linked: true,
          authAgeMs: 5 * 6e4
        },
        telegram: {
          accountId: 'default',
          configured: true,
          probe: {
            ok: true,
            elapsedMs: 7,
            bot: { username: 'bot' },
            webhook: { url: 'https://example.com/h' }
          }
        },
        discord: {
          accountId: 'default',
          configured: false
        }
      },
      channelOrder: ['whatsapp', 'telegram', 'discord'],
      channelLabels: {
        whatsapp: 'WhatsApp',
        telegram: 'Telegram',
        discord: 'Discord'
      },
      heartbeatSeconds: 60,
      defaultAgentId: 'main',
      agents: [
        {
          agentId: 'main',
          isDefault: true,
          heartbeat: {
            enabled: true,
            every: '1m',
            everyMs: 6e4,
            prompt: 'hi',
            target: 'last',
            ackMaxChars: 160
          },
          sessions: {
            path: '/tmp/sessions.json',
            count: 2,
            recent: [
              { key: 'main', updatedAt: Date.now() - 6e4, age: 6e4 },
              { key: 'foo', updatedAt: null, age: null }
            ]
          }
        }
      ],
      sessions: {
        path: '/tmp/sessions.json',
        count: 2,
        recent: [
          { key: 'main', updatedAt: Date.now() - 6e4, age: 6e4 },
          { key: 'foo', updatedAt: null, age: null }
        ]
      }
    });
    await healthCommand({ json: false, timeoutMs: 1e3 }, runtime);
    expect(runtime.exit).not.toHaveBeenCalled();
    expect(stripAnsi(runtime.log.mock.calls.map((c) => String(c[0])).join('\n'))).toMatch(
      /WhatsApp: linked/i
    );
    expect(logWebSelfIdMock).toHaveBeenCalled();
  });
});
