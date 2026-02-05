import { describe, expect, it, vi } from 'vitest';
import { createLocalShellRunner } from './tui-local-shell.js';
const createSelector = () => {
  const selector = {
    onSelect: void 0,
    onCancel: void 0,
    render: () => ['selector'],
    invalidate: () => {
    }
  };
  return selector;
};
describe('createLocalShellRunner', () => {
  it('logs denial on subsequent ! attempts without re-prompting', async () => {
    const messages = [];
    const chatLog = {
      addSystem: (line) => {
        messages.push(line);
      }
    };
    const tui = { requestRender: vi.fn() };
    const openOverlay = vi.fn();
    const closeOverlay = vi.fn();
    let lastSelector = null;
    const createSelectorSpy = vi.fn(() => {
      lastSelector = createSelector();
      return lastSelector;
    });
    const spawnCommand = vi.fn();
    const { runLocalShellLine } = createLocalShellRunner({
      chatLog,
      tui,
      openOverlay,
      closeOverlay,
      createSelector: createSelectorSpy,
      spawnCommand
    });
    const firstRun = runLocalShellLine('!ls');
    expect(openOverlay).toHaveBeenCalledTimes(1);
    lastSelector?.onSelect?.({ value: 'no', label: 'No' });
    await firstRun;
    await runLocalShellLine('!pwd');
    expect(messages).toContain('local shell: not enabled');
    expect(messages).toContain('local shell: not enabled for this session');
    expect(createSelectorSpy).toHaveBeenCalledTimes(1);
    expect(spawnCommand).not.toHaveBeenCalled();
  });
});
