const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { setupInternalHooks } from './onboard-hooks.js';
vi.mock('../hooks/hooks-status.js', () => ({
  buildWorkspaceHookStatus: vi.fn()
}));
vi.mock('../agents/agent-scope.js', () => ({
  resolveAgentWorkspaceDir: vi.fn().mockReturnValue('/mock/workspace'),
  resolveDefaultAgentId: vi.fn().mockReturnValue('main')
}));
describe('onboard-hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const createMockPrompter = /* @__PURE__ */ __name((multiselectValue) => ({
    confirm: vi.fn().mockResolvedValue(true),
    note: vi.fn().mockResolvedValue(void 0),
    intro: vi.fn().mockResolvedValue(void 0),
    outro: vi.fn().mockResolvedValue(void 0),
    text: vi.fn().mockResolvedValue(''),
    select: vi.fn().mockResolvedValue(''),
    multiselect: vi.fn().mockResolvedValue(multiselectValue),
    progress: vi.fn().mockReturnValue({
      stop: vi.fn(),
      update: vi.fn()
    })
  }), 'createMockPrompter');
  const createMockRuntime = /* @__PURE__ */ __name(() => ({
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn()
  }), 'createMockRuntime');
  const createMockHookReport = /* @__PURE__ */ __name((eligible = true) => ({
    workspaceDir: '/mock/workspace',
    managedHooksDir: '/mock/.openclaw/hooks',
    hooks: [
      {
        name: 'session-memory',
        description: 'Save session context to memory when /new command is issued',
        source: 'openclaw-bundled',
        pluginId: void 0,
        filePath: '/mock/workspace/hooks/session-memory/HOOK.md',
        baseDir: '/mock/workspace/hooks/session-memory',
        handlerPath: '/mock/workspace/hooks/session-memory/handler.js',
        hookKey: 'session-memory',
        emoji: '\u{1F4BE}',
        events: ['command:new'],
        homepage: void 0,
        always: false,
        disabled: false,
        eligible,
        managedByPlugin: false,
        requirements: {
          bins: [],
          anyBins: [],
          env: [],
          config: ['workspace.dir'],
          os: []
        },
        missing: {
          bins: [],
          anyBins: [],
          env: [],
          config: eligible ? [] : ['workspace.dir'],
          os: []
        },
        configChecks: [],
        install: []
      },
      {
        name: 'command-logger',
        description: 'Log all command events to a centralized audit file',
        source: 'openclaw-bundled',
        pluginId: void 0,
        filePath: '/mock/workspace/hooks/command-logger/HOOK.md',
        baseDir: '/mock/workspace/hooks/command-logger',
        handlerPath: '/mock/workspace/hooks/command-logger/handler.js',
        hookKey: 'command-logger',
        emoji: '\u{1F4DD}',
        events: ['command'],
        homepage: void 0,
        always: false,
        disabled: false,
        eligible,
        managedByPlugin: false,
        requirements: {
          bins: [],
          anyBins: [],
          env: [],
          config: ['workspace.dir'],
          os: []
        },
        missing: {
          bins: [],
          anyBins: [],
          env: [],
          config: eligible ? [] : ['workspace.dir'],
          os: []
        },
        configChecks: [],
        install: []
      }
    ]
  }), 'createMockHookReport');
  describe('setupInternalHooks', () => {
    it('should enable hooks when user selects them', async () => {
      const { buildWorkspaceHookStatus } = await import('../hooks/hooks-status.js');
      vi.mocked(buildWorkspaceHookStatus).mockReturnValue(createMockHookReport());
      const cfg = {};
      const prompter = createMockPrompter(['session-memory']);
      const runtime = createMockRuntime();
      const result = await setupInternalHooks(cfg, runtime, prompter);
      expect(result.hooks?.internal?.enabled).toBe(true);
      expect(result.hooks?.internal?.entries).toEqual({
        'session-memory': { enabled: true }
      });
      expect(prompter.note).toHaveBeenCalledTimes(2);
      expect(prompter.multiselect).toHaveBeenCalledWith({
        message: 'Enable hooks?',
        options: [
          { value: '__skip__', label: 'Skip for now' },
          {
            value: 'session-memory',
            label: '\u{1F4BE} session-memory',
            hint: 'Save session context to memory when /new command is issued'
          },
          {
            value: 'command-logger',
            label: '\u{1F4DD} command-logger',
            hint: 'Log all command events to a centralized audit file'
          }
        ]
      });
    });
    it('should not enable hooks when user skips', async () => {
      const { buildWorkspaceHookStatus } = await import('../hooks/hooks-status.js');
      vi.mocked(buildWorkspaceHookStatus).mockReturnValue(createMockHookReport());
      const cfg = {};
      const prompter = createMockPrompter(['__skip__']);
      const runtime = createMockRuntime();
      const result = await setupInternalHooks(cfg, runtime, prompter);
      expect(result.hooks?.internal).toBeUndefined();
      expect(prompter.note).toHaveBeenCalledTimes(1);
    });
    it('should handle no eligible hooks', async () => {
      const { buildWorkspaceHookStatus } = await import('../hooks/hooks-status.js');
      vi.mocked(buildWorkspaceHookStatus).mockReturnValue(createMockHookReport(false));
      const cfg = {};
      const prompter = createMockPrompter([]);
      const runtime = createMockRuntime();
      const result = await setupInternalHooks(cfg, runtime, prompter);
      expect(result).toEqual(cfg);
      expect(prompter.multiselect).not.toHaveBeenCalled();
      expect(prompter.note).toHaveBeenCalledWith(
        'No eligible hooks found. You can configure hooks later in your config.',
        'No Hooks Available'
      );
    });
    it('should preserve existing hooks config when enabled', async () => {
      const { buildWorkspaceHookStatus } = await import('../hooks/hooks-status.js');
      vi.mocked(buildWorkspaceHookStatus).mockReturnValue(createMockHookReport());
      const cfg = {
        hooks: {
          enabled: true,
          path: '/webhook',
          token: 'existing-token'
        }
      };
      const prompter = createMockPrompter(['session-memory']);
      const runtime = createMockRuntime();
      const result = await setupInternalHooks(cfg, runtime, prompter);
      expect(result.hooks?.enabled).toBe(true);
      expect(result.hooks?.path).toBe('/webhook');
      expect(result.hooks?.token).toBe('existing-token');
      expect(result.hooks?.internal?.enabled).toBe(true);
      expect(result.hooks?.internal?.entries).toEqual({
        'session-memory': { enabled: true }
      });
    });
    it('should preserve existing config when user skips', async () => {
      const { buildWorkspaceHookStatus } = await import('../hooks/hooks-status.js');
      vi.mocked(buildWorkspaceHookStatus).mockReturnValue(createMockHookReport());
      const cfg = {
        agents: { defaults: { workspace: '/workspace' } }
      };
      const prompter = createMockPrompter(['__skip__']);
      const runtime = createMockRuntime();
      const result = await setupInternalHooks(cfg, runtime, prompter);
      expect(result).toEqual(cfg);
      expect(result.agents?.defaults?.workspace).toBe('/workspace');
    });
    it('should show informative notes to user', async () => {
      const { buildWorkspaceHookStatus } = await import('../hooks/hooks-status.js');
      vi.mocked(buildWorkspaceHookStatus).mockReturnValue(createMockHookReport());
      const cfg = {};
      const prompter = createMockPrompter(['session-memory']);
      const runtime = createMockRuntime();
      await setupInternalHooks(cfg, runtime, prompter);
      const noteCalls = prompter.note.mock.calls;
      expect(noteCalls).toHaveLength(2);
      expect(noteCalls[0][0]).toContain('Hooks let you automate actions');
      expect(noteCalls[0][0]).toContain('automate actions');
      expect(noteCalls[1][0]).toContain('Enabled 1 hook: session-memory');
      expect(noteCalls[1][0]).toMatch(/(?:openclaw|openclaw)( --profile isolated)? hooks list/);
    });
  });
});
