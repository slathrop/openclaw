/** @module gateway/server-methods/cron -- Scheduled task (cron) RPC method handlers. */
import { normalizeCronJobCreate, normalizeCronJobPatch } from '../../cron/normalize.js';
import { readCronRunLogEntries, resolveCronRunLogPath } from '../../cron/run-log.js';
import { validateScheduleTimestamp } from '../../cron/validate-timestamp.js';
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateCronAddParams,
  validateCronListParams,
  validateCronRemoveParams,
  validateCronRunParams,
  validateCronRunsParams,
  validateCronStatusParams,
  validateCronUpdateParams,
  validateWakeParams
} from '../protocol/index.js';
const cronHandlers = {
  wake: ({ params, respond, context }) => {
    if (!validateWakeParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid wake params: ${formatValidationErrors(validateWakeParams.errors)}`
        )
      );
      return;
    }
    const p = params;
    const result = context.cron.wake({ mode: p.mode, text: p.text });
    respond(true, result, void 0);
  },
  'cron.list': async ({ params, respond, context }) => {
    if (!validateCronListParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid cron.list params: ${formatValidationErrors(validateCronListParams.errors)}`
        )
      );
      return;
    }
    const p = params;
    const jobs = await context.cron.list({
      includeDisabled: p.includeDisabled
    });
    respond(true, { jobs }, void 0);
  },
  'cron.status': async ({ params, respond, context }) => {
    if (!validateCronStatusParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid cron.status params: ${formatValidationErrors(validateCronStatusParams.errors)}`
        )
      );
      return;
    }
    const status = await context.cron.status();
    respond(true, status, void 0);
  },
  'cron.add': async ({ params, respond, context }) => {
    const normalized = normalizeCronJobCreate(params) ?? params;
    if (!validateCronAddParams(normalized)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid cron.add params: ${formatValidationErrors(validateCronAddParams.errors)}`
        )
      );
      return;
    }
    const jobCreate = normalized;
    const timestampValidation = validateScheduleTimestamp(jobCreate.schedule);
    if (!timestampValidation.ok) {
      respond(
        false,
        void 0,
        errorShape(ErrorCodes.INVALID_REQUEST, timestampValidation.message)
      );
      return;
    }
    const job = await context.cron.add(jobCreate);
    respond(true, job, void 0);
  },
  'cron.update': async ({ params, respond, context }) => {
    const normalizedPatch = normalizeCronJobPatch(params?.patch);
    const candidate = normalizedPatch && typeof params === 'object' && params !== null ? { ...params, patch: normalizedPatch } : params;
    if (!validateCronUpdateParams(candidate)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid cron.update params: ${formatValidationErrors(validateCronUpdateParams.errors)}`
        )
      );
      return;
    }
    const p = candidate;
    const jobId = p.id ?? p.jobId;
    if (!jobId) {
      respond(
        false,
        void 0,
        errorShape(ErrorCodes.INVALID_REQUEST, 'invalid cron.update params: missing id')
      );
      return;
    }
    const patch = p.patch;
    if (patch.schedule) {
      const timestampValidation = validateScheduleTimestamp(patch.schedule);
      if (!timestampValidation.ok) {
        respond(
          false,
          void 0,
          errorShape(ErrorCodes.INVALID_REQUEST, timestampValidation.message)
        );
        return;
      }
    }
    const job = await context.cron.update(jobId, patch);
    respond(true, job, void 0);
  },
  'cron.remove': async ({ params, respond, context }) => {
    if (!validateCronRemoveParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid cron.remove params: ${formatValidationErrors(validateCronRemoveParams.errors)}`
        )
      );
      return;
    }
    const p = params;
    const jobId = p.id ?? p.jobId;
    if (!jobId) {
      respond(
        false,
        void 0,
        errorShape(ErrorCodes.INVALID_REQUEST, 'invalid cron.remove params: missing id')
      );
      return;
    }
    const result = await context.cron.remove(jobId);
    respond(true, result, void 0);
  },
  'cron.run': async ({ params, respond, context }) => {
    if (!validateCronRunParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid cron.run params: ${formatValidationErrors(validateCronRunParams.errors)}`
        )
      );
      return;
    }
    const p = params;
    const jobId = p.id ?? p.jobId;
    if (!jobId) {
      respond(
        false,
        void 0,
        errorShape(ErrorCodes.INVALID_REQUEST, 'invalid cron.run params: missing id')
      );
      return;
    }
    const result = await context.cron.run(jobId, p.mode);
    respond(true, result, void 0);
  },
  'cron.runs': async ({ params, respond, context }) => {
    if (!validateCronRunsParams(params)) {
      respond(
        false,
        void 0,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid cron.runs params: ${formatValidationErrors(validateCronRunsParams.errors)}`
        )
      );
      return;
    }
    const p = params;
    const jobId = p.id ?? p.jobId;
    if (!jobId) {
      respond(
        false,
        void 0,
        errorShape(ErrorCodes.INVALID_REQUEST, 'invalid cron.runs params: missing id')
      );
      return;
    }
    const logPath = resolveCronRunLogPath({
      storePath: context.cronStorePath,
      jobId
    });
    const entries = await readCronRunLogEntries(logPath, {
      limit: p.limit,
      jobId
    });
    respond(true, { entries }, void 0);
  }
};
export {
  cronHandlers
};
