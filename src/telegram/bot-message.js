import {
  buildTelegramMessageContext
} from './bot-message-context.js';
import { dispatchTelegramMessage } from './bot-message-dispatch.js';

/**
 * @typedef {import('./bot-message-context.js').TelegramMediaRef} TelegramMediaRef
 * @typedef {import('./bot-message-context.js').BuildTelegramMessageContextParams} BuildTelegramMessageContextParams
 */

/**
 * Dependencies injected once when creating the message processor.
 * Uses Omit pattern from BuildTelegramMessageContextParams for shared deps.
 * @typedef {Omit<BuildTelegramMessageContextParams, 'primaryCtx' | 'allMedia' | 'storeAllowFrom' | 'options'> & {
 *   telegramCfg: import('../config/types.telegram.js').TelegramAccountConfig;
 *   runtime: import('../runtime.js').RuntimeEnv;
 *   replyToMode: import('../config/config.js').ReplyToMode;
 *   streamMode: import('./bot/types.js').TelegramStreamMode;
 *   textLimit: number;
 *   opts: Pick<import('./bot.js').TelegramBotOptions, 'token'>;
 *   resolveBotTopicsEnabled: (ctx: import('./bot/types.js').TelegramContext) => boolean | Promise<boolean>;
 * }} TelegramMessageProcessorDeps
 */

/**
 * Create a Telegram message processor with injected dependencies.
 * @param {TelegramMessageProcessorDeps} deps
 */
const createTelegramMessageProcessor = (deps) => {
  const {
    bot,
    cfg,
    account,
    telegramCfg,
    historyLimit,
    groupHistories,
    dmPolicy,
    allowFrom,
    groupAllowFrom,
    ackReactionScope,
    logger,
    resolveGroupActivation,
    resolveGroupRequireMention,
    resolveTelegramGroupConfig,
    runtime,
    replyToMode,
    streamMode,
    textLimit,
    opts,
    resolveBotTopicsEnabled
  } = deps;
  return async (primaryCtx, allMedia, storeAllowFrom, options) => {
    const context = await buildTelegramMessageContext({
      primaryCtx,
      allMedia,
      storeAllowFrom,
      options,
      bot,
      cfg,
      account,
      historyLimit,
      groupHistories,
      dmPolicy,
      allowFrom,
      groupAllowFrom,
      ackReactionScope,
      logger,
      resolveGroupActivation,
      resolveGroupRequireMention,
      resolveTelegramGroupConfig
    });
    if (!context) {
      return;
    }
    await dispatchTelegramMessage({
      context,
      bot,
      cfg,
      runtime,
      replyToMode,
      streamMode,
      textLimit,
      telegramCfg,
      opts,
      resolveBotTopicsEnabled
    });
  };
};
export {
  createTelegramMessageProcessor
};
