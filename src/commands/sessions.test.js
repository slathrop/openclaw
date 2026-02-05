const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
process.env.FORCE_COLOR = '0';
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: /* @__PURE__ */ __name(() => ({
      agents: {
        defaults: {
          model: { primary: 'pi:opus' },
          models: { 'pi:opus': {} },
          contextTokens: 32e3
        }
      }
    }), 'loadConfig')
  };
});
import { sessionsCommand } from './sessions.js';
const makeRuntime = /* @__PURE__ */ __name(() => {
  const logs = [];
  return {
    runtime: {
      log: /* @__PURE__ */ __name((msg) => logs.push(String(msg)), 'log'),
      error: /* @__PURE__ */ __name((msg) => {
        throw new Error(String(msg));
      }, 'error'),
      exit: /* @__PURE__ */ __name((code) => {
        throw new Error(`exit ${code}`);
      }, 'exit')
    },
    logs
  };
}, 'makeRuntime');
const writeStore = /* @__PURE__ */ __name((data) => {
  const file = path.join(
    os.tmpdir(),
    `sessions-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
  );
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}, 'writeStore');
describe('sessionsCommand', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(/* @__PURE__ */ new Date('2025-12-06T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('renders a tabular view with token percentages', async () => {
    const store = writeStore({
      '+15555550123': {
        sessionId: 'abc123',
        updatedAt: Date.now() - 45 * 6e4,
        inputTokens: 1200,
        outputTokens: 800,
        model: 'pi:opus'
      }
    });
    const { runtime, logs } = makeRuntime();
    await sessionsCommand({ store }, runtime);
    fs.rmSync(store);
    const tableHeader = logs.find((line) => line.includes('Tokens (ctx %'));
    expect(tableHeader).toBeTruthy();
    const row = logs.find((line) => line.includes('+15555550123')) ?? '';
    expect(row).toContain('2.0k/32k (6%)');
    expect(row).toContain('45m ago');
    expect(row).toContain('pi:opus');
  });
  it('shows placeholder rows when tokens are missing', async () => {
    const store = writeStore({
      'discord:group:demo': {
        sessionId: 'xyz',
        updatedAt: Date.now() - 5 * 6e4,
        thinkingLevel: 'high'
      }
    });
    const { runtime, logs } = makeRuntime();
    await sessionsCommand({ store }, runtime);
    fs.rmSync(store);
    const row = logs.find((line) => line.includes('discord:group:demo')) ?? '';
    expect(row).toContain('-'.padEnd(20));
    expect(row).toContain('think:high');
    expect(row).toContain('5m ago');
  });
});
