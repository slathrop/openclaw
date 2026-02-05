import { isMessagingToolDuplicate } from '../../agents/pi-embedded-helpers.js';
import { normalizeTargetForProvider } from '../../infra/outbound/target-normalization.js';
import { extractReplyToTag } from './reply-tags.js';
import { createReplyToModeFilterForChannel } from './reply-threading.js';
function applyReplyTagsToPayload(payload, currentMessageId) {
  if (typeof payload.text !== 'string') {
    if (!payload.replyToCurrent || payload.replyToId) {
      return payload;
    }
    return {
      ...payload,
      replyToId: currentMessageId?.trim() || void 0
    };
  }
  const shouldParseTags = payload.text.includes('[[');
  if (!shouldParseTags) {
    if (!payload.replyToCurrent || payload.replyToId) {
      return payload;
    }
    return {
      ...payload,
      replyToId: currentMessageId?.trim() || void 0,
      replyToTag: payload.replyToTag ?? true
    };
  }
  const { cleaned, replyToId, replyToCurrent, hasTag } = extractReplyToTag(
    payload.text,
    currentMessageId
  );
  return {
    ...payload,
    text: cleaned ? cleaned : void 0,
    replyToId: replyToId ?? payload.replyToId,
    replyToTag: hasTag || payload.replyToTag,
    replyToCurrent: replyToCurrent || payload.replyToCurrent
  };
}
function isRenderablePayload(payload) {
  return Boolean(
    payload.text || payload.mediaUrl || payload.mediaUrls && payload.mediaUrls.length > 0 || payload.audioAsVoice || payload.channelData
  );
}
function applyReplyThreading(params) {
  const { payloads, replyToMode, replyToChannel, currentMessageId } = params;
  const applyReplyToMode = createReplyToModeFilterForChannel(replyToMode, replyToChannel);
  return payloads.map((payload) => applyReplyTagsToPayload(payload, currentMessageId)).filter(isRenderablePayload).map(applyReplyToMode);
}
function filterMessagingToolDuplicates(params) {
  const { payloads, sentTexts } = params;
  if (sentTexts.length === 0) {
    return payloads;
  }
  return payloads.filter((payload) => !isMessagingToolDuplicate(payload.text ?? '', sentTexts));
}
function normalizeAccountId(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : void 0;
}
function shouldSuppressMessagingToolReplies(params) {
  const provider = params.messageProvider?.trim().toLowerCase();
  if (!provider) {
    return false;
  }
  const originTarget = normalizeTargetForProvider(provider, params.originatingTo);
  if (!originTarget) {
    return false;
  }
  const originAccount = normalizeAccountId(params.accountId);
  const sentTargets = params.messagingToolSentTargets ?? [];
  if (sentTargets.length === 0) {
    return false;
  }
  return sentTargets.some((target) => {
    if (!target?.provider) {
      return false;
    }
    if (target.provider.trim().toLowerCase() !== provider) {
      return false;
    }
    const targetKey = normalizeTargetForProvider(provider, target.to);
    if (!targetKey) {
      return false;
    }
    const targetAccount = normalizeAccountId(target.accountId);
    if (originAccount && targetAccount && originAccount !== targetAccount) {
      return false;
    }
    return targetKey === originTarget;
  });
}
export {
  applyReplyTagsToPayload,
  applyReplyThreading,
  filterMessagingToolDuplicates,
  isRenderablePayload,
  shouldSuppressMessagingToolReplies
};
