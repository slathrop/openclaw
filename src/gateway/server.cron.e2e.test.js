import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  connectOk,
  installGatewayTestHooks,
  rpcReq,
  startServerWithClient,
  testState,
  waitForSystemEvent
} from './test-helpers.js';
installGatewayTestHooks({ scope: 'suite' });
async function yieldToEventLoop() {
  await fs.stat(process.cwd()).catch(() => {
  });
}
async function rmTempDir(dir) {
  for (let i = 0; i < 100; i += 1) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      const code = err?.code;
      if (code === 'ENOTEMPTY' || code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
        await yieldToEventLoop();
        continue;
      }
      throw err;
    }
  }
  await fs.rm(dir, { recursive: true, force: true });
}
async function waitForNonEmptyFile(pathname, timeoutMs = 2e3) {
  const startedAt = process.hrtime.bigint();
  for (; ; ) {
    const raw = await fs.readFile(pathname, 'utf-8').catch(() => '');
    if (raw.trim().length > 0) {
      return raw;
    }
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    if (elapsedMs >= timeoutMs) {
      throw new Error(`timeout waiting for file ${pathname}`);
    }
    await yieldToEventLoop();
  }
}
describe('gateway server cron', () => {
  test('handles cron CRUD, normalization, and patch semantics', { timeout: 12e4 }, async () => {
    const prevSkipCron = process.env.OPENCLAW_SKIP_CRON;
    process.env.OPENCLAW_SKIP_CRON = '0';
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-gw-cron-'));
    testState.cronStorePath = path.join(dir, 'cron', 'jobs.json');
    testState.sessionConfig = { mainKey: 'primary' };
    testState.cronEnabled = false;
    await fs.mkdir(path.dirname(testState.cronStorePath), { recursive: true });
    await fs.writeFile(testState.cronStorePath, JSON.stringify({ version: 1, jobs: [] }));
    const { server, ws } = await startServerWithClient();
    await connectOk(ws);
    try {
      const addRes = await rpcReq(ws, 'cron.add', {
        name: 'daily',
        enabled: true,
        schedule: { kind: 'every', everyMs: 6e4 },
        sessionTarget: 'main',
        wakeMode: 'next-heartbeat',
        payload: { kind: 'systemEvent', text: 'hello' }
      });
      expect(addRes.ok).toBe(true);
      expect(typeof addRes.payload?.id).toBe('string');
      const listRes = await rpcReq(ws, 'cron.list', {
        includeDisabled: true
      });
      expect(listRes.ok).toBe(true);
      const jobs = listRes.payload?.jobs;
      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBe(1);
      expect(jobs[0]?.name ?? '').toBe('daily');
      const routeAtMs = Date.now() - 1;
      const routeRes = await rpcReq(ws, 'cron.add', {
        name: 'route test',
        enabled: true,
        schedule: { kind: 'at', at: new Date(routeAtMs).toISOString() },
        sessionTarget: 'main',
        wakeMode: 'next-heartbeat',
        payload: { kind: 'systemEvent', text: 'cron route check' }
      });
      expect(routeRes.ok).toBe(true);
      const routeJobIdValue = routeRes.payload?.id;
      const routeJobId = typeof routeJobIdValue === 'string' ? routeJobIdValue : '';
      expect(routeJobId.length > 0).toBe(true);
      const runRes = await rpcReq(ws, 'cron.run', { id: routeJobId, mode: 'force' }, 2e4);
      expect(runRes.ok).toBe(true);
      const events = await waitForSystemEvent();
      expect(events.some((event) => event.includes('cron route check'))).toBe(true);
      const wrappedAtMs = Date.now() + 1e3;
      const wrappedRes = await rpcReq(ws, 'cron.add', {
        data: {
          name: 'wrapped',
          schedule: { at: new Date(wrappedAtMs).toISOString() },
          payload: { kind: 'systemEvent', text: 'hello' }
        }
      });
      expect(wrappedRes.ok).toBe(true);
      const wrappedPayload = wrappedRes.payload;
      expect(wrappedPayload?.sessionTarget).toBe('main');
      expect(wrappedPayload?.wakeMode).toBe('next-heartbeat');
      expect(wrappedPayload?.schedule?.kind).toBe('at');
      const patchRes = await rpcReq(ws, 'cron.add', {
        name: 'patch test',
        enabled: true,
        schedule: { kind: 'every', everyMs: 6e4 },
        sessionTarget: 'main',
        wakeMode: 'next-heartbeat',
        payload: { kind: 'systemEvent', text: 'hello' }
      });
      expect(patchRes.ok).toBe(true);
      const patchJobIdValue = patchRes.payload?.id;
      const patchJobId = typeof patchJobIdValue === 'string' ? patchJobIdValue : '';
      expect(patchJobId.length > 0).toBe(true);
      const atMs = Date.now() + 1e3;
      const updateRes = await rpcReq(ws, 'cron.update', {
        id: patchJobId,
        patch: {
          schedule: { at: new Date(atMs).toISOString() },
          payload: { kind: 'systemEvent', text: 'updated' }
        }
      });
      expect(updateRes.ok).toBe(true);
      const updated = updateRes.payload;
      expect(updated?.schedule?.kind).toBe('at');
      expect(updated?.payload?.kind).toBe('systemEvent');
      const mergeRes = await rpcReq(ws, 'cron.add', {
        name: 'patch merge',
        enabled: true,
        schedule: { kind: 'every', everyMs: 6e4 },
        sessionTarget: 'isolated',
        wakeMode: 'next-heartbeat',
        payload: { kind: 'agentTurn', message: 'hello', model: 'opus' }
      });
      expect(mergeRes.ok).toBe(true);
      const mergeJobIdValue = mergeRes.payload?.id;
      const mergeJobId = typeof mergeJobIdValue === 'string' ? mergeJobIdValue : '';
      expect(mergeJobId.length > 0).toBe(true);
      const mergeUpdateRes = await rpcReq(ws, 'cron.update', {
        id: mergeJobId,
        patch: {
          delivery: { mode: 'announce', channel: 'telegram', to: '19098680' }
        }
      });
      expect(mergeUpdateRes.ok).toBe(true);
      const merged = mergeUpdateRes.payload;
      expect(merged?.payload?.kind).toBe('agentTurn');
      expect(merged?.payload?.message).toBe('hello');
      expect(merged?.payload?.model).toBe('opus');
      expect(merged?.delivery?.mode).toBe('announce');
      expect(merged?.delivery?.channel).toBe('telegram');
      expect(merged?.delivery?.to).toBe('19098680');
      const rejectRes = await rpcReq(ws, 'cron.add', {
        name: 'patch reject',
        enabled: true,
        schedule: { kind: 'every', everyMs: 6e4 },
        sessionTarget: 'main',
        wakeMode: 'next-heartbeat',
        payload: { kind: 'systemEvent', text: 'hello' }
      });
      expect(rejectRes.ok).toBe(true);
      const rejectJobIdValue = rejectRes.payload?.id;
      const rejectJobId = typeof rejectJobIdValue === 'string' ? rejectJobIdValue : '';
      expect(rejectJobId.length > 0).toBe(true);
      const rejectUpdateRes = await rpcReq(ws, 'cron.update', {
        id: rejectJobId,
        patch: {
          payload: { kind: 'agentTurn', message: 'nope' }
        }
      });
      expect(rejectUpdateRes.ok).toBe(false);
      const jobIdRes = await rpcReq(ws, 'cron.add', {
        name: 'jobId test',
        enabled: true,
        schedule: { kind: 'every', everyMs: 6e4 },
        sessionTarget: 'main',
        wakeMode: 'next-heartbeat',
        payload: { kind: 'systemEvent', text: 'hello' }
      });
      expect(jobIdRes.ok).toBe(true);
      const jobIdValue = jobIdRes.payload?.id;
      const jobId = typeof jobIdValue === 'string' ? jobIdValue : '';
      expect(jobId.length > 0).toBe(true);
      const jobIdUpdateRes = await rpcReq(ws, 'cron.update', {
        jobId,
        patch: {
          schedule: { at: new Date(Date.now() + 2e3).toISOString() },
          payload: { kind: 'systemEvent', text: 'updated' }
        }
      });
      expect(jobIdUpdateRes.ok).toBe(true);
      const disableRes = await rpcReq(ws, 'cron.add', {
        name: 'disable test',
        enabled: true,
        schedule: { kind: 'every', everyMs: 6e4 },
        sessionTarget: 'main',
        wakeMode: 'next-heartbeat',
        payload: { kind: 'systemEvent', text: 'hello' }
      });
      expect(disableRes.ok).toBe(true);
      const disableJobIdValue = disableRes.payload?.id;
      const disableJobId = typeof disableJobIdValue === 'string' ? disableJobIdValue : '';
      expect(disableJobId.length > 0).toBe(true);
      const disableUpdateRes = await rpcReq(ws, 'cron.update', {
        id: disableJobId,
        patch: { enabled: false }
      });
      expect(disableUpdateRes.ok).toBe(true);
      const disabled = disableUpdateRes.payload;
      expect(disabled?.enabled).toBe(false);
    } finally {
      ws.close();
      await server.close();
      await rmTempDir(dir);
      testState.cronStorePath = void 0;
      testState.sessionConfig = void 0;
      testState.cronEnabled = void 0;
      if (prevSkipCron === void 0) {
        delete process.env.OPENCLAW_SKIP_CRON;
      } else {
        process.env.OPENCLAW_SKIP_CRON = prevSkipCron;
      }
    }
  });
  test('writes cron run history and auto-runs due jobs', async () => {
    const prevSkipCron = process.env.OPENCLAW_SKIP_CRON;
    process.env.OPENCLAW_SKIP_CRON = '0';
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-gw-cron-log-'));
    testState.cronStorePath = path.join(dir, 'cron', 'jobs.json');
    testState.cronEnabled = void 0;
    await fs.mkdir(path.dirname(testState.cronStorePath), { recursive: true });
    await fs.writeFile(testState.cronStorePath, JSON.stringify({ version: 1, jobs: [] }));
    const { server, ws } = await startServerWithClient();
    await connectOk(ws);
    try {
      const atMs = Date.now() - 1;
      const addRes = await rpcReq(ws, 'cron.add', {
        name: 'log test',
        enabled: true,
        schedule: { kind: 'at', at: new Date(atMs).toISOString() },
        sessionTarget: 'main',
        wakeMode: 'next-heartbeat',
        payload: { kind: 'systemEvent', text: 'hello' }
      });
      expect(addRes.ok).toBe(true);
      const jobIdValue = addRes.payload?.id;
      const jobId = typeof jobIdValue === 'string' ? jobIdValue : '';
      expect(jobId.length > 0).toBe(true);
      const runRes = await rpcReq(ws, 'cron.run', { id: jobId, mode: 'force' }, 2e4);
      expect(runRes.ok).toBe(true);
      const logPath = path.join(dir, 'cron', 'runs', `${jobId}.jsonl`);
      const raw = await waitForNonEmptyFile(logPath, 5e3);
      const line = raw.split('\n').map((l) => l.trim()).filter(Boolean).at(-1);
      const last = JSON.parse(line ?? '{}');
      expect(last.action).toBe('finished');
      expect(last.jobId).toBe(jobId);
      expect(last.status).toBe('ok');
      expect(last.summary).toBe('hello');
      const runsRes = await rpcReq(ws, 'cron.runs', { id: jobId, limit: 50 });
      expect(runsRes.ok).toBe(true);
      const entries = runsRes.payload?.entries;
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.at(-1)?.jobId).toBe(jobId);
      expect(entries.at(-1)?.summary).toBe('hello');
      const statusRes = await rpcReq(ws, 'cron.status', {});
      expect(statusRes.ok).toBe(true);
      const statusPayload = statusRes.payload;
      expect(statusPayload?.enabled).toBe(true);
      const storePath = typeof statusPayload?.storePath === 'string' ? statusPayload.storePath : '';
      expect(storePath).toContain('jobs.json');
      const autoRes = await rpcReq(ws, 'cron.add', {
        name: 'auto run test',
        enabled: true,
        schedule: { kind: 'at', at: new Date(Date.now() - 10).toISOString() },
        sessionTarget: 'main',
        wakeMode: 'next-heartbeat',
        payload: { kind: 'systemEvent', text: 'auto' }
      });
      expect(autoRes.ok).toBe(true);
      const autoJobIdValue = autoRes.payload?.id;
      const autoJobId = typeof autoJobIdValue === 'string' ? autoJobIdValue : '';
      expect(autoJobId.length > 0).toBe(true);
      await waitForNonEmptyFile(path.join(dir, 'cron', 'runs', `${autoJobId}.jsonl`), 5e3);
      const autoEntries = (await rpcReq(ws, 'cron.runs', { id: autoJobId, limit: 10 })).payload;
      expect(Array.isArray(autoEntries?.entries)).toBe(true);
      const runs = autoEntries?.entries ?? [];
      expect(runs.at(-1)?.jobId).toBe(autoJobId);
    } finally {
      ws.close();
      await server.close();
      await rmTempDir(dir);
      testState.cronStorePath = void 0;
      testState.cronEnabled = void 0;
      if (prevSkipCron === void 0) {
        delete process.env.OPENCLAW_SKIP_CRON;
      } else {
        process.env.OPENCLAW_SKIP_CRON = prevSkipCron;
      }
    }
  }, 45e3);
});
