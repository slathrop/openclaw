import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sleep } from '../utils.js';
import { runClaudeCliAgent } from './claude-cli-runner.js';
const runCommandWithTimeoutMock = vi.fn();
function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve,
    reject
  };
}
async function waitForCalls(mockFn, count) {
  for (let i = 0; i < 50; i += 1) {
    if (mockFn.mock.calls.length >= count) {
      return;
    }
    await sleep(0);
  }
  throw new Error(`Expected ${count} calls, got ${mockFn.mock.calls.length}`);
}
vi.mock('../process/exec.js', () => ({
  runCommandWithTimeout: (...args) => runCommandWithTimeoutMock(...args)
}));
describe('runClaudeCliAgent', () => {
  beforeEach(() => {
    runCommandWithTimeoutMock.mockReset();
  });
  it('starts a new session with --session-id when none is provided', async () => {
    runCommandWithTimeoutMock.mockResolvedValueOnce({
      stdout: JSON.stringify({ message: 'ok', session_id: 'sid-1' }),
      stderr: '',
      code: 0,
      signal: null,
      killed: false
    });
    await runClaudeCliAgent({
      sessionId: 'openclaw-session',
      sessionFile: '/tmp/session.jsonl',
      workspaceDir: '/tmp',
      prompt: 'hi',
      model: 'opus',
      timeoutMs: 1e3,
      runId: 'run-1'
    });
    expect(runCommandWithTimeoutMock).toHaveBeenCalledTimes(1);
    const argv = runCommandWithTimeoutMock.mock.calls[0]?.[0];
    expect(argv).toContain('claude');
    expect(argv).toContain('--session-id');
    expect(argv).toContain('hi');
  });
  it('uses --resume when a claude session id is provided', async () => {
    runCommandWithTimeoutMock.mockResolvedValueOnce({
      stdout: JSON.stringify({ message: 'ok', session_id: 'sid-2' }),
      stderr: '',
      code: 0,
      signal: null,
      killed: false
    });
    await runClaudeCliAgent({
      sessionId: 'openclaw-session',
      sessionFile: '/tmp/session.jsonl',
      workspaceDir: '/tmp',
      prompt: 'hi',
      model: 'opus',
      timeoutMs: 1e3,
      runId: 'run-2',
      claudeSessionId: 'c9d7b831-1c31-4d22-80b9-1e50ca207d4b'
    });
    expect(runCommandWithTimeoutMock).toHaveBeenCalledTimes(1);
    const argv = runCommandWithTimeoutMock.mock.calls[0]?.[0];
    expect(argv).toContain('--resume');
    expect(argv).toContain('c9d7b831-1c31-4d22-80b9-1e50ca207d4b');
    expect(argv).toContain('hi');
  });
  it('serializes concurrent claude-cli runs', async () => {
    const firstDeferred = createDeferred();
    const secondDeferred = createDeferred();
    runCommandWithTimeoutMock.mockImplementationOnce(() => firstDeferred.promise).mockImplementationOnce(() => secondDeferred.promise);
    const firstRun = runClaudeCliAgent({
      sessionId: 's1',
      sessionFile: '/tmp/session.jsonl',
      workspaceDir: '/tmp',
      prompt: 'first',
      model: 'opus',
      timeoutMs: 1e3,
      runId: 'run-1'
    });
    const secondRun = runClaudeCliAgent({
      sessionId: 's2',
      sessionFile: '/tmp/session.jsonl',
      workspaceDir: '/tmp',
      prompt: 'second',
      model: 'opus',
      timeoutMs: 1e3,
      runId: 'run-2'
    });
    await waitForCalls(runCommandWithTimeoutMock, 1);
    firstDeferred.resolve({
      stdout: JSON.stringify({ message: 'ok', session_id: 'sid-1' }),
      stderr: '',
      code: 0,
      signal: null,
      killed: false
    });
    await waitForCalls(runCommandWithTimeoutMock, 2);
    secondDeferred.resolve({
      stdout: JSON.stringify({ message: 'ok', session_id: 'sid-2' }),
      stderr: '',
      code: 0,
      signal: null,
      killed: false
    });
    await Promise.all([firstRun, secondRun]);
  });
});
