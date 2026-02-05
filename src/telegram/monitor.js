const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { run } from '@grammyjs/runner';
import { resolveAgentMaxConcurrent } from '../config/agent-limits.js';
import { loadConfig } from '../config/config.js';
import { computeBackoff, sleepWithAbort } from '../infra/backoff.js';
import { formatErrorMessage } from '../infra/errors.js';
import { formatDurationMs } from '../infra/format-duration.js';
import { registerUnhandledRejectionHandler } from '../infra/unhandled-rejections.js';
import { resolveTelegramAccount } from './accounts.js';
import { resolveTelegramAllowedUpdates } from './allowed-updates.js';
import { createTelegramBot } from './bot.js';
import { isRecoverableTelegramNetworkError } from './network-errors.js';
import { makeProxyFetch } from './proxy.js';
import { readTelegramUpdateOffset, writeTelegramUpdateOffset } from './update-offset-store.js';
import { startTelegramWebhook } from './webhook.js';
function createTelegramRunnerOptions(cfg) {
  return {
    sink: {
      concurrency: resolveAgentMaxConcurrent(cfg)
    },
    runner: {
      fetch: {
        // Match grammY defaults
        timeout: 30,
        // Request reactions without dropping default update types.
        allowed_updates: resolveTelegramAllowedUpdates()
      },
      // Suppress grammY getUpdates stack traces; we log concise errors ourselves.
      silent: true,
      // Retry transient failures for a limited window before surfacing errors.
      maxRetryTime: 5 * 60 * 1e3,
      retryInterval: 'exponential'
    }
  };
}
__name(createTelegramRunnerOptions, 'createTelegramRunnerOptions');
const TELEGRAM_POLL_RESTART_POLICY = {
  initialMs: 2e3,
  maxMs: 3e4,
  factor: 1.8,
  jitter: 0.25
};
const isGetUpdatesConflict = /* @__PURE__ */ __name((err) => {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const typed = err;
  const errorCode = typed.error_code ?? typed.errorCode;
  if (errorCode !== 409) {
    return false;
  }
  const haystack = [typed.method, typed.description, typed.message].filter((value) => typeof value === 'string').join(' ').toLowerCase();
  return haystack.includes('getupdates');
}, 'isGetUpdatesConflict');
const isGrammyHttpError = /* @__PURE__ */ __name((err) => {
  if (!err || typeof err !== 'object') {
    return false;
  }
  return err.name === 'HttpError';
}, 'isGrammyHttpError');
async function monitorTelegramProvider(opts = {}) {
  const log = opts.runtime?.error ?? console.error;
  const unregisterHandler = registerUnhandledRejectionHandler((err) => {
    if (isGrammyHttpError(err) && isRecoverableTelegramNetworkError(err, { context: 'polling' })) {
      log(`[telegram] Suppressed network error: ${formatErrorMessage(err)}`);
      return true;
    }
    return false;
  });
  try {
    const cfg = opts.config ?? loadConfig();
    const account = resolveTelegramAccount({
      cfg,
      accountId: opts.accountId
    });
    const token = opts.token?.trim() || account.token;
    if (!token) {
      throw new Error(
        `Telegram bot token missing for account "${account.accountId}" (set channels.telegram.accounts.${account.accountId}.botToken/tokenFile or TELEGRAM_BOT_TOKEN for default).`
      );
    }
    const proxyFetch = opts.proxyFetch ?? (account.config.proxy ? makeProxyFetch(account.config.proxy) : void 0);
    let lastUpdateId = await readTelegramUpdateOffset({
      accountId: account.accountId
    });
    const persistUpdateId = /* @__PURE__ */ __name(async (updateId) => {
      if (lastUpdateId !== null && updateId <= lastUpdateId) {
        return;
      }
      lastUpdateId = updateId;
      try {
        await writeTelegramUpdateOffset({
          accountId: account.accountId,
          updateId
        });
      } catch (err) {
        (opts.runtime?.error ?? console.error)(
          `telegram: failed to persist update offset: ${String(err)}`
        );
      }
    }, 'persistUpdateId');
    const bot = createTelegramBot({
      token,
      runtime: opts.runtime,
      proxyFetch,
      config: cfg,
      accountId: account.accountId,
      updateOffset: {
        lastUpdateId,
        onUpdateId: persistUpdateId
      }
    });
    if (opts.useWebhook) {
      await startTelegramWebhook({
        token,
        accountId: account.accountId,
        config: cfg,
        path: opts.webhookPath,
        port: opts.webhookPort,
        secret: opts.webhookSecret,
        runtime: opts.runtime,
        fetch: proxyFetch,
        abortSignal: opts.abortSignal,
        publicUrl: opts.webhookUrl
      });
      return;
    }
    let restartAttempts = 0;
    while (!opts.abortSignal?.aborted) {
      const runner = run(bot, createTelegramRunnerOptions(cfg));
      const stopOnAbort = /* @__PURE__ */ __name(() => {
        if (opts.abortSignal?.aborted) {
          void runner.stop();
        }
      }, 'stopOnAbort');
      opts.abortSignal?.addEventListener('abort', stopOnAbort, { once: true });
      try {
        await runner.task();
        return;
      } catch (err) {
        if (opts.abortSignal?.aborted) {
          throw err;
        }
        const isConflict = isGetUpdatesConflict(err);
        const isRecoverable = isRecoverableTelegramNetworkError(err, { context: 'polling' });
        if (!isConflict && !isRecoverable) {
          throw err;
        }
        restartAttempts += 1;
        const delayMs = computeBackoff(TELEGRAM_POLL_RESTART_POLICY, restartAttempts);
        const reason = isConflict ? 'getUpdates conflict' : 'network error';
        const errMsg = formatErrorMessage(err);
        (opts.runtime?.error ?? console.error)(
          `Telegram ${reason}: ${errMsg}; retrying in ${formatDurationMs(delayMs)}.`
        );
        try {
          await sleepWithAbort(delayMs, opts.abortSignal);
        } catch (sleepErr) {
          if (opts.abortSignal?.aborted) {
            return;
          }
          throw sleepErr;
        }
      } finally {
        opts.abortSignal?.removeEventListener('abort', stopOnAbort);
      }
    }
  } finally {
    unregisterHandler();
  }
}
__name(monitorTelegramProvider, 'monitorTelegramProvider');
export {
  createTelegramRunnerOptions,
  monitorTelegramProvider
};
