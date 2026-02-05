import { beforeEach, describe, expect, it, vi } from 'vitest';
const callGatewayMock = vi.fn();
vi.mock('../../gateway/call.js', () => ({
  callGateway: (opts) => callGatewayMock(opts)
}));
vi.mock('../../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: () => ({
      session: { scope: 'per-sender', mainKey: 'main' },
      tools: { agentToAgent: { enabled: false } }
    })
  };
});
import { createSessionsListTool } from './sessions-list-tool.js';
describe('sessions_list gating', () => {
  beforeEach(() => {
    callGatewayMock.mockReset();
    callGatewayMock.mockResolvedValue({
      path: '/tmp/sessions.json',
      sessions: [
        { key: 'agent:main:main', kind: 'direct' },
        { key: 'agent:other:main', kind: 'direct' }
      ]
    });
  });
  it('filters out other agents when tools.agentToAgent.enabled is false', async () => {
    const tool = createSessionsListTool({ agentSessionKey: 'agent:main:main' });
    const result = await tool.execute('call1', {});
    expect(result.details).toMatchObject({
      count: 1,
      sessions: [{ key: 'agent:main:main' }]
    });
  });
});
