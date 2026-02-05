import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeTempWorkspace, writeWorkspaceFile } from '../../../test-helpers/workspace.js';
import { createHookEvent } from '../../hooks.js';
import handler from './handler.js';
function createMockSessionContent(entries) {
  return entries.map((entry) => {
    if ('role' in entry) {
      return JSON.stringify({
        type: 'message',
        message: {
          role: entry.role,
          content: entry.content
        }
      });
    }
    return JSON.stringify(entry);
  }).join('\n');
}
describe('session-memory hook', () => {
  it('skips non-command events', async () => {
    const tempDir = await makeTempWorkspace('openclaw-session-memory-');
    const event = createHookEvent('agent', 'bootstrap', 'agent:main:main', {
      workspaceDir: tempDir
    });
    await handler(event);
    const memoryDir = path.join(tempDir, 'memory');
    await expect(fs.access(memoryDir)).rejects.toThrow();
  });
  it('skips commands other than new', async () => {
    const tempDir = await makeTempWorkspace('openclaw-session-memory-');
    const event = createHookEvent('command', 'help', 'agent:main:main', {
      workspaceDir: tempDir
    });
    await handler(event);
    const memoryDir = path.join(tempDir, 'memory');
    await expect(fs.access(memoryDir)).rejects.toThrow();
  });
  it('creates memory file with session content on /new command', async () => {
    const tempDir = await makeTempWorkspace('openclaw-session-memory-');
    const sessionsDir = path.join(tempDir, 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });
    const sessionContent = createMockSessionContent([
      { role: 'user', content: 'Hello there' },
      { role: 'assistant', content: 'Hi! How can I help?' },
      { role: 'user', content: 'What is 2+2?' },
      { role: 'assistant', content: '2+2 equals 4' }
    ]);
    const sessionFile = await writeWorkspaceFile({
      dir: sessionsDir,
      name: 'test-session.jsonl',
      content: sessionContent
    });
    const cfg = {
      agents: { defaults: { workspace: tempDir } }
    };
    const event = createHookEvent('command', 'new', 'agent:main:main', {
      cfg,
      previousSessionEntry: {
        sessionId: 'test-123',
        sessionFile
      }
    });
    await handler(event);
    const memoryDir = path.join(tempDir, 'memory');
    const files = await fs.readdir(memoryDir);
    expect(files.length).toBe(1);
    const memoryContent = await fs.readFile(path.join(memoryDir, files[0]), 'utf-8');
    expect(memoryContent).toContain('user: Hello there');
    expect(memoryContent).toContain('assistant: Hi! How can I help?');
    expect(memoryContent).toContain('user: What is 2+2?');
    expect(memoryContent).toContain('assistant: 2+2 equals 4');
  });
  it('filters out non-message entries (tool calls, system)', async () => {
    const tempDir = await makeTempWorkspace('openclaw-session-memory-');
    const sessionsDir = path.join(tempDir, 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });
    const sessionContent = createMockSessionContent([
      { role: 'user', content: 'Hello' },
      { type: 'tool_use', tool: 'search', input: 'test' },
      { role: 'assistant', content: 'World' },
      { type: 'tool_result', result: 'found it' },
      { role: 'user', content: 'Thanks' }
    ]);
    const sessionFile = await writeWorkspaceFile({
      dir: sessionsDir,
      name: 'test-session.jsonl',
      content: sessionContent
    });
    const cfg = {
      agents: { defaults: { workspace: tempDir } }
    };
    const event = createHookEvent('command', 'new', 'agent:main:main', {
      cfg,
      previousSessionEntry: {
        sessionId: 'test-123',
        sessionFile
      }
    });
    await handler(event);
    const memoryDir = path.join(tempDir, 'memory');
    const files = await fs.readdir(memoryDir);
    const memoryContent = await fs.readFile(path.join(memoryDir, files[0]), 'utf-8');
    expect(memoryContent).toContain('user: Hello');
    expect(memoryContent).toContain('assistant: World');
    expect(memoryContent).toContain('user: Thanks');
    expect(memoryContent).not.toContain('tool_use');
    expect(memoryContent).not.toContain('tool_result');
    expect(memoryContent).not.toContain('search');
  });
  it('filters out command messages starting with /', async () => {
    const tempDir = await makeTempWorkspace('openclaw-session-memory-');
    const sessionsDir = path.join(tempDir, 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });
    const sessionContent = createMockSessionContent([
      { role: 'user', content: '/help' },
      { role: 'assistant', content: 'Here is help info' },
      { role: 'user', content: 'Normal message' },
      { role: 'user', content: '/new' }
    ]);
    const sessionFile = await writeWorkspaceFile({
      dir: sessionsDir,
      name: 'test-session.jsonl',
      content: sessionContent
    });
    const cfg = {
      agents: { defaults: { workspace: tempDir } }
    };
    const event = createHookEvent('command', 'new', 'agent:main:main', {
      cfg,
      previousSessionEntry: {
        sessionId: 'test-123',
        sessionFile
      }
    });
    await handler(event);
    const memoryDir = path.join(tempDir, 'memory');
    const files = await fs.readdir(memoryDir);
    const memoryContent = await fs.readFile(path.join(memoryDir, files[0]), 'utf-8');
    expect(memoryContent).not.toContain('/help');
    expect(memoryContent).not.toContain('/new');
    expect(memoryContent).toContain('assistant: Here is help info');
    expect(memoryContent).toContain('user: Normal message');
  });
  it('respects custom messages config (limits to N messages)', async () => {
    const tempDir = await makeTempWorkspace('openclaw-session-memory-');
    const sessionsDir = path.join(tempDir, 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });
    const entries = [];
    for (let i = 1; i <= 10; i++) {
      entries.push({ role: 'user', content: `Message ${i}` });
    }
    const sessionContent = createMockSessionContent(entries);
    const sessionFile = await writeWorkspaceFile({
      dir: sessionsDir,
      name: 'test-session.jsonl',
      content: sessionContent
    });
    const cfg = {
      agents: { defaults: { workspace: tempDir } },
      hooks: {
        internal: {
          entries: {
            'session-memory': { enabled: true, messages: 3 }
          }
        }
      }
    };
    const event = createHookEvent('command', 'new', 'agent:main:main', {
      cfg,
      previousSessionEntry: {
        sessionId: 'test-123',
        sessionFile
      }
    });
    await handler(event);
    const memoryDir = path.join(tempDir, 'memory');
    const files = await fs.readdir(memoryDir);
    const memoryContent = await fs.readFile(path.join(memoryDir, files[0]), 'utf-8');
    expect(memoryContent).not.toContain('user: Message 1\n');
    expect(memoryContent).not.toContain('user: Message 7\n');
    expect(memoryContent).toContain('user: Message 8');
    expect(memoryContent).toContain('user: Message 9');
    expect(memoryContent).toContain('user: Message 10');
  });
  it('filters messages before slicing (fix for #2681)', async () => {
    const tempDir = await makeTempWorkspace('openclaw-session-memory-');
    const sessionsDir = path.join(tempDir, 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });
    const entries = [
      { role: 'user', content: 'First message' },
      { type: 'tool_use', tool: 'test1' },
      { type: 'tool_result', result: 'result1' },
      { role: 'assistant', content: 'Second message' },
      { type: 'tool_use', tool: 'test2' },
      { type: 'tool_result', result: 'result2' },
      { role: 'user', content: 'Third message' },
      { type: 'tool_use', tool: 'test3' },
      { type: 'tool_result', result: 'result3' },
      { role: 'assistant', content: 'Fourth message' }
    ];
    const sessionContent = createMockSessionContent(entries);
    const sessionFile = await writeWorkspaceFile({
      dir: sessionsDir,
      name: 'test-session.jsonl',
      content: sessionContent
    });
    const cfg = {
      agents: { defaults: { workspace: tempDir } },
      hooks: {
        internal: {
          entries: {
            'session-memory': { enabled: true, messages: 3 }
          }
        }
      }
    };
    const event = createHookEvent('command', 'new', 'agent:main:main', {
      cfg,
      previousSessionEntry: {
        sessionId: 'test-123',
        sessionFile
      }
    });
    await handler(event);
    const memoryDir = path.join(tempDir, 'memory');
    const files = await fs.readdir(memoryDir);
    const memoryContent = await fs.readFile(path.join(memoryDir, files[0]), 'utf-8');
    expect(memoryContent).not.toContain('First message');
    expect(memoryContent).toContain('user: Third message');
    expect(memoryContent).toContain('assistant: Second message');
    expect(memoryContent).toContain('assistant: Fourth message');
  });
  it('handles empty session files gracefully', async () => {
    const tempDir = await makeTempWorkspace('openclaw-session-memory-');
    const sessionsDir = path.join(tempDir, 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });
    const sessionFile = await writeWorkspaceFile({
      dir: sessionsDir,
      name: 'test-session.jsonl',
      content: ''
    });
    const cfg = {
      agents: { defaults: { workspace: tempDir } }
    };
    const event = createHookEvent('command', 'new', 'agent:main:main', {
      cfg,
      previousSessionEntry: {
        sessionId: 'test-123',
        sessionFile
      }
    });
    await handler(event);
    const memoryDir = path.join(tempDir, 'memory');
    const files = await fs.readdir(memoryDir);
    expect(files.length).toBe(1);
  });
  it('handles session files with fewer messages than requested', async () => {
    const tempDir = await makeTempWorkspace('openclaw-session-memory-');
    const sessionsDir = path.join(tempDir, 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });
    const sessionContent = createMockSessionContent([
      { role: 'user', content: 'Only message 1' },
      { role: 'assistant', content: 'Only message 2' }
    ]);
    const sessionFile = await writeWorkspaceFile({
      dir: sessionsDir,
      name: 'test-session.jsonl',
      content: sessionContent
    });
    const cfg = {
      agents: { defaults: { workspace: tempDir } }
    };
    const event = createHookEvent('command', 'new', 'agent:main:main', {
      cfg,
      previousSessionEntry: {
        sessionId: 'test-123',
        sessionFile
      }
    });
    await handler(event);
    const memoryDir = path.join(tempDir, 'memory');
    const files = await fs.readdir(memoryDir);
    const memoryContent = await fs.readFile(path.join(memoryDir, files[0]), 'utf-8');
    expect(memoryContent).toContain('user: Only message 1');
    expect(memoryContent).toContain('assistant: Only message 2');
  });
});
