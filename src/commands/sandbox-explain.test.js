const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { describe, expect, it, vi } from 'vitest';
let mockCfg = {};
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: vi.fn().mockImplementation(() => mockCfg)
  };
});
describe('sandbox explain command', () => {
  it('prints JSON shape + fix-it keys', async () => {
    mockCfg = {
      agents: {
        defaults: {
          sandbox: { mode: 'all', scope: 'agent', workspaceAccess: 'none' }
        }
      },
      tools: {
        sandbox: { tools: { deny: ['browser'] } },
        elevated: { enabled: true, allowFrom: { whatsapp: ['*'] } }
      },
      session: { store: '/tmp/openclaw-test-sessions-{agentId}.json' }
    };
    const { sandboxExplainCommand } = await import('./sandbox-explain.js');
    const logs = [];
    await sandboxExplainCommand({ json: true, session: 'agent:main:main' }, {
      log: /* @__PURE__ */ __name((msg) => logs.push(msg), 'log'),
      error: /* @__PURE__ */ __name((msg) => logs.push(msg), 'error'),
      // eslint-disable-next-line no-unused-vars
      exit: /* @__PURE__ */ __name((_code) => {
      }, 'exit')
    });
    const out = logs.join('');
    const parsed = JSON.parse(out);
    expect(parsed).toHaveProperty('docsUrl', 'https://docs.openclaw.ai/sandbox');
    expect(parsed).toHaveProperty('sandbox.mode', 'all');
    expect(parsed).toHaveProperty('sandbox.tools.sources.allow.source');
    expect(Array.isArray(parsed.fixIt)).toBe(true);
    expect(parsed.fixIt).toContain('agents.defaults.sandbox.mode=off');
    expect(parsed.fixIt).toContain('tools.sandbox.tools.deny');
  }, 15e3);
});
