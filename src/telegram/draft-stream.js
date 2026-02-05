const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { buildTelegramThreadParams } from './bot/helpers.js';
const TELEGRAM_DRAFT_MAX_CHARS = 4096;
const DEFAULT_THROTTLE_MS = 300;
function createTelegramDraftStream(params) {
  const maxChars = Math.min(params.maxChars ?? TELEGRAM_DRAFT_MAX_CHARS, TELEGRAM_DRAFT_MAX_CHARS);
  const throttleMs = Math.max(50, params.throttleMs ?? DEFAULT_THROTTLE_MS);
  const rawDraftId = Number.isFinite(params.draftId) ? Math.trunc(params.draftId) : 1;
  const draftId = rawDraftId === 0 ? 1 : Math.abs(rawDraftId);
  const chatId = params.chatId;
  const threadParams = buildTelegramThreadParams(params.thread);
  let lastSentText = '';
  let lastSentAt = 0;
  let pendingText = '';
  let inFlight = false;
  let timer;
  let stopped = false;
  const sendDraft = /* @__PURE__ */ __name(async (text) => {
    if (stopped) {
      return;
    }
    const trimmed = text.trimEnd();
    if (!trimmed) {
      return;
    }
    if (trimmed.length > maxChars) {
      stopped = true;
      params.warn?.(`telegram draft stream stopped (draft length ${trimmed.length} > ${maxChars})`);
      return;
    }
    if (trimmed === lastSentText) {
      return;
    }
    lastSentText = trimmed;
    lastSentAt = Date.now();
    try {
      await params.api.sendMessageDraft(chatId, draftId, trimmed, threadParams);
    } catch (err) {
      stopped = true;
      params.warn?.(
        `telegram draft stream failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, 'sendDraft');
  const flush = /* @__PURE__ */ __name(async () => {
    if (timer) {
      clearTimeout(timer);
      timer = void 0;
    }
    if (inFlight) {
      schedule();
      return;
    }
    const text = pendingText;
    const trimmed = text.trim();
    if (!trimmed) {
      if (pendingText === text) {
        pendingText = '';
      }
      if (pendingText) {
        schedule();
      }
      return;
    }
    pendingText = '';
    inFlight = true;
    try {
      await sendDraft(text);
    } finally {
      inFlight = false;
    }
    if (pendingText) {
      schedule();
    }
  }, 'flush');
  const schedule = /* @__PURE__ */ __name(() => {
    if (timer) {
      return;
    }
    const delay = Math.max(0, throttleMs - (Date.now() - lastSentAt));
    timer = setTimeout(() => {
      void flush();
    }, delay);
  }, 'schedule');
  const update = /* @__PURE__ */ __name((text) => {
    if (stopped) {
      return;
    }
    pendingText = text;
    if (inFlight) {
      schedule();
      return;
    }
    if (!timer && Date.now() - lastSentAt >= throttleMs) {
      void flush();
      return;
    }
    schedule();
  }, 'update');
  const stop = /* @__PURE__ */ __name(() => {
    stopped = true;
    pendingText = '';
    if (timer) {
      clearTimeout(timer);
      timer = void 0;
    }
  }, 'stop');
  params.log?.(
    `telegram draft stream ready (draftId=${draftId}, maxChars=${maxChars}, throttleMs=${throttleMs})`
  );
  return { update, flush, stop };
}
__name(createTelegramDraftStream, 'createTelegramDraftStream');
export {
  createTelegramDraftStream
};
