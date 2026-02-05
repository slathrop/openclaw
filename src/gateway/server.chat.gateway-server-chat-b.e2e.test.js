import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { emitAgentEvent } from '../infra/agent-events.js';
import { __setMaxChatHistoryMessagesBytesForTest } from './server-constants.js';
import {
  connectOk,
  getReplyFromConfig,
  installGatewayTestHooks,
  onceMessage,
  rpcReq,
  sessionStoreSaveDelayMs,
  startServerWithClient,
  testState,
  writeSessionStore
} from './test-helpers.js';
installGatewayTestHooks({ scope: 'suite' });
async function waitFor(condition, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) {
      return;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('timeout waiting for condition');
}
const sendReq = (ws, id, method, params) => {
  ws.send(
    JSON.stringify({
      type: 'req',
      id,
      method,
      params
    })
  );
};
describe('gateway server chat', () => {
  const timeoutMs = 12e4;
  test(
    'handles history, abort, idempotency, and ordering flows',
    { timeout: timeoutMs },
    async () => {
      const tempDirs = [];
      const { server, ws } = await startServerWithClient();
      const spy = vi.mocked(getReplyFromConfig);
      const resetSpy = () => {
        spy.mockReset();
        spy.mockResolvedValue(void 0);
      };
      try {
        const historyMaxBytes = 192 * 1024;
        __setMaxChatHistoryMessagesBytesForTest(historyMaxBytes);
        await connectOk(ws);
        const sessionDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-gw-'));
        tempDirs.push(sessionDir);
        testState.sessionStorePath = path.join(sessionDir, 'sessions.json');
        const writeStore = async (entries) => {
          await writeSessionStore({ entries });
        };
        await writeStore({ main: { sessionId: 'sess-main', updatedAt: Date.now() } });
        const bigText = 'x'.repeat(4e3);
        const largeLines = [];
        for (let i = 0; i < 60; i += 1) {
          largeLines.push(
            JSON.stringify({
              message: {
                role: 'user',
                content: [{ type: 'text', text: `${i}:${bigText}` }],
                timestamp: Date.now() + i
              }
            })
          );
        }
        await fs.writeFile(
          path.join(sessionDir, 'sess-main.jsonl'),
          largeLines.join('\n'),
          'utf-8'
        );
        const cappedRes = await rpcReq(ws, 'chat.history', {
          sessionKey: 'main',
          limit: 1e3
        });
        expect(cappedRes.ok).toBe(true);
        const cappedMsgs = cappedRes.payload?.messages ?? [];
        const bytes = Buffer.byteLength(JSON.stringify(cappedMsgs), 'utf8');
        expect(bytes).toBeLessThanOrEqual(historyMaxBytes);
        expect(cappedMsgs.length).toBeLessThan(60);
        await writeStore({
          main: {
            sessionId: 'sess-main',
            updatedAt: Date.now(),
            lastChannel: 'whatsapp',
            lastTo: '+1555'
          }
        });
        const routeRes = await rpcReq(ws, 'chat.send', {
          sessionKey: 'main',
          message: 'hello',
          idempotencyKey: 'idem-route'
        });
        expect(routeRes.ok).toBe(true);
        const stored = JSON.parse(await fs.readFile(testState.sessionStorePath, 'utf-8'));
        expect(stored['agent:main:main']?.lastChannel).toBe('whatsapp');
        expect(stored['agent:main:main']?.lastTo).toBe('+1555');
        await writeStore({ main: { sessionId: 'sess-main', updatedAt: Date.now() } });
        resetSpy();
        let abortInFlight;
        try {
          const callsBefore = spy.mock.calls.length;
          spy.mockImplementationOnce(async (_ctx, opts) => {
            opts?.onAgentRunStart?.(opts.runId ?? 'idem-abort-1');
            const signal = opts?.abortSignal;
            await new Promise((resolve) => {
              if (!signal) {
                return resolve();
              }
              if (signal.aborted) {
                return resolve();
              }
              signal.addEventListener('abort', () => resolve(), { once: true });
            });
          });
          const sendResP2 = onceMessage(
            ws,
            (o) => o.type === 'res' && o.id === 'send-abort-1',
            8e3
          );
          const abortResP = onceMessage(ws, (o) => o.type === 'res' && o.id === 'abort-1', 8e3);
          const abortedEventP2 = onceMessage(
            ws,
            (o) => o.type === 'event' && o.event === 'chat' && o.payload?.state === 'aborted',
            8e3
          );
          abortInFlight = Promise.allSettled([sendResP2, abortResP, abortedEventP2]);
          sendReq(ws, 'send-abort-1', 'chat.send', {
            sessionKey: 'main',
            message: 'hello',
            idempotencyKey: 'idem-abort-1',
            timeoutMs: 3e4
          });
          const sendRes2 = await sendResP2;
          expect(sendRes2.ok).toBe(true);
          await new Promise((resolve, reject) => {
            const deadline = Date.now() + 1e3;
            const tick = () => {
              if (spy.mock.calls.length > callsBefore) {
                return resolve();
              }
              if (Date.now() > deadline) {
                return reject(new Error('timeout waiting for getReplyFromConfig'));
              }
              setTimeout(tick, 5);
            };
            tick();
          });
          sendReq(ws, 'abort-1', 'chat.abort', {
            sessionKey: 'main',
            runId: 'idem-abort-1'
          });
          const abortRes2 = await abortResP;
          expect(abortRes2.ok).toBe(true);
          const evt = await abortedEventP2;
          expect(evt.payload?.runId).toBe('idem-abort-1');
          expect(evt.payload?.sessionKey).toBe('main');
        } finally {
          await abortInFlight;
        }
        await writeStore({ main: { sessionId: 'sess-main', updatedAt: Date.now() } });
        sessionStoreSaveDelayMs.value = 120;
        resetSpy();
        try {
          spy.mockImplementationOnce(async (_ctx, opts) => {
            opts?.onAgentRunStart?.(opts.runId ?? 'idem-abort-save-1');
            const signal = opts?.abortSignal;
            await new Promise((resolve) => {
              if (!signal) {
                return resolve();
              }
              if (signal.aborted) {
                return resolve();
              }
              signal.addEventListener('abort', () => resolve(), { once: true });
            });
          });
          const abortedEventP2 = onceMessage(
            ws,
            (o) => o.type === 'event' && o.event === 'chat' && o.payload?.state === 'aborted'
          );
          const sendResP2 = onceMessage(ws, (o) => o.type === 'res' && o.id === 'send-abort-save-1');
          sendReq(ws, 'send-abort-save-1', 'chat.send', {
            sessionKey: 'main',
            message: 'hello',
            idempotencyKey: 'idem-abort-save-1',
            timeoutMs: 3e4
          });
          const abortResP = onceMessage(ws, (o) => o.type === 'res' && o.id === 'abort-save-1');
          sendReq(ws, 'abort-save-1', 'chat.abort', {
            sessionKey: 'main',
            runId: 'idem-abort-save-1'
          });
          const abortRes2 = await abortResP;
          expect(abortRes2.ok).toBe(true);
          const sendRes2 = await sendResP2;
          expect(sendRes2.ok).toBe(true);
          const evt = await abortedEventP2;
          expect(evt.payload?.runId).toBe('idem-abort-save-1');
          expect(evt.payload?.sessionKey).toBe('main');
        } finally {
          sessionStoreSaveDelayMs.value = 0;
        }
        await writeStore({ main: { sessionId: 'sess-main', updatedAt: Date.now() } });
        resetSpy();
        const callsBeforeStop = spy.mock.calls.length;
        spy.mockImplementationOnce(async (_ctx, opts) => {
          opts?.onAgentRunStart?.(opts.runId ?? 'idem-stop-1');
          const signal = opts?.abortSignal;
          await new Promise((resolve) => {
            if (!signal) {
              return resolve();
            }
            if (signal.aborted) {
              return resolve();
            }
            signal.addEventListener('abort', () => resolve(), { once: true });
          });
        });
        const stopSendResP = onceMessage(
          ws,
          (o) => o.type === 'res' && o.id === 'send-stop-1',
          8e3
        );
        sendReq(ws, 'send-stop-1', 'chat.send', {
          sessionKey: 'main',
          message: 'hello',
          idempotencyKey: 'idem-stop-run'
        });
        const stopSendRes = await stopSendResP;
        expect(stopSendRes.ok).toBe(true);
        await waitFor(() => spy.mock.calls.length > callsBeforeStop);
        const abortedStopEventP = onceMessage(
          ws,
          (o) => o.type === 'event' && o.event === 'chat' && o.payload?.state === 'aborted' && o.payload?.runId === 'idem-stop-run',
          8e3
        );
        const stopResP = onceMessage(ws, (o) => o.type === 'res' && o.id === 'send-stop-2', 8e3);
        sendReq(ws, 'send-stop-2', 'chat.send', {
          sessionKey: 'main',
          message: '/stop',
          idempotencyKey: 'idem-stop-req'
        });
        const stopRes = await stopResP;
        expect(stopRes.ok).toBe(true);
        const stopEvt = await abortedStopEventP;
        expect(stopEvt.payload?.sessionKey).toBe('main');
        expect(spy.mock.calls.length).toBe(callsBeforeStop + 1);
        resetSpy();
        let resolveRun;
        const runDone = new Promise((resolve) => {
          resolveRun = resolve;
        });
        spy.mockImplementationOnce(async (_ctx, opts) => {
          opts?.onAgentRunStart?.(opts.runId ?? 'idem-status-1');
          await runDone;
        });
        const started = await rpcReq(ws, 'chat.send', {
          sessionKey: 'main',
          message: 'hello',
          idempotencyKey: 'idem-status-1'
        });
        expect(started.ok).toBe(true);
        expect(started.payload?.status).toBe('started');
        const inFlightRes = await rpcReq(ws, 'chat.send', {
          sessionKey: 'main',
          message: 'hello',
          idempotencyKey: 'idem-status-1'
        });
        expect(inFlightRes.ok).toBe(true);
        expect(inFlightRes.payload?.status).toBe('in_flight');
        resolveRun?.();
        let completed = false;
        for (let i = 0; i < 20; i++) {
          const again = await rpcReq(ws, 'chat.send', {
            sessionKey: 'main',
            message: 'hello',
            idempotencyKey: 'idem-status-1'
          });
          if (again.ok && again.payload?.status === 'ok') {
            completed = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 10));
        }
        expect(completed).toBe(true);
        resetSpy();
        spy.mockImplementationOnce(async (_ctx, opts) => {
          opts?.onAgentRunStart?.(opts.runId ?? 'idem-abort-all-1');
          const signal = opts?.abortSignal;
          await new Promise((resolve) => {
            if (!signal) {
              return resolve();
            }
            if (signal.aborted) {
              return resolve();
            }
            signal.addEventListener('abort', () => resolve(), { once: true });
          });
        });
        const abortedEventP = onceMessage(
          ws,
          (o) => o.type === 'event' && o.event === 'chat' && o.payload?.state === 'aborted' && o.payload?.runId === 'idem-abort-all-1'
        );
        const startedAbortAll = await rpcReq(ws, 'chat.send', {
          sessionKey: 'main',
          message: 'hello',
          idempotencyKey: 'idem-abort-all-1'
        });
        expect(startedAbortAll.ok).toBe(true);
        const abortRes = await rpcReq(ws, 'chat.abort', { sessionKey: 'main' });
        expect(abortRes.ok).toBe(true);
        expect(abortRes.payload?.aborted).toBe(true);
        expect(abortRes.payload?.runIds ?? []).toContain('idem-abort-all-1');
        await abortedEventP;
        const noDeltaP = onceMessage(
          ws,
          (o) => o.type === 'event' && o.event === 'chat' && (o.payload?.state === 'delta' || o.payload?.state === 'final') && o.payload?.runId === 'idem-abort-all-1',
          250
        );
        emitAgentEvent({
          runId: 'idem-abort-all-1',
          stream: 'assistant',
          data: { text: 'should be suppressed' }
        });
        emitAgentEvent({
          runId: 'idem-abort-all-1',
          stream: 'lifecycle',
          data: { phase: 'end' }
        });
        await expect(noDeltaP).rejects.toThrow(/timeout/i);
        await writeStore({});
        const abortUnknown = await rpcReq(ws, 'chat.abort', { sessionKey: 'main', runId: 'missing-run' });
        expect(abortUnknown.ok).toBe(true);
        expect(abortUnknown.payload?.aborted).toBe(false);
        await writeStore({ main: { sessionId: 'sess-main', updatedAt: Date.now() } });
        resetSpy();
        let agentStartedResolve;
        const agentStartedP = new Promise((resolve) => {
          agentStartedResolve = resolve;
        });
        spy.mockImplementationOnce(async (_ctx, opts) => {
          agentStartedResolve?.();
          const signal = opts?.abortSignal;
          await new Promise((resolve) => {
            if (!signal) {
              return resolve();
            }
            if (signal.aborted) {
              return resolve();
            }
            signal.addEventListener('abort', () => resolve(), { once: true });
          });
        });
        const sendResP = onceMessage(
          ws,
          (o) => o.type === 'res' && o.id === 'send-mismatch-1',
          1e4
        );
        sendReq(ws, 'send-mismatch-1', 'chat.send', {
          sessionKey: 'main',
          message: 'hello',
          idempotencyKey: 'idem-mismatch-1',
          timeoutMs: 3e4
        });
        await agentStartedP;
        const abortMismatch = await rpcReq(ws, 'chat.abort', {
          sessionKey: 'other',
          runId: 'idem-mismatch-1'
        });
        expect(abortMismatch.ok).toBe(false);
        expect(abortMismatch.error?.code).toBe('INVALID_REQUEST');
        const abortMismatch2 = await rpcReq(ws, 'chat.abort', {
          sessionKey: 'main',
          runId: 'idem-mismatch-1'
        });
        expect(abortMismatch2.ok).toBe(true);
        const sendRes = await sendResP;
        expect(sendRes.ok).toBe(true);
        await writeStore({ main: { sessionId: 'sess-main', updatedAt: Date.now() } });
        resetSpy();
        spy.mockResolvedValueOnce(void 0);
        sendReq(ws, 'send-complete-1', 'chat.send', {
          sessionKey: 'main',
          message: 'hello',
          idempotencyKey: 'idem-complete-1',
          timeoutMs: 3e4
        });
        const sendCompleteRes = await onceMessage(
          ws,
          (o) => o.type === 'res' && o.id === 'send-complete-1'
        );
        expect(sendCompleteRes.ok).toBe(true);
        let completedRun = false;
        for (let i = 0; i < 20; i++) {
          const again = await rpcReq(ws, 'chat.send', {
            sessionKey: 'main',
            message: 'hello',
            idempotencyKey: 'idem-complete-1',
            timeoutMs: 3e4
          });
          if (again.ok && again.payload?.status === 'ok') {
            completedRun = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 10));
        }
        expect(completedRun).toBe(true);
        const abortCompleteRes = await rpcReq(ws, 'chat.abort', {
          sessionKey: 'main',
          runId: 'idem-complete-1'
        });
        expect(abortCompleteRes.ok).toBe(true);
        expect(abortCompleteRes.payload?.aborted).toBe(false);
        await writeStore({ main: { sessionId: 'sess-main', updatedAt: Date.now() } });
        const res1 = await rpcReq(ws, 'chat.send', {
          sessionKey: 'main',
          message: 'first',
          idempotencyKey: 'idem-1'
        });
        expect(res1.ok).toBe(true);
        const res2 = await rpcReq(ws, 'chat.send', {
          sessionKey: 'main',
          message: 'second',
          idempotencyKey: 'idem-2'
        });
        expect(res2.ok).toBe(true);
        const final1P = onceMessage(
          ws,
          (o) => o.type === 'event' && o.event === 'chat' && o.payload?.state === 'final',
          8e3
        );
        emitAgentEvent({
          runId: 'idem-1',
          stream: 'lifecycle',
          data: { phase: 'end' }
        });
        const final1 = await final1P;
        const run1 = final1.payload && typeof final1.payload === 'object' ? final1.payload.runId : void 0;
        expect(run1).toBe('idem-1');
        const final2P = onceMessage(
          ws,
          (o) => o.type === 'event' && o.event === 'chat' && o.payload?.state === 'final',
          8e3
        );
        emitAgentEvent({
          runId: 'idem-2',
          stream: 'lifecycle',
          data: { phase: 'end' }
        });
        const final2 = await final2P;
        const run2 = final2.payload && typeof final2.payload === 'object' ? final2.payload.runId : void 0;
        expect(run2).toBe('idem-2');
      } finally {
        __setMaxChatHistoryMessagesBytesForTest();
        testState.sessionStorePath = void 0;
        sessionStoreSaveDelayMs.value = 0;
        ws.close();
        await server.close();
        await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
      }
    }
  );
});
