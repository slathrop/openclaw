import { beforeEach, describe, expect, it } from 'vitest';
import {
  addSession,
  appendOutput,
  drainSession,
  listFinishedSessions,
  markBackgrounded,
  markExited,
  resetProcessRegistryForTests
} from './bash-process-registry.js';
describe('bash process registry', () => {
  beforeEach(() => {
    resetProcessRegistryForTests();
  });
  it('captures output and truncates', () => {
    const session = {
      id: 'sess',
      command: 'echo test',
      child: { pid: 123 },
      startedAt: Date.now(),
      cwd: '/tmp',
      maxOutputChars: 10,
      pendingMaxOutputChars: 3e4,
      totalOutputChars: 0,
      pendingStdout: [],
      pendingStderr: [],
      pendingStdoutChars: 0,
      pendingStderrChars: 0,
      aggregated: '',
      tail: '',
      exited: false,
      exitCode: void 0,
      exitSignal: void 0,
      truncated: false,
      backgrounded: false
    };
    addSession(session);
    appendOutput(session, 'stdout', '0123456789');
    appendOutput(session, 'stdout', 'abcdef');
    expect(session.aggregated).toBe('6789abcdef');
    expect(session.truncated).toBe(true);
  });
  it('caps pending output to avoid runaway polls', () => {
    const session = {
      id: 'sess',
      command: 'echo test',
      child: { pid: 123 },
      startedAt: Date.now(),
      cwd: '/tmp',
      maxOutputChars: 1e5,
      pendingMaxOutputChars: 2e4,
      totalOutputChars: 0,
      pendingStdout: [],
      pendingStderr: [],
      pendingStdoutChars: 0,
      pendingStderrChars: 0,
      aggregated: '',
      tail: '',
      exited: false,
      exitCode: void 0,
      exitSignal: void 0,
      truncated: false,
      backgrounded: true
    };
    addSession(session);
    const payload = `${'a'.repeat(7e4)}${'b'.repeat(2e4)}`;
    appendOutput(session, 'stdout', payload);
    const drained = drainSession(session);
    expect(drained.stdout).toBe('b'.repeat(2e4));
    expect(session.pendingStdout).toHaveLength(0);
    expect(session.pendingStdoutChars).toBe(0);
    expect(session.truncated).toBe(true);
  });
  it('respects max output cap when pending cap is larger', () => {
    const session = {
      id: 'sess',
      command: 'echo test',
      child: { pid: 123 },
      startedAt: Date.now(),
      cwd: '/tmp',
      maxOutputChars: 5e3,
      pendingMaxOutputChars: 3e4,
      totalOutputChars: 0,
      pendingStdout: [],
      pendingStderr: [],
      pendingStdoutChars: 0,
      pendingStderrChars: 0,
      aggregated: '',
      tail: '',
      exited: false,
      exitCode: void 0,
      exitSignal: void 0,
      truncated: false,
      backgrounded: true
    };
    addSession(session);
    appendOutput(session, 'stdout', 'x'.repeat(1e4));
    const drained = drainSession(session);
    expect(drained.stdout.length).toBe(5e3);
    expect(session.truncated).toBe(true);
  });
  it('caps stdout and stderr independently', () => {
    const session = {
      id: 'sess',
      command: 'echo test',
      child: { pid: 123 },
      startedAt: Date.now(),
      cwd: '/tmp',
      maxOutputChars: 100,
      pendingMaxOutputChars: 10,
      totalOutputChars: 0,
      pendingStdout: [],
      pendingStderr: [],
      pendingStdoutChars: 0,
      pendingStderrChars: 0,
      aggregated: '',
      tail: '',
      exited: false,
      exitCode: void 0,
      exitSignal: void 0,
      truncated: false,
      backgrounded: true
    };
    addSession(session);
    appendOutput(session, 'stdout', 'a'.repeat(6));
    appendOutput(session, 'stdout', 'b'.repeat(6));
    appendOutput(session, 'stderr', 'c'.repeat(12));
    const drained = drainSession(session);
    expect(drained.stdout).toBe('a'.repeat(4) + 'b'.repeat(6));
    expect(drained.stderr).toBe('c'.repeat(10));
    expect(session.truncated).toBe(true);
  });
  it('only persists finished sessions when backgrounded', () => {
    const session = {
      id: 'sess',
      command: 'echo test',
      child: { pid: 123 },
      startedAt: Date.now(),
      cwd: '/tmp',
      maxOutputChars: 100,
      pendingMaxOutputChars: 3e4,
      totalOutputChars: 0,
      pendingStdout: [],
      pendingStderr: [],
      pendingStdoutChars: 0,
      pendingStderrChars: 0,
      aggregated: '',
      tail: '',
      exited: false,
      exitCode: void 0,
      exitSignal: void 0,
      truncated: false,
      backgrounded: false
    };
    addSession(session);
    markExited(session, 0, null, 'completed');
    expect(listFinishedSessions()).toHaveLength(0);
    markBackgrounded(session);
    markExited(session, 0, null, 'completed');
    expect(listFinishedSessions()).toHaveLength(1);
  });
});
