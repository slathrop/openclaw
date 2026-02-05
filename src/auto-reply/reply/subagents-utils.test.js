import { describe, expect, it } from 'vitest';
import {
  formatDurationShort,
  formatRunLabel,
  formatRunStatus,
  resolveSubagentLabel,
  sortSubagentRuns
} from './subagents-utils.js';
const baseRun = {
  runId: 'run-1',
  childSessionKey: 'agent:main:subagent:abc',
  requesterSessionKey: 'agent:main:main',
  requesterDisplayKey: 'main',
  task: 'do thing',
  cleanup: 'keep',
  createdAt: 1e3,
  startedAt: 1e3
};
describe('subagents utils', () => {
  it('resolves labels from label, task, or fallback', () => {
    expect(resolveSubagentLabel({ ...baseRun, label: 'Label' })).toBe('Label');
    expect(resolveSubagentLabel({ ...baseRun, label: ' ', task: 'Task' })).toBe('Task');
    expect(resolveSubagentLabel({ ...baseRun, label: ' ', task: ' ' }, 'fallback')).toBe(
      'fallback'
    );
  });
  it('formats run labels with truncation', () => {
    const long = 'x'.repeat(100);
    const run = { ...baseRun, label: long };
    const formatted = formatRunLabel(run, { maxLength: 10 });
    expect(formatted.startsWith('x'.repeat(10))).toBe(true);
    expect(formatted.endsWith('\u2026')).toBe(true);
  });
  it('sorts subagent runs by newest start/created time', () => {
    const runs = [
      { ...baseRun, runId: 'run-1', createdAt: 1e3, startedAt: 1e3 },
      { ...baseRun, runId: 'run-2', createdAt: 1200, startedAt: 1200 },
      { ...baseRun, runId: 'run-3', createdAt: 900 }
    ];
    const sorted = sortSubagentRuns(runs);
    expect(sorted.map((run) => run.runId)).toEqual(['run-2', 'run-1', 'run-3']);
  });
  it('formats run status from outcome and timestamps', () => {
    expect(formatRunStatus({ ...baseRun })).toBe('running');
    expect(formatRunStatus({ ...baseRun, endedAt: 2e3, outcome: { status: 'ok' } })).toBe('done');
    expect(formatRunStatus({ ...baseRun, endedAt: 2e3, outcome: { status: 'timeout' } })).toBe(
      'timeout'
    );
  });
  it('formats duration short for seconds and minutes', () => {
    expect(formatDurationShort(45e3)).toBe('45s');
    expect(formatDurationShort(65e3)).toBe('1m5s');
  });
});
