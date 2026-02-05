import { render } from 'lit';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CRON_FORM } from '../app-defaults.js';
import { renderCron } from './cron.js';
function createJob(id) {
  return {
    id,
    name: 'Daily ping',
    enabled: true,
    createdAtMs: 0,
    updatedAtMs: 0,
    schedule: { kind: 'cron', expr: '0 9 * * *' },
    sessionTarget: 'main',
    wakeMode: 'next-heartbeat',
    payload: { kind: 'systemEvent', text: 'ping' }
  };
}
function createProps(overrides = {}) {
  return {
    loading: false,
    status: null,
    jobs: [],
    error: null,
    busy: false,
    form: { ...DEFAULT_CRON_FORM },
    channels: [],
    channelLabels: {},
    runsJobId: null,
    runs: [],
    onFormChange: () => void 0,
    onRefresh: () => void 0,
    onAdd: () => void 0,
    onToggle: () => void 0,
    onRun: () => void 0,
    onRemove: () => void 0,
    onLoadRuns: () => void 0,
    ...overrides
  };
}
describe('cron view', () => {
  it('prompts to select a job before showing run history', () => {
    const container = document.createElement('div');
    render(renderCron(createProps()), container);
    expect(container.textContent).toContain('Select a job to inspect run history.');
  });
  it('loads run history when clicking a job row', () => {
    const container = document.createElement('div');
    const onLoadRuns = vi.fn();
    const job = createJob('job-1');
    render(
      renderCron(
        createProps({
          jobs: [job],
          onLoadRuns
        })
      ),
      container
    );
    const row = container.querySelector('.list-item-clickable');
    expect(row).not.toBeNull();
    row?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onLoadRuns).toHaveBeenCalledWith('job-1');
  });
  it('marks the selected job and keeps Runs button to a single call', () => {
    const container = document.createElement('div');
    const onLoadRuns = vi.fn();
    const job = createJob('job-1');
    render(
      renderCron(
        createProps({
          jobs: [job],
          runsJobId: 'job-1',
          onLoadRuns
        })
      ),
      container
    );
    const selected = container.querySelector('.list-item-selected');
    expect(selected).not.toBeNull();
    const runsButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Runs'
    );
    expect(runsButton).not.toBeUndefined();
    runsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onLoadRuns).toHaveBeenCalledTimes(1);
    expect(onLoadRuns).toHaveBeenCalledWith('job-1');
  });
});
