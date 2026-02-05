import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const spawnCalls = [];
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    spawn: (command, args) => {
      spawnCalls.push({ command, args });
      const child = new EventEmitter();
      child.stdout = new Readable({ read() {
      } });
      child.stderr = new Readable({ read() {
      } });
      const dockerArgs = command === 'docker' ? args : [];
      const shouldFailContainerInspect = dockerArgs[0] === 'inspect' && dockerArgs[1] === '-f' && dockerArgs[2] === '{{.State.Running}}';
      const shouldSucceedImageInspect = dockerArgs[0] === 'image' && dockerArgs[1] === 'inspect';
      const code = shouldFailContainerInspect ? 1 : 0;
      if (shouldSucceedImageInspect) {
        queueMicrotask(() => child.emit('close', 0));
      } else {
        queueMicrotask(() => child.emit('close', code));
      }
      return child;
    }
  };
});
vi.mock('../skills.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    syncSkillsToWorkspace: vi.fn(async () => void 0)
  };
});
describe('Agent-specific sandbox config', () => {
  let previousStateDir;
  let tempStateDir;
  beforeEach(async () => {
    spawnCalls.length = 0;
    previousStateDir = process.env.MOLTBOT_STATE_DIR;
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moltbot-test-state-'));
    process.env.MOLTBOT_STATE_DIR = tempStateDir;
    vi.resetModules();
  });
  afterEach(async () => {
    if (tempStateDir) {
      await fs.rm(tempStateDir, { recursive: true, force: true });
    }
    if (previousStateDir === void 0) {
      delete process.env.MOLTBOT_STATE_DIR;
    } else {
      process.env.MOLTBOT_STATE_DIR = previousStateDir;
    }
    tempStateDir = void 0;
  });
  it('should allow agent-specific docker settings beyond setupCommand', async () => {
    const { resolveSandboxContext } = await import('./sandbox.js');
    const cfg = {
      agents: {
        defaults: {
          sandbox: {
            mode: 'all',
            scope: 'agent',
            docker: {
              image: 'global-image',
              network: 'none'
            }
          }
        },
        list: [
          {
            id: 'work',
            workspace: '~/openclaw-work',
            sandbox: {
              mode: 'all',
              scope: 'agent',
              docker: {
                image: 'work-image',
                network: 'bridge'
              }
            }
          }
        ]
      }
    };
    const context = await resolveSandboxContext({
      config: cfg,
      sessionKey: 'agent:work:main',
      workspaceDir: '/tmp/test-work'
    });
    expect(context).toBeDefined();
    expect(context?.docker.image).toBe('work-image');
    expect(context?.docker.network).toBe('bridge');
  });
  it("should override with agent-specific sandbox mode 'off'", async () => {
    const { resolveSandboxContext } = await import('./sandbox.js');
    const cfg = {
      agents: {
        defaults: {
          sandbox: {
            mode: 'all',
            // Global default
            scope: 'agent'
          }
        },
        list: [
          {
            id: 'main',
            workspace: '~/openclaw',
            sandbox: {
              mode: 'off'
              // Agent override
            }
          }
        ]
      }
    };
    const context = await resolveSandboxContext({
      config: cfg,
      sessionKey: 'agent:main:main',
      workspaceDir: '/tmp/test'
    });
    expect(context).toBeNull();
  });
  it("should use agent-specific sandbox mode 'all'", async () => {
    const { resolveSandboxContext } = await import('./sandbox.js');
    const cfg = {
      agents: {
        defaults: {
          sandbox: {
            mode: 'off'
            // Global default
          }
        },
        list: [
          {
            id: 'family',
            workspace: '~/openclaw-family',
            sandbox: {
              mode: 'all',
              // Agent override
              scope: 'agent'
            }
          }
        ]
      }
    };
    const context = await resolveSandboxContext({
      config: cfg,
      sessionKey: 'agent:family:whatsapp:group:123',
      workspaceDir: '/tmp/test-family'
    });
    expect(context).toBeDefined();
    expect(context?.enabled).toBe(true);
  });
  it('should use agent-specific scope', async () => {
    const { resolveSandboxContext } = await import('./sandbox.js');
    const cfg = {
      agents: {
        defaults: {
          sandbox: {
            mode: 'all',
            scope: 'session'
            // Global default
          }
        },
        list: [
          {
            id: 'work',
            workspace: '~/openclaw-work',
            sandbox: {
              mode: 'all',
              scope: 'agent'
              // Agent override
            }
          }
        ]
      }
    };
    const context = await resolveSandboxContext({
      config: cfg,
      sessionKey: 'agent:work:slack:channel:456',
      workspaceDir: '/tmp/test-work'
    });
    expect(context).toBeDefined();
    expect(context?.containerName).toContain('agent-work');
  });
});
