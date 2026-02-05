import { Bot } from 'grammy';
import { withTelegramApiErrorLogging } from './api-logging.js';
import { resolveTelegramFetch } from './fetch.js';
async function setTelegramWebhook(opts) {
  const fetchImpl = resolveTelegramFetch(void 0, { network: opts.network });
  const client = fetchImpl ? { fetch: fetchImpl } : void 0;
  const bot = new Bot(opts.token, client ? { client } : void 0);
  await withTelegramApiErrorLogging({
    operation: 'setWebhook',
    fn: () => bot.api.setWebhook(opts.url, {
      secret_token: opts.secret,
      drop_pending_updates: opts.dropPendingUpdates ?? false
    })
  });
}
async function deleteTelegramWebhook(opts) {
  const fetchImpl = resolveTelegramFetch(void 0, { network: opts.network });
  const client = fetchImpl ? { fetch: fetchImpl } : void 0;
  const bot = new Bot(opts.token, client ? { client } : void 0);
  await withTelegramApiErrorLogging({
    operation: 'deleteWebhook',
    fn: () => bot.api.deleteWebhook()
  });
}
export {
  deleteTelegramWebhook,
  setTelegramWebhook
};
