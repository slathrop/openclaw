import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sleep } from '../utils.js';
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
import { emitAgentEvent } from '../infra/agent-events.js';
import './test-helpers/fast-core-tools.js';
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
  it('sessions_spawn runs cleanup flow after subagent completion', async () => {
    resetSubagentRegistryForTests();
    callGatewayMock.mockReset();
    const calls = [];
    let agentCallCount = 0;
    let childRunId;
    let childSessionKey;
    const waitCalls = [];
    let patchParams = {};
    callGatewayMock.mockImplementation(async (opts) => {
      const request = opts;
      calls.push(request);
      if (request.method === 'sessions.list') {
        return {
          sessions: [
            {
              key: 'main',
              lastChannel: 'whatsapp',
              lastTo: '+123'
            }
          ]
        };
      }
      if (request.method === 'agent') {
        agentCallCount += 1;
        const runId = `run-${agentCallCount}`;
        const params = request.params;
        if (params?.lane === 'subagent') {
          childRunId = runId;
          childSessionKey = params?.sessionKey ?? '';
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
          startedAt: 1e3,
          endedAt: 2e3
        };
      }
      if (request.method === 'sessions.patch') {
        const params = request.params;
        patchParams = { key: params?.key, label: params?.label };
        return { ok: true };
      }
      if (request.method === 'sessions.delete') {
        return { ok: true };
      }
      return {};
    });
    const tool = createOpenClawTools({
      agentSessionKey: 'main',
      agentChannel: 'whatsapp'
    }).find((candidate) => candidate.name === 'sessions_spawn');
    if (!tool) {
      throw new Error('missing sessions_spawn tool');
    }
    const result = await tool.execute('call2', {
      task: 'do thing',
      runTimeoutSeconds: 1,
      label: 'my-task'
    });
    expect(result.details).toMatchObject({
      status: 'accepted',
      runId: 'run-1'
    });
    if (!childRunId) {
      throw new Error('missing child runId');
    }
    emitAgentEvent({
      runId: childRunId,
      stream: 'lifecycle',
      data: {
        phase: 'end',
        startedAt: 1e3,
        endedAt: 2e3
      }
    });
    await sleep(0);
    await sleep(0);
    await sleep(0);
    const childWait = waitCalls.find((call) => call.runId === childRunId);
    expect(childWait?.timeoutMs).toBe(1e3);
    expect(patchParams.key).toBe(childSessionKey);
    expect(patchParams.label).toBe('my-task');
    const agentCalls = calls.filter((c) => c.method === 'agent');
    expect(agentCalls).toHaveLength(2);
    const first = agentCalls[0]?.params;
    expect(first?.lane).toBe('subagent');
    const second = agentCalls[1]?.params;
    expect(second?.sessionKey).toBe('main');
    expect(second?.message).toContain('background task');
    const sendCalls = calls.filter((c) => c.method === 'send');
    expect(sendCalls.length).toBe(0);
    expect(childSessionKey?.startsWith('agent:main:subagent:')).toBe(true);
  });
  it('sessions_spawn only allows same-agent by default', async () => {
    resetSubagentRegistryForTests();
    callGatewayMock.mockReset();
    const tool = createOpenClawTools({
      agentSessionKey: 'main',
      agentChannel: 'whatsapp'
    }).find((candidate) => candidate.name === 'sessions_spawn');
    if (!tool) {
      throw new Error('missing sessions_spawn tool');
    }
    const result = await tool.execute('call6', {
      task: 'do thing',
      agentId: 'beta'
    });
    expect(result.details).toMatchObject({
      status: 'forbidden'
    });
    expect(callGatewayMock).not.toHaveBeenCalled();
  });
});
