import fs from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { ensureOpenClawModelsJson } from './models-config.js';
import { buildEmbeddedSandboxInfo } from './pi-embedded-runner.js';
vi.mock('@mariozechner/pi-ai', async () => {
  const actual = await vi.importActual('@mariozechner/pi-ai');
  return {
    ...actual,
    streamSimple: (model) => {
      if (model.id === 'mock-error') {
        throw new Error('boom');
      }
      const stream = new actual.AssistantMessageEventStream();
      queueMicrotask(() => {
        stream.push({
          type: 'done',
          reason: 'stop',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'ok' }],
            stopReason: 'stop',
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: {
              input: 1,
              output: 1,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 2,
              cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0
              }
            },
            timestamp: Date.now()
          }
        });
      });
      return stream;
    }
  };
});
// eslint-disable-next-line no-unused-vars
const _makeOpenAiConfig = (modelIds) => ({
  models: {
    providers: {
      openai: {
        api: 'openai-responses',
        apiKey: 'sk-test',
        baseUrl: 'https://example.com',
        models: modelIds.map((id) => ({
          id,
          name: `Mock ${id}`,
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 16e3,
          maxTokens: 2048
        }))
      }
    }
  }
});
// eslint-disable-next-line no-unused-vars
const _ensureModels = (cfg, agentDir) => ensureOpenClawModelsJson(cfg, agentDir);
// eslint-disable-next-line no-unused-vars
const _textFromContent = (content) => {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content) && content[0]?.type === 'text') {
    return content[0].text;
  }
  return void 0;
};
// eslint-disable-next-line no-unused-vars
const _readSessionMessages = async (sessionFile) => {
  const raw = await fs.readFile(sessionFile, 'utf-8');
  return raw.split(/\r?\n/).filter(Boolean).map(
    (line) => JSON.parse(line)
  ).filter((entry) => entry.type === 'message').map((entry) => entry.message);
};
describe('buildEmbeddedSandboxInfo', () => {
  it('returns undefined when sandbox is missing', () => {
    expect(buildEmbeddedSandboxInfo()).toBeUndefined();
  });
  it('maps sandbox context into prompt info', () => {
    const sandbox = {
      enabled: true,
      sessionKey: 'session:test',
      workspaceDir: '/tmp/openclaw-sandbox',
      agentWorkspaceDir: '/tmp/openclaw-workspace',
      workspaceAccess: 'none',
      containerName: 'openclaw-sbx-test',
      containerWorkdir: '/workspace',
      docker: {
        image: 'openclaw-sandbox:bookworm-slim',
        containerPrefix: 'openclaw-sbx-',
        workdir: '/workspace',
        readOnlyRoot: true,
        tmpfs: ['/tmp'],
        network: 'none',
        user: '1000:1000',
        capDrop: ['ALL'],
        env: { LANG: 'C.UTF-8' }
      },
      tools: {
        allow: ['exec'],
        deny: ['browser']
      },
      browserAllowHostControl: true,
      browser: {
        bridgeUrl: 'http://localhost:9222',
        noVncUrl: 'http://localhost:6080',
        containerName: 'openclaw-sbx-browser-test'
      }
    };
    expect(buildEmbeddedSandboxInfo(sandbox)).toEqual({
      enabled: true,
      workspaceDir: '/tmp/openclaw-sandbox',
      workspaceAccess: 'none',
      agentWorkspaceMount: void 0,
      browserBridgeUrl: 'http://localhost:9222',
      browserNoVncUrl: 'http://localhost:6080',
      hostBrowserAllowed: true
    });
  });
  it('includes elevated info when allowed', () => {
    const sandbox = {
      enabled: true,
      sessionKey: 'session:test',
      workspaceDir: '/tmp/openclaw-sandbox',
      agentWorkspaceDir: '/tmp/openclaw-workspace',
      workspaceAccess: 'none',
      containerName: 'openclaw-sbx-test',
      containerWorkdir: '/workspace',
      docker: {
        image: 'openclaw-sandbox:bookworm-slim',
        containerPrefix: 'openclaw-sbx-',
        workdir: '/workspace',
        readOnlyRoot: true,
        tmpfs: ['/tmp'],
        network: 'none',
        user: '1000:1000',
        capDrop: ['ALL'],
        env: { LANG: 'C.UTF-8' }
      },
      tools: {
        allow: ['exec'],
        deny: ['browser']
      },
      browserAllowHostControl: false
    };
    expect(
      buildEmbeddedSandboxInfo(sandbox, {
        enabled: true,
        allowed: true,
        defaultLevel: 'on'
      })
    ).toEqual({
      enabled: true,
      workspaceDir: '/tmp/openclaw-sandbox',
      workspaceAccess: 'none',
      agentWorkspaceMount: void 0,
      hostBrowserAllowed: false,
      elevated: { allowed: true, defaultLevel: 'on' }
    });
  });
});
