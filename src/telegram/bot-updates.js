const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { createDedupeCache } from '../infra/dedupe.js';
const MEDIA_GROUP_TIMEOUT_MS = 500;
const RECENT_TELEGRAM_UPDATE_TTL_MS = 5 * 6e4;
const RECENT_TELEGRAM_UPDATE_MAX = 2e3;
const resolveTelegramUpdateId = /* @__PURE__ */ __name((ctx) => ctx.update?.update_id ?? ctx.update_id, 'resolveTelegramUpdateId');
const buildTelegramUpdateKey = /* @__PURE__ */ __name((ctx) => {
  const updateId = resolveTelegramUpdateId(ctx);
  if (typeof updateId === 'number') {
    return `update:${updateId}`;
  }
  const callbackId = ctx.callbackQuery?.id;
  if (callbackId) {
    return `callback:${callbackId}`;
  }
  const msg = ctx.message ?? ctx.update?.message ?? ctx.update?.edited_message ?? ctx.callbackQuery?.message;
  const chatId = msg?.chat?.id;
  const messageId = msg?.message_id;
  if (typeof chatId !== 'undefined' && typeof messageId === 'number') {
    return `message:${chatId}:${messageId}`;
  }
  return void 0;
}, 'buildTelegramUpdateKey');
const createTelegramUpdateDedupe = /* @__PURE__ */ __name(() => createDedupeCache({
  ttlMs: RECENT_TELEGRAM_UPDATE_TTL_MS,
  maxSize: RECENT_TELEGRAM_UPDATE_MAX
}), 'createTelegramUpdateDedupe');
export {
  MEDIA_GROUP_TIMEOUT_MS,
  buildTelegramUpdateKey,
  createTelegramUpdateDedupe,
  resolveTelegramUpdateId
};
