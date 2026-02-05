import { beforeEach, describe, expect, it, vi } from 'vitest';
const callGatewayMock = vi.fn();
vi.mock('../gateway/call.js', () => ({
  callGateway: (opts) => callGatewayMock(opts)
}));
let configOverride = {
  session: {
    mainKey: 'main',
    scope: 'per-sender'
  }
};
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: () => configOverride,
    resolveGatewayPort: () => 18789
  };
});
import './test-helpers/fast-core-tools.js';
import { sleep } from '../utils.js';
import { createOpenClawTools } from './openclaw-tools.js';
import { resetSubagentRegistryForTests } from './subagent-registry.js';
describe('openclaw-tools: subagents', () => {
  beforeEach(() => {
    configOverride = {
      session: {
        mainKey: 'main',
        scope: 'per-sender'
      }
    };
  });
  it('sessions_spawn deletes session when cleanup=delete via agent.wait', async () => {
    resetSubagentRegistryForTests();
    callGatewayMock.mockReset();
    const calls = [];
    let agentCallCount = 0;
    let deletedKey;
    let childRunId;
    let childSessionKey;
    const waitCalls = [];
    callGatewayMock.mockImplementation(async (opts) => {
      const request = opts;
      calls.push(request);
      if (request.method === 'agent') {
        agentCallCount += 1;
        const runId = `run-${agentCallCount}`;
        const params = request.params;
        if (params?.lane === 'subagent') {
          childRunId = runId;
          childSessionKey = params?.sessionKey ?? '';
          expect(params?.channel).toBe('discord');
          expect(params?.timeout).toBe(1);
        }
        return {
          runId,
          status: 'accepted',
          acceptedAt: 2e3 + agentCallCount
        };
      }
      if (request.method === 'agent.wait') {
        const params = request.params;
        waitCalls.push(params ?? {});
        return {
          runId: params?.runId ?? 'run-1',
          status: 'ok',
          startedAt: 3e3,
          endedAt: 4e3
        };
      }
      if (request.method === 'sessions.delete') {
        const params = request.params;
        deletedKey = params?.key;
        return { ok: true };
      }
      return {};
    });
    const tool = createOpenClawTools({
      agentSessionKey: 'discord:group:req',
      agentChannel: 'discord'
    }).find((candidate) => candidate.name === 'sessions_spawn');
    if (!tool) {
      throw new Error('missing sessions_spawn tool');
    }
    const result = await tool.execute('call1b', {
      task: 'do thing',
      runTimeoutSeconds: 1,
      cleanup: 'delete'
    });
    expect(result.details).toMatchObject({
      status: 'accepted',
      runId: 'run-1'
    });
    await sleep(0);
    await sleep(0);
    await sleep(0);
    const childWait = waitCalls.find((call) => call.runId === childRunId);
    expect(childWait?.timeoutMs).toBe(1e3);
    expect(childSessionKey?.startsWith('agent:main:subagent:')).toBe(true);
    const agentCalls = calls.filter((call) => call.method === 'agent');
    expect(agentCalls).toHaveLength(2);
    const first = agentCalls[0]?.params;
    expect(first?.lane).toBe('subagent');
    const second = agentCalls[1]?.params;
    expect(second?.sessionKey).toBe('discord:group:req');
    expect(second?.deliver).toBe(true);
    const sendCalls = calls.filter((c) => c.method === 'send');
    expect(sendCalls.length).toBe(0);
    expect(deletedKey?.startsWith('agent:main:subagent:')).toBe(true);
  });
});
