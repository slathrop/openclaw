/**
 * Outbound payload normalization.
 * Parses media directives, deduplicates URLs, and normalizes
 * reply payloads into a consistent format for delivery.
 * @module
 */

import { parseReplyDirectives } from '../../auto-reply/reply/reply-directives.js';
import { isRenderablePayload } from '../../auto-reply/reply/reply-payloads.js';
function mergeMediaUrls(...lists) {
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  for (const list of lists) {
    if (!list) {
      continue;
    }
    for (const entry of list) {
      const trimmed = entry?.trim();
      if (!trimmed) {
        continue;
      }
      if (seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      merged.push(trimmed);
    }
  }
  return merged;
}
function normalizeReplyPayloadsForDelivery(payloads) {
  return payloads.flatMap((payload) => {
    const parsed = parseReplyDirectives(payload.text ?? '');
    const explicitMediaUrls = payload.mediaUrls ?? parsed.mediaUrls;
    const explicitMediaUrl = payload.mediaUrl ?? parsed.mediaUrl;
    const mergedMedia = mergeMediaUrls(
      explicitMediaUrls,
      explicitMediaUrl ? [explicitMediaUrl] : void 0
    );
    const hasMultipleMedia = (explicitMediaUrls?.length ?? 0) > 1;
    const resolvedMediaUrl = hasMultipleMedia ? void 0 : explicitMediaUrl;
    const next = {
      ...payload,
      text: parsed.text ?? '',
      mediaUrls: mergedMedia.length ? mergedMedia : void 0,
      mediaUrl: resolvedMediaUrl,
      replyToId: payload.replyToId ?? parsed.replyToId,
      replyToTag: payload.replyToTag || parsed.replyToTag,
      replyToCurrent: payload.replyToCurrent || parsed.replyToCurrent,
      audioAsVoice: Boolean(payload.audioAsVoice || parsed.audioAsVoice)
    };
    if (parsed.isSilent && mergedMedia.length === 0) {
      return [];
    }
    if (!isRenderablePayload(next)) {
      return [];
    }
    return [next];
  });
}
function normalizeOutboundPayloads(payloads) {
  return normalizeReplyPayloadsForDelivery(payloads).map((payload) => {
    const channelData = payload.channelData;
    const normalized = {
      text: payload.text ?? '',
      mediaUrls: payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : [])
    };
    if (channelData && Object.keys(channelData).length > 0) {
      normalized.channelData = channelData;
    }
    return normalized;
  }).filter(
    (payload) => payload.text || payload.mediaUrls.length > 0 || Boolean(payload.channelData && Object.keys(payload.channelData).length > 0)
  );
}
function normalizeOutboundPayloadsForJson(payloads) {
  return normalizeReplyPayloadsForDelivery(payloads).map((payload) => ({
    text: payload.text ?? '',
    mediaUrl: payload.mediaUrl ?? null,
    mediaUrls: payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : void 0),
    channelData: payload.channelData
  }));
}
function formatOutboundPayloadLog(payload) {
  const lines = [];
  if (payload.text) {
    lines.push(payload.text.trimEnd());
  }
  for (const url of payload.mediaUrls) {
    lines.push(`MEDIA:${url}`);
  }
  return lines.join('\n');
}
export {
  formatOutboundPayloadLog,
  normalizeOutboundPayloads,
  normalizeOutboundPayloadsForJson,
  normalizeReplyPayloadsForDelivery
};
