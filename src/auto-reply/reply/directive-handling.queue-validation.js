import { withOptions } from './directive-handling.shared.js';
import { resolveQueueSettings } from './queue.js';
function maybeHandleQueueDirective(params) {
  const { directives } = params;
  if (!directives.hasQueueDirective) {
    return void 0;
  }
  const wantsStatus = !directives.queueMode && !directives.queueReset && !directives.hasQueueOptions && directives.rawQueueMode === void 0 && directives.rawDebounce === void 0 && directives.rawCap === void 0 && directives.rawDrop === void 0;
  if (wantsStatus) {
    const settings = resolveQueueSettings({
      cfg: params.cfg,
      channel: params.channel,
      sessionEntry: params.sessionEntry
    });
    const debounceLabel = typeof settings.debounceMs === 'number' ? `${settings.debounceMs}ms` : 'default';
    const capLabel = typeof settings.cap === 'number' ? String(settings.cap) : 'default';
    const dropLabel = settings.dropPolicy ?? 'default';
    return {
      text: withOptions(
        `Current queue settings: mode=${settings.mode}, debounce=${debounceLabel}, cap=${capLabel}, drop=${dropLabel}.`,
        'modes steer, followup, collect, steer+backlog, interrupt; debounce:<ms|s|m>, cap:<n>, drop:old|new|summarize'
      )
    };
  }
  const queueModeInvalid = !directives.queueMode && !directives.queueReset && Boolean(directives.rawQueueMode);
  const queueDebounceInvalid = directives.rawDebounce !== void 0 && typeof directives.debounceMs !== 'number';
  const queueCapInvalid = directives.rawCap !== void 0 && typeof directives.cap !== 'number';
  const queueDropInvalid = directives.rawDrop !== void 0 && !directives.dropPolicy;
  if (queueModeInvalid || queueDebounceInvalid || queueCapInvalid || queueDropInvalid) {
    const errors = [];
    if (queueModeInvalid) {
      errors.push(
        `Unrecognized queue mode "${directives.rawQueueMode ?? ''}". Valid modes: steer, followup, collect, steer+backlog, interrupt.`
      );
    }
    if (queueDebounceInvalid) {
      errors.push(
        `Invalid debounce "${directives.rawDebounce ?? ''}". Use ms/s/m (e.g. debounce:1500ms, debounce:2s).`
      );
    }
    if (queueCapInvalid) {
      errors.push(
        `Invalid cap "${directives.rawCap ?? ''}". Use a positive integer (e.g. cap:10).`
      );
    }
    if (queueDropInvalid) {
      errors.push(
        `Invalid drop policy "${directives.rawDrop ?? ''}". Use drop:old, drop:new, or drop:summarize.`
      );
    }
    return { text: errors.join(' ') };
  }
  return void 0;
}
export {
  maybeHandleQueueDirective
};
