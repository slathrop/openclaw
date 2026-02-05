const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { isVoiceCompatibleAudio } from '../media/audio.js';
function isTelegramVoiceCompatible(opts) {
  return isVoiceCompatibleAudio(opts);
}
__name(isTelegramVoiceCompatible, 'isTelegramVoiceCompatible');
function resolveTelegramVoiceDecision(opts) {
  if (!opts.wantsVoice) {
    return { useVoice: false };
  }
  if (isTelegramVoiceCompatible(opts)) {
    return { useVoice: true };
  }
  const contentType = opts.contentType ?? 'unknown';
  const fileName = opts.fileName ?? 'unknown';
  return {
    useVoice: false,
    reason: `media is ${contentType} (${fileName})`
  };
}
__name(resolveTelegramVoiceDecision, 'resolveTelegramVoiceDecision');
function resolveTelegramVoiceSend(opts) {
  const decision = resolveTelegramVoiceDecision(opts);
  if (decision.reason && opts.logFallback) {
    opts.logFallback(
      `Telegram voice requested but ${decision.reason}; sending as audio file instead.`
    );
  }
  return { useVoice: decision.useVoice };
}
__name(resolveTelegramVoiceSend, 'resolveTelegramVoiceSend');
export {
  isTelegramVoiceCompatible,
  resolveTelegramVoiceDecision,
  resolveTelegramVoiceSend
};
