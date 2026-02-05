/** @module gateway/server-methods/update -- Self-update RPC method handler. */
import { loadConfig } from '../../config/config.js';
import { resolveOpenClawPackageRoot } from '../../infra/openclaw-root.js';
import {
  formatDoctorNonInteractiveHint,
  writeRestartSentinel
} from '../../infra/restart-sentinel.js';
import { scheduleGatewaySigusr1Restart } from '../../infra/restart.js';
import { normalizeUpdateChannel } from '../../infra/update-channels.js';
import { runGatewayUpdate } from '../../infra/update-runner.js';
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateUpdateRunParams
} from '../protocol/index.js';
const updateHandlers = {
  'update.run': async ({ params, respond }) => {
    if (!validateUpdateRunParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid update.run params: ${formatValidationErrors(validateUpdateRunParams.errors)}`
        )
      );
      return;
    }
    const sessionKey = typeof params.sessionKey === 'string' ? params.sessionKey?.trim() || void 0 : void 0;
    const note = typeof params.note === 'string' ? params.note?.trim() || void 0 : void 0;
    const restartDelayMsRaw = params.restartDelayMs;
    const restartDelayMs = typeof restartDelayMsRaw === 'number' && Number.isFinite(restartDelayMsRaw) ? Math.max(0, Math.floor(restartDelayMsRaw)) : void 0;
    const timeoutMsRaw = params.timeoutMs;
    const timeoutMs = typeof timeoutMsRaw === 'number' && Number.isFinite(timeoutMsRaw) ? Math.max(1e3, Math.floor(timeoutMsRaw)) : void 0;
    let result;
    try {
      const config = loadConfig();
      const configChannel = normalizeUpdateChannel(config.update?.channel);
      const root = await resolveOpenClawPackageRoot({
        moduleUrl: import.meta.url,
        argv1: process.argv[1],
        cwd: process.cwd()
      }) ?? process.cwd();
      result = await runGatewayUpdate({
        timeoutMs,
        cwd: root,
        argv1: process.argv[1],
        channel: configChannel ?? void 0
      });
    } catch (err) {
      result = {
        status: 'error',
        mode: 'unknown',
        reason: String(err),
        steps: [],
        durationMs: 0
      };
    }
    const payload = {
      kind: 'update',
      status: result.status,
      ts: Date.now(),
      sessionKey,
      message: note ?? null,
      doctorHint: formatDoctorNonInteractiveHint(),
      stats: {
        mode: result.mode,
        root: result.root ?? void 0,
        before: result.before ?? null,
        after: result.after ?? null,
        steps: result.steps.map((step) => ({
          name: step.name,
          command: step.command,
          cwd: step.cwd,
          durationMs: step.durationMs,
          log: {
            stdoutTail: step.stdoutTail ?? null,
            stderrTail: step.stderrTail ?? null,
            exitCode: step.exitCode ?? null
          }
        })),
        reason: result.reason ?? null,
        durationMs: result.durationMs
      }
    };
    let sentinelPath = null;
    try {
      sentinelPath = await writeRestartSentinel(payload);
    } catch {
      sentinelPath = null;
    }
    const restart = scheduleGatewaySigusr1Restart({
      delayMs: restartDelayMs,
      reason: 'update.run'
    });
    respond(
      true,
      {
        ok: true,
        result,
        restart,
        sentinel: {
          path: sentinelPath,
          payload
        }
      },
      void 0
    );
  }
};
export {
  updateHandlers
};
