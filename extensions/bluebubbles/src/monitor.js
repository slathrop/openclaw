import {
  createReplyPrefixOptions,
  logAckFailure,
  logInboundDrop,
  logTypingFailure,
  resolveAckReaction,
  resolveControlCommandGate
} from 'openclaw/plugin-sdk';
import { downloadBlueBubblesAttachment } from './attachments.js';
import { markBlueBubblesChatRead, sendBlueBubblesTyping } from './chat.js';
import { sendBlueBubblesMedia } from './media-send.js';
import { fetchBlueBubblesServerInfo } from './probe.js';
import { normalizeBlueBubblesReactionInput, sendBlueBubblesReaction } from './reactions.js';
import { getBlueBubblesRuntime } from './runtime.js';
import { resolveChatGuidForTarget, sendMessageBlueBubbles } from './send.js';
import {
  formatBlueBubblesChatTarget,
  isAllowedBlueBubblesSender,
  normalizeBlueBubblesHandle
} from './targets.js';
const DEFAULT_WEBHOOK_PATH = '/bluebubbles-webhook';
const DEFAULT_TEXT_LIMIT = 4e3;
const invalidAckReactions = /* @__PURE__ */ new Set();
const REPLY_CACHE_MAX = 2e3;
const REPLY_CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
const blueBubblesReplyCacheByMessageId = /* @__PURE__ */ new Map();
const blueBubblesShortIdToUuid = /* @__PURE__ */ new Map();
const blueBubblesUuidToShortId = /* @__PURE__ */ new Map();
let blueBubblesShortIdCounter = 0;
function trimOrUndefined(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : void 0;
}
function generateShortId() {
  blueBubblesShortIdCounter += 1;
  return String(blueBubblesShortIdCounter);
}
function rememberBlueBubblesReplyCache(entry) {
  const messageId = entry.messageId.trim();
  if (!messageId) {
    return { ...entry, shortId: '' };
  }
  let shortId = blueBubblesUuidToShortId.get(messageId);
  if (!shortId) {
    shortId = generateShortId();
    blueBubblesShortIdToUuid.set(shortId, messageId);
    blueBubblesUuidToShortId.set(messageId, shortId);
  }
  const fullEntry = { ...entry, messageId, shortId };
  blueBubblesReplyCacheByMessageId.delete(messageId);
  blueBubblesReplyCacheByMessageId.set(messageId, fullEntry);
  const cutoff = Date.now() - REPLY_CACHE_TTL_MS;
  for (const [key, value] of blueBubblesReplyCacheByMessageId) {
    if (value.timestamp < cutoff) {
      blueBubblesReplyCacheByMessageId.delete(key);
      if (value.shortId) {
        blueBubblesShortIdToUuid.delete(value.shortId);
        blueBubblesUuidToShortId.delete(key);
      }
      continue;
    }
    break;
  }
  while (blueBubblesReplyCacheByMessageId.size > REPLY_CACHE_MAX) {
    const oldest = blueBubblesReplyCacheByMessageId.keys().next().value;
    if (!oldest) {
      break;
    }
    const oldEntry = blueBubblesReplyCacheByMessageId.get(oldest);
    blueBubblesReplyCacheByMessageId.delete(oldest);
    if (oldEntry?.shortId) {
      blueBubblesShortIdToUuid.delete(oldEntry.shortId);
      blueBubblesUuidToShortId.delete(oldest);
    }
  }
  return fullEntry;
}
function resolveBlueBubblesMessageId(shortOrUuid, opts) {
  const trimmed = shortOrUuid.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (/^\d+$/.test(trimmed)) {
    const uuid = blueBubblesShortIdToUuid.get(trimmed);
    if (uuid) {
      return uuid;
    }
    if (opts?.requireKnownShortId) {
      throw new Error(
        `BlueBubbles short message id "${trimmed}" is no longer available. Use MessageSidFull.`
      );
    }
  }
  return trimmed;
}
function _resetBlueBubblesShortIdState() {
  blueBubblesShortIdToUuid.clear();
  blueBubblesUuidToShortId.clear();
  blueBubblesReplyCacheByMessageId.clear();
  blueBubblesShortIdCounter = 0;
}
function getShortIdForUuid(uuid) {
  return blueBubblesUuidToShortId.get(uuid.trim());
}
function resolveReplyContextFromCache(params) {
  const replyToId = params.replyToId.trim();
  if (!replyToId) {
    return null;
  }
  const cached = blueBubblesReplyCacheByMessageId.get(replyToId);
  if (!cached) {
    return null;
  }
  if (cached.accountId !== params.accountId) {
    return null;
  }
  const cutoff = Date.now() - REPLY_CACHE_TTL_MS;
  if (cached.timestamp < cutoff) {
    blueBubblesReplyCacheByMessageId.delete(replyToId);
    return null;
  }
  const chatGuid = trimOrUndefined(params.chatGuid);
  const chatIdentifier = trimOrUndefined(params.chatIdentifier);
  const cachedChatGuid = trimOrUndefined(cached.chatGuid);
  const cachedChatIdentifier = trimOrUndefined(cached.chatIdentifier);
  const chatId = typeof params.chatId === 'number' ? params.chatId : void 0;
  const cachedChatId = typeof cached.chatId === 'number' ? cached.chatId : void 0;
  if (chatGuid && cachedChatGuid && chatGuid !== cachedChatGuid) {
    return null;
  }
  if (!chatGuid && chatIdentifier && cachedChatIdentifier && chatIdentifier !== cachedChatIdentifier) {
    return null;
  }
  if (!chatGuid && !chatIdentifier && chatId && cachedChatId && chatId !== cachedChatId) {
    return null;
  }
  return cached;
}
function logVerbose(core, runtime, message) {
  if (core.logging.shouldLogVerbose()) {
    runtime.log?.(`[bluebubbles] ${message}`);
  }
}
function logGroupAllowlistHint(params) {
  const log = params.runtime.log ?? console.log;
  const nameHint = params.chatName ? ` (group name: ${params.chatName})` : '';
  const accountHint = params.accountId ? ` (or channels.bluebubbles.accounts.${params.accountId}.groupAllowFrom)` : '';
  if (params.entry) {
    log(
      `[bluebubbles] group message blocked (${params.reason}). Allow this group by adding "${params.entry}" to channels.bluebubbles.groupAllowFrom${nameHint}.`
    );
    log(
      `[bluebubbles] add to config: channels.bluebubbles.groupAllowFrom=["${params.entry}"]${accountHint}.`
    );
    return;
  }
  log(
    `[bluebubbles] group message blocked (${params.reason}). Allow groups by setting channels.bluebubbles.groupPolicy="open" or adding a group id to channels.bluebubbles.groupAllowFrom${accountHint}${nameHint}.`
  );
}
const DEFAULT_INBOUND_DEBOUNCE_MS = 500;
function combineDebounceEntries(entries) {
  if (entries.length === 0) {
    throw new Error('Cannot combine empty entries');
  }
  if (entries.length === 1) {
    return entries[0].message;
  }
  const first = entries[0].message;
  const seenTexts = /* @__PURE__ */ new Set();
  const textParts = [];
  for (const entry of entries) {
    const text = entry.message.text.trim();
    if (!text) {
      continue;
    }
    const normalizedText = text.toLowerCase();
    if (seenTexts.has(normalizedText)) {
      continue;
    }
    seenTexts.add(normalizedText);
    textParts.push(text);
  }
  const allAttachments = entries.flatMap((e) => e.message.attachments ?? []);
  const timestamps = entries.map((e) => e.message.timestamp).filter((t) => typeof t === 'number');
  const latestTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : first.timestamp;
  const messageIds = entries.map((e) => e.message.messageId).filter((id) => Boolean(id));
  const entryWithReply = entries.find((e) => e.message.replyToId);
  return {
    ...first,
    text: textParts.join(' '),
    attachments: allAttachments.length > 0 ? allAttachments : first.attachments,
    timestamp: latestTimestamp,
    // Use first message's ID as primary (for reply reference), but we've coalesced others
    messageId: messageIds[0] ?? first.messageId,
    // Preserve reply context if present
    replyToId: entryWithReply?.message.replyToId ?? first.replyToId,
    replyToBody: entryWithReply?.message.replyToBody ?? first.replyToBody,
    replyToSender: entryWithReply?.message.replyToSender ?? first.replyToSender,
    // Clear balloonBundleId since we've combined (the combined message is no longer just a balloon)
    balloonBundleId: void 0
  };
}
const webhookTargets = /* @__PURE__ */ new Map();
const targetDebouncers = /* @__PURE__ */ new Map();
function resolveBlueBubblesDebounceMs(config, core) {
  const inbound = config.messages?.inbound;
  const hasExplicitDebounce = typeof inbound?.debounceMs === 'number' || typeof inbound?.byChannel?.bluebubbles === 'number';
  if (!hasExplicitDebounce) {
    return DEFAULT_INBOUND_DEBOUNCE_MS;
  }
  return core.channel.debounce.resolveInboundDebounceMs({ cfg: config, channel: 'bluebubbles' });
}
function getOrCreateDebouncer(target) {
  const existing = targetDebouncers.get(target);
  if (existing) {
    return existing;
  }
  const { account, config, runtime, core } = target;
  const debouncer = core.channel.debounce.createInboundDebouncer({
    debounceMs: resolveBlueBubblesDebounceMs(config, core),
    buildKey: (entry) => {
      const msg = entry.message;
      const balloonBundleId = msg.balloonBundleId?.trim();
      const associatedMessageGuid = msg.associatedMessageGuid?.trim();
      if (balloonBundleId && associatedMessageGuid) {
        return `bluebubbles:${account.accountId}:balloon:${associatedMessageGuid}`;
      }
      const messageId = msg.messageId?.trim();
      if (messageId) {
        return `bluebubbles:${account.accountId}:msg:${messageId}`;
      }
      const chatKey = msg.chatGuid?.trim() ?? msg.chatIdentifier?.trim() ?? (msg.chatId ? String(msg.chatId) : 'dm');
      return `bluebubbles:${account.accountId}:${chatKey}:${msg.senderId}`;
    },
    shouldDebounce: (entry) => {
      const msg = entry.message;
      if (msg.fromMe) {
        return false;
      }
      if (core.channel.text.hasControlCommand(msg.text, config)) {
        return false;
      }
      return true;
    },
    onFlush: async (entries) => {
      if (entries.length === 0) {
        return;
      }
      const flushTarget = entries[0].target;
      if (entries.length === 1) {
        await processMessage(entries[0].message, flushTarget);
        return;
      }
      const combined = combineDebounceEntries(entries);
      if (core.logging.shouldLogVerbose()) {
        const count = entries.length;
        const preview = combined.text.slice(0, 50);
        runtime.log?.(
          `[bluebubbles] coalesced ${count} messages: "${preview}${combined.text.length > 50 ? '...' : ''}"`
        );
      }
      await processMessage(combined, flushTarget);
    },
    onError: (err) => {
      runtime.error?.(`[${account.accountId}] [bluebubbles] debounce flush failed: ${String(err)}`);
    }
  });
  targetDebouncers.set(target, debouncer);
  return debouncer;
}
function removeDebouncer(target) {
  targetDebouncers.delete(target);
}
function normalizeWebhookPath(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '/';
  }
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (withSlash.length > 1 && withSlash.endsWith('/')) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
}
function registerBlueBubblesWebhookTarget(target) {
  const key = normalizeWebhookPath(target.path);
  const normalizedTarget = { ...target, path: key };
  const existing = webhookTargets.get(key) ?? [];
  const next = [...existing, normalizedTarget];
  webhookTargets.set(key, next);
  return () => {
    const updated = (webhookTargets.get(key) ?? []).filter((entry) => entry !== normalizedTarget);
    if (updated.length > 0) {
      webhookTargets.set(key, updated);
    } else {
      webhookTargets.delete(key);
    }
    removeDebouncer(normalizedTarget);
  };
}
async function readJsonBody(req, maxBytes) {
  const chunks = [];
  let total = 0;
  return await new Promise((resolve) => {
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        resolve({ ok: false, error: 'payload too large' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw.trim()) {
          resolve({ ok: false, error: 'empty payload' });
          return;
        }
        try {
          resolve({ ok: true, value: JSON.parse(raw) });
          return;
        } catch {
          const params = new URLSearchParams(raw);
          const payload = params.get('payload') ?? params.get('data') ?? params.get('message');
          if (payload) {
            resolve({ ok: true, value: JSON.parse(payload) });
            return;
          }
          throw new Error('invalid json');
        }
      } catch (err) {
        resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    });
    req.on('error', (err) => {
      resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
    });
  });
}
function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function readString(record, key) {
  if (!record) {
    return void 0;
  }
  const value = record[key];
  return typeof value === 'string' ? value : void 0;
}
function readNumber(record, key) {
  if (!record) {
    return void 0;
  }
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : void 0;
}
function readBoolean(record, key) {
  if (!record) {
    return void 0;
  }
  const value = record[key];
  return typeof value === 'boolean' ? value : void 0;
}
function extractAttachments(message) {
  const raw = message['attachments'];
  if (!Array.isArray(raw)) {
    return [];
  }
  const out = [];
  for (const entry of raw) {
    const record = asRecord(entry);
    if (!record) {
      continue;
    }
    out.push({
      guid: readString(record, 'guid'),
      uti: readString(record, 'uti'),
      mimeType: readString(record, 'mimeType') ?? readString(record, 'mime_type'),
      transferName: readString(record, 'transferName') ?? readString(record, 'transfer_name'),
      totalBytes: readNumberLike(record, 'totalBytes') ?? readNumberLike(record, 'total_bytes'),
      height: readNumberLike(record, 'height'),
      width: readNumberLike(record, 'width'),
      originalROWID: readNumberLike(record, 'originalROWID') ?? readNumberLike(record, 'rowid')
    });
  }
  return out;
}
function buildAttachmentPlaceholder(attachments) {
  if (attachments.length === 0) {
    return '';
  }
  const mimeTypes = attachments.map((entry) => entry.mimeType ?? '');
  const allImages = mimeTypes.every((entry) => entry.startsWith('image/'));
  const allVideos = mimeTypes.every((entry) => entry.startsWith('video/'));
  const allAudio = mimeTypes.every((entry) => entry.startsWith('audio/'));
  const tag = allImages ? '<media:image>' : allVideos ? '<media:video>' : allAudio ? '<media:audio>' : '<media:attachment>';
  const label = allImages ? 'image' : allVideos ? 'video' : allAudio ? 'audio' : 'file';
  const suffix = attachments.length === 1 ? label : `${label}s`;
  return `${tag} (${attachments.length} ${suffix})`;
}
function buildMessagePlaceholder(message) {
  const attachmentPlaceholder = buildAttachmentPlaceholder(message.attachments ?? []);
  if (attachmentPlaceholder) {
    return attachmentPlaceholder;
  }
  if (message.balloonBundleId) {
    return '<media:sticker>';
  }
  return '';
}
function formatReplyTag(message) {
  const rawId = message.replyToShortId || message.replyToId;
  if (!rawId) {
    return null;
  }
  return `[[reply_to:${rawId}]]`;
}
function readNumberLike(record, key) {
  if (!record) {
    return void 0;
  }
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return void 0;
}
function extractReplyMetadata(message) {
  const replyRaw = message['replyTo'] ?? message['reply_to'] ?? message['replyToMessage'] ?? message['reply_to_message'] ?? message['repliedMessage'] ?? message['quotedMessage'] ?? message['associatedMessage'] ?? message['reply'];
  const replyRecord = asRecord(replyRaw);
  const replyHandle = asRecord(replyRecord?.['handle']) ?? asRecord(replyRecord?.['sender']) ?? null;
  const replySenderRaw = readString(replyHandle, 'address') ?? readString(replyHandle, 'handle') ?? readString(replyHandle, 'id') ?? readString(replyRecord, 'senderId') ?? readString(replyRecord, 'sender') ?? readString(replyRecord, 'from');
  const normalizedSender = replySenderRaw ? normalizeBlueBubblesHandle(replySenderRaw) || replySenderRaw.trim() : void 0;
  const replyToBody = readString(replyRecord, 'text') ?? readString(replyRecord, 'body') ?? readString(replyRecord, 'message') ?? readString(replyRecord, 'subject') ?? void 0;
  const directReplyId = readString(message, 'replyToMessageGuid') ?? readString(message, 'replyToGuid') ?? readString(message, 'replyGuid') ?? readString(message, 'selectedMessageGuid') ?? readString(message, 'selectedMessageId') ?? readString(message, 'replyToMessageId') ?? readString(message, 'replyId') ?? readString(replyRecord, 'guid') ?? readString(replyRecord, 'id') ?? readString(replyRecord, 'messageId');
  const associatedType = readNumberLike(message, 'associatedMessageType') ?? readNumberLike(message, 'associated_message_type');
  const associatedGuid = readString(message, 'associatedMessageGuid') ?? readString(message, 'associated_message_guid') ?? readString(message, 'associatedMessageId');
  const isReactionAssociation = typeof associatedType === 'number' && REACTION_TYPE_MAP.has(associatedType);
  const replyToId = directReplyId ?? (!isReactionAssociation ? associatedGuid : void 0);
  const threadOriginatorGuid = readString(message, 'threadOriginatorGuid');
  const messageGuid = readString(message, 'guid');
  const fallbackReplyId = !replyToId && threadOriginatorGuid && threadOriginatorGuid !== messageGuid ? threadOriginatorGuid : void 0;
  return {
    replyToId: (replyToId ?? fallbackReplyId)?.trim() || void 0,
    replyToBody: replyToBody?.trim() || void 0,
    replyToSender: normalizedSender || void 0
  };
}
function readFirstChatRecord(message) {
  const chats = message['chats'];
  if (!Array.isArray(chats) || chats.length === 0) {
    return null;
  }
  const first = chats[0];
  return asRecord(first);
}
function normalizeParticipantEntry(entry) {
  if (typeof entry === 'string' || typeof entry === 'number') {
    const raw = String(entry).trim();
    if (!raw) {
      return null;
    }
    const normalized = normalizeBlueBubblesHandle(raw) || raw;
    return normalized ? { id: normalized } : null;
  }
  const record = asRecord(entry);
  if (!record) {
    return null;
  }
  const nestedHandle = asRecord(record['handle']) ?? asRecord(record['sender']) ?? asRecord(record['contact']) ?? null;
  const idRaw = readString(record, 'address') ?? readString(record, 'handle') ?? readString(record, 'id') ?? readString(record, 'phoneNumber') ?? readString(record, 'phone_number') ?? readString(record, 'email') ?? readString(nestedHandle, 'address') ?? readString(nestedHandle, 'handle') ?? readString(nestedHandle, 'id');
  const nameRaw = readString(record, 'displayName') ?? readString(record, 'name') ?? readString(record, 'title') ?? readString(nestedHandle, 'displayName') ?? readString(nestedHandle, 'name');
  const normalizedId = idRaw ? normalizeBlueBubblesHandle(idRaw) || idRaw.trim() : '';
  if (!normalizedId) {
    return null;
  }
  const name = nameRaw?.trim() || void 0;
  return { id: normalizedId, name };
}
function normalizeParticipantList(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  const seen = /* @__PURE__ */ new Set();
  const output = [];
  for (const entry of raw) {
    const normalized = normalizeParticipantEntry(entry);
    if (!normalized?.id) {
      continue;
    }
    const key = normalized.id.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
  }
  return output;
}
function formatGroupMembers(params) {
  const seen = /* @__PURE__ */ new Set();
  const ordered = [];
  for (const entry of params.participants ?? []) {
    if (!entry?.id) {
      continue;
    }
    const key = entry.id.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    ordered.push(entry);
  }
  if (ordered.length === 0 && params.fallback?.id) {
    ordered.push(params.fallback);
  }
  if (ordered.length === 0) {
    return void 0;
  }
  return ordered.map((entry) => entry.name ? `${entry.name} (${entry.id})` : entry.id).join(', ');
}
function resolveGroupFlagFromChatGuid(chatGuid) {
  const guid = chatGuid?.trim();
  if (!guid) {
    return void 0;
  }
  const parts = guid.split(';');
  if (parts.length >= 3) {
    if (parts[1] === '+') {
      return true;
    }
    if (parts[1] === '-') {
      return false;
    }
  }
  if (guid.includes(';+;')) {
    return true;
  }
  if (guid.includes(';-;')) {
    return false;
  }
  return void 0;
}
function extractChatIdentifierFromChatGuid(chatGuid) {
  const guid = chatGuid?.trim();
  if (!guid) {
    return void 0;
  }
  const parts = guid.split(';');
  if (parts.length < 3) {
    return void 0;
  }
  const identifier = parts[2]?.trim();
  return identifier || void 0;
}
function formatGroupAllowlistEntry(params) {
  const guid = params.chatGuid?.trim();
  if (guid) {
    return `chat_guid:${guid}`;
  }
  const chatId = params.chatId;
  if (typeof chatId === 'number' && Number.isFinite(chatId)) {
    return `chat_id:${chatId}`;
  }
  const identifier = params.chatIdentifier?.trim();
  if (identifier) {
    return `chat_identifier:${identifier}`;
  }
  return null;
}
const REACTION_TYPE_MAP = /* @__PURE__ */ new Map([
  [2e3, { emoji: '\u2764\uFE0F', action: 'added' }],
  [2001, { emoji: '\u{1F44D}', action: 'added' }],
  [2002, { emoji: '\u{1F44E}', action: 'added' }],
  [2003, { emoji: '\u{1F602}', action: 'added' }],
  [2004, { emoji: '\u203C\uFE0F', action: 'added' }],
  [2005, { emoji: '\u2753', action: 'added' }],
  [3e3, { emoji: '\u2764\uFE0F', action: 'removed' }],
  [3001, { emoji: '\u{1F44D}', action: 'removed' }],
  [3002, { emoji: '\u{1F44E}', action: 'removed' }],
  [3003, { emoji: '\u{1F602}', action: 'removed' }],
  [3004, { emoji: '\u203C\uFE0F', action: 'removed' }],
  [3005, { emoji: '\u2753', action: 'removed' }]
]);
const TAPBACK_TEXT_MAP = /* @__PURE__ */ new Map([
  ['loved', { emoji: '\u2764\uFE0F', action: 'added' }],
  ['liked', { emoji: '\u{1F44D}', action: 'added' }],
  ['disliked', { emoji: '\u{1F44E}', action: 'added' }],
  ['laughed at', { emoji: '\u{1F602}', action: 'added' }],
  ['emphasized', { emoji: '\u203C\uFE0F', action: 'added' }],
  ['questioned', { emoji: '\u2753', action: 'added' }],
  // Removal patterns (e.g., "Removed a heart from")
  ['removed a heart from', { emoji: '\u2764\uFE0F', action: 'removed' }],
  ['removed a like from', { emoji: '\u{1F44D}', action: 'removed' }],
  ['removed a dislike from', { emoji: '\u{1F44E}', action: 'removed' }],
  ['removed a laugh from', { emoji: '\u{1F602}', action: 'removed' }],
  ['removed an emphasis from', { emoji: '\u203C\uFE0F', action: 'removed' }],
  ['removed a question from', { emoji: '\u2753', action: 'removed' }]
]);
const TAPBACK_EMOJI_REGEX = new RegExp('(?:\\p{Regional_Indicator}{2})|(?:[0-9#*]\\uFE0F?\\u20E3)|(?:\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:\\p{Emoji_Modifier})?(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:\\p{Emoji_Modifier})?)*)', 'u');
function extractFirstEmoji(text) {
  const match = text.match(TAPBACK_EMOJI_REGEX);
  return match ? match[0] : null;
}
function extractQuotedTapbackText(text) {
  const match = text.match(/[“"]([^”"]+)[”"]/s);
  return match ? match[1] : null;
}
function isTapbackAssociatedType(type) {
  return typeof type === 'number' && Number.isFinite(type) && type >= 2e3 && type < 4e3;
}
function resolveTapbackActionHint(type) {
  if (typeof type !== 'number' || !Number.isFinite(type)) {
    return void 0;
  }
  if (type >= 3e3 && type < 4e3) {
    return 'removed';
  }
  if (type >= 2e3 && type < 3e3) {
    return 'added';
  }
  return void 0;
}
function resolveTapbackContext(message) {
  const associatedType = message.associatedMessageType;
  const hasTapbackType = isTapbackAssociatedType(associatedType);
  const hasTapbackMarker = Boolean(message.associatedMessageEmoji) || Boolean(message.isTapback);
  if (!hasTapbackType && !hasTapbackMarker) {
    return null;
  }
  const replyToId = message.associatedMessageGuid?.trim() || message.replyToId?.trim() || void 0;
  const actionHint = resolveTapbackActionHint(associatedType);
  const emojiHint = message.associatedMessageEmoji?.trim() || REACTION_TYPE_MAP.get(associatedType ?? -1)?.emoji;
  return { emojiHint, actionHint, replyToId };
}
function parseTapbackText(params) {
  const trimmed = params.text.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) {
    return null;
  }
  for (const [pattern, { emoji, action }] of TAPBACK_TEXT_MAP) {
    if (lower.startsWith(pattern)) {
      const afterPattern = trimmed.slice(pattern.length).trim();
      if (params.requireQuoted) {
        const strictMatch = afterPattern.match(/^[“"](.+)[”"]$/s);
        if (!strictMatch) {
          return null;
        }
        return { emoji, action, quotedText: strictMatch[1] };
      }
      const quotedText = extractQuotedTapbackText(afterPattern) ?? extractQuotedTapbackText(trimmed) ?? afterPattern;
      return { emoji, action, quotedText };
    }
  }
  if (lower.startsWith('reacted')) {
    const emoji = extractFirstEmoji(trimmed) ?? params.emojiHint;
    if (!emoji) {
      return null;
    }
    const quotedText = extractQuotedTapbackText(trimmed);
    if (params.requireQuoted && !quotedText) {
      return null;
    }
    const fallback = trimmed.slice('reacted'.length).trim();
    return { emoji, action: params.actionHint ?? 'added', quotedText: quotedText ?? fallback };
  }
  if (lower.startsWith('removed')) {
    const emoji = extractFirstEmoji(trimmed) ?? params.emojiHint;
    if (!emoji) {
      return null;
    }
    const quotedText = extractQuotedTapbackText(trimmed);
    if (params.requireQuoted && !quotedText) {
      return null;
    }
    const fallback = trimmed.slice('removed'.length).trim();
    return { emoji, action: params.actionHint ?? 'removed', quotedText: quotedText ?? fallback };
  }
  return null;
}
function maskSecret(value) {
  if (value.length <= 6) {
    return '***';
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}
function resolveBlueBubblesAckReaction(params) {
  const raw = resolveAckReaction(params.cfg, params.agentId).trim();
  if (!raw) {
    return null;
  }
  try {
    normalizeBlueBubblesReactionInput(raw);
    return raw;
  } catch {
    const key = raw.toLowerCase();
    if (!invalidAckReactions.has(key)) {
      invalidAckReactions.add(key);
      logVerbose(
        params.core,
        params.runtime,
        `ack reaction skipped (unsupported for BlueBubbles): ${raw}`
      );
    }
    return null;
  }
}
function extractMessagePayload(payload) {
  const dataRaw = payload.data ?? payload.payload ?? payload.event;
  const data = asRecord(dataRaw) ?? (typeof dataRaw === 'string' ? asRecord(JSON.parse(dataRaw)) ?? null : null);
  const messageRaw = payload.message ?? data?.message ?? data;
  const message = asRecord(messageRaw) ?? (typeof messageRaw === 'string' ? asRecord(JSON.parse(messageRaw)) ?? null : null);
  if (!message) {
    return null;
  }
  return message;
}
function normalizeWebhookMessage(payload) {
  const message = extractMessagePayload(payload);
  if (!message) {
    return null;
  }
  const text = readString(message, 'text') ?? readString(message, 'body') ?? readString(message, 'subject') ?? '';
  const handleValue = message.handle ?? message.sender;
  const handle = asRecord(handleValue) ?? (typeof handleValue === 'string' ? { address: handleValue } : null);
  const senderId = readString(handle, 'address') ?? readString(handle, 'handle') ?? readString(handle, 'id') ?? readString(message, 'senderId') ?? readString(message, 'sender') ?? readString(message, 'from') ?? '';
  const senderName = readString(handle, 'displayName') ?? readString(handle, 'name') ?? readString(message, 'senderName') ?? void 0;
  const chat = asRecord(message.chat) ?? asRecord(message.conversation) ?? null;
  const chatFromList = readFirstChatRecord(message);
  const chatGuid = readString(message, 'chatGuid') ?? readString(message, 'chat_guid') ?? readString(chat, 'chatGuid') ?? readString(chat, 'chat_guid') ?? readString(chat, 'guid') ?? readString(chatFromList, 'chatGuid') ?? readString(chatFromList, 'chat_guid') ?? readString(chatFromList, 'guid');
  const chatIdentifier = readString(message, 'chatIdentifier') ?? readString(message, 'chat_identifier') ?? readString(chat, 'chatIdentifier') ?? readString(chat, 'chat_identifier') ?? readString(chat, 'identifier') ?? readString(chatFromList, 'chatIdentifier') ?? readString(chatFromList, 'chat_identifier') ?? readString(chatFromList, 'identifier') ?? extractChatIdentifierFromChatGuid(chatGuid);
  const chatId = readNumberLike(message, 'chatId') ?? readNumberLike(message, 'chat_id') ?? readNumberLike(chat, 'chatId') ?? readNumberLike(chat, 'chat_id') ?? readNumberLike(chat, 'id') ?? readNumberLike(chatFromList, 'chatId') ?? readNumberLike(chatFromList, 'chat_id') ?? readNumberLike(chatFromList, 'id');
  const chatName = readString(message, 'chatName') ?? readString(chat, 'displayName') ?? readString(chat, 'name') ?? readString(chatFromList, 'displayName') ?? readString(chatFromList, 'name') ?? void 0;
  const chatParticipants = chat ? chat['participants'] : void 0;
  const messageParticipants = message['participants'];
  const chatsParticipants = chatFromList ? chatFromList['participants'] : void 0;
  const participants = Array.isArray(chatParticipants) ? chatParticipants : Array.isArray(messageParticipants) ? messageParticipants : Array.isArray(chatsParticipants) ? chatsParticipants : [];
  const normalizedParticipants = normalizeParticipantList(participants);
  const participantsCount = participants.length;
  const groupFromChatGuid = resolveGroupFlagFromChatGuid(chatGuid);
  const explicitIsGroup = readBoolean(message, 'isGroup') ?? readBoolean(message, 'is_group') ?? readBoolean(chat, 'isGroup') ?? readBoolean(message, 'group');
  const isGroup = typeof groupFromChatGuid === 'boolean' ? groupFromChatGuid : explicitIsGroup ?? participantsCount > 2;
  const fromMe = readBoolean(message, 'isFromMe') ?? readBoolean(message, 'is_from_me');
  const messageId = readString(message, 'guid') ?? readString(message, 'id') ?? readString(message, 'messageId') ?? void 0;
  const balloonBundleId = readString(message, 'balloonBundleId');
  const associatedMessageGuid = readString(message, 'associatedMessageGuid') ?? readString(message, 'associated_message_guid') ?? readString(message, 'associatedMessageId') ?? void 0;
  const associatedMessageType = readNumberLike(message, 'associatedMessageType') ?? readNumberLike(message, 'associated_message_type');
  const associatedMessageEmoji = readString(message, 'associatedMessageEmoji') ?? readString(message, 'associated_message_emoji') ?? readString(message, 'reactionEmoji') ?? readString(message, 'reaction_emoji') ?? void 0;
  const isTapback = readBoolean(message, 'isTapback') ?? readBoolean(message, 'is_tapback') ?? readBoolean(message, 'tapback') ?? void 0;
  const timestampRaw = readNumber(message, 'date') ?? readNumber(message, 'dateCreated') ?? readNumber(message, 'timestamp');
  const timestamp = typeof timestampRaw === 'number' ? timestampRaw > 1e12 ? timestampRaw : timestampRaw * 1e3 : void 0;
  const normalizedSender = normalizeBlueBubblesHandle(senderId);
  if (!normalizedSender) {
    return null;
  }
  const replyMetadata = extractReplyMetadata(message);
  return {
    text,
    senderId: normalizedSender,
    senderName,
    messageId,
    timestamp,
    isGroup,
    chatId,
    chatGuid,
    chatIdentifier,
    chatName,
    fromMe,
    attachments: extractAttachments(message),
    balloonBundleId,
    associatedMessageGuid,
    associatedMessageType,
    associatedMessageEmoji,
    isTapback,
    participants: normalizedParticipants,
    replyToId: replyMetadata.replyToId,
    replyToBody: replyMetadata.replyToBody,
    replyToSender: replyMetadata.replyToSender
  };
}
function normalizeWebhookReaction(payload) {
  const message = extractMessagePayload(payload);
  if (!message) {
    return null;
  }
  const associatedGuid = readString(message, 'associatedMessageGuid') ?? readString(message, 'associated_message_guid') ?? readString(message, 'associatedMessageId');
  const associatedType = readNumberLike(message, 'associatedMessageType') ?? readNumberLike(message, 'associated_message_type');
  if (!associatedGuid || associatedType === void 0) {
    return null;
  }
  const mapping = REACTION_TYPE_MAP.get(associatedType);
  const associatedEmoji = readString(message, 'associatedMessageEmoji') ?? readString(message, 'associated_message_emoji') ?? readString(message, 'reactionEmoji') ?? readString(message, 'reaction_emoji');
  const emoji = (associatedEmoji?.trim() || mapping?.emoji) ?? `reaction:${associatedType}`;
  const action = mapping?.action ?? resolveTapbackActionHint(associatedType) ?? 'added';
  const handleValue = message.handle ?? message.sender;
  const handle = asRecord(handleValue) ?? (typeof handleValue === 'string' ? { address: handleValue } : null);
  const senderId = readString(handle, 'address') ?? readString(handle, 'handle') ?? readString(handle, 'id') ?? readString(message, 'senderId') ?? readString(message, 'sender') ?? readString(message, 'from') ?? '';
  const senderName = readString(handle, 'displayName') ?? readString(handle, 'name') ?? readString(message, 'senderName') ?? void 0;
  const chat = asRecord(message.chat) ?? asRecord(message.conversation) ?? null;
  const chatFromList = readFirstChatRecord(message);
  const chatGuid = readString(message, 'chatGuid') ?? readString(message, 'chat_guid') ?? readString(chat, 'chatGuid') ?? readString(chat, 'chat_guid') ?? readString(chat, 'guid') ?? readString(chatFromList, 'chatGuid') ?? readString(chatFromList, 'chat_guid') ?? readString(chatFromList, 'guid');
  const chatIdentifier = readString(message, 'chatIdentifier') ?? readString(message, 'chat_identifier') ?? readString(chat, 'chatIdentifier') ?? readString(chat, 'chat_identifier') ?? readString(chat, 'identifier') ?? readString(chatFromList, 'chatIdentifier') ?? readString(chatFromList, 'chat_identifier') ?? readString(chatFromList, 'identifier') ?? extractChatIdentifierFromChatGuid(chatGuid);
  const chatId = readNumberLike(message, 'chatId') ?? readNumberLike(message, 'chat_id') ?? readNumberLike(chat, 'chatId') ?? readNumberLike(chat, 'chat_id') ?? readNumberLike(chat, 'id') ?? readNumberLike(chatFromList, 'chatId') ?? readNumberLike(chatFromList, 'chat_id') ?? readNumberLike(chatFromList, 'id');
  const chatName = readString(message, 'chatName') ?? readString(chat, 'displayName') ?? readString(chat, 'name') ?? readString(chatFromList, 'displayName') ?? readString(chatFromList, 'name') ?? void 0;
  const chatParticipants = chat ? chat['participants'] : void 0;
  const messageParticipants = message['participants'];
  const chatsParticipants = chatFromList ? chatFromList['participants'] : void 0;
  const participants = Array.isArray(chatParticipants) ? chatParticipants : Array.isArray(messageParticipants) ? messageParticipants : Array.isArray(chatsParticipants) ? chatsParticipants : [];
  const participantsCount = participants.length;
  const groupFromChatGuid = resolveGroupFlagFromChatGuid(chatGuid);
  const explicitIsGroup = readBoolean(message, 'isGroup') ?? readBoolean(message, 'is_group') ?? readBoolean(chat, 'isGroup') ?? readBoolean(message, 'group');
  const isGroup = typeof groupFromChatGuid === 'boolean' ? groupFromChatGuid : explicitIsGroup ?? participantsCount > 2;
  const fromMe = readBoolean(message, 'isFromMe') ?? readBoolean(message, 'is_from_me');
  const timestampRaw = readNumberLike(message, 'date') ?? readNumberLike(message, 'dateCreated') ?? readNumberLike(message, 'timestamp');
  const timestamp = typeof timestampRaw === 'number' ? timestampRaw > 1e12 ? timestampRaw : timestampRaw * 1e3 : void 0;
  const normalizedSender = normalizeBlueBubblesHandle(senderId);
  if (!normalizedSender) {
    return null;
  }
  return {
    action,
    emoji,
    senderId: normalizedSender,
    senderName,
    messageId: associatedGuid,
    timestamp,
    isGroup,
    chatId,
    chatGuid,
    chatIdentifier,
    chatName,
    fromMe
  };
}
async function handleBlueBubblesWebhookRequest(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = normalizeWebhookPath(url.pathname);
  const targets = webhookTargets.get(path);
  if (!targets || targets.length === 0) {
    return false;
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.end('Method Not Allowed');
    return true;
  }
  const body = await readJsonBody(req, 1024 * 1024);
  if (!body.ok) {
    res.statusCode = body.error === 'payload too large' ? 413 : 400;
    res.end(body.error ?? 'invalid payload');
    console.warn(`[bluebubbles] webhook rejected: ${body.error ?? 'invalid payload'}`);
    return true;
  }
  const payload = asRecord(body.value) ?? {};
  const firstTarget = targets[0];
  if (firstTarget) {
    logVerbose(
      firstTarget.core,
      firstTarget.runtime,
      `webhook received path=${path} keys=${Object.keys(payload).join(',') || 'none'}`
    );
  }
  const eventTypeRaw = payload.type;
  const eventType = typeof eventTypeRaw === 'string' ? eventTypeRaw.trim() : '';
  const allowedEventTypes = /* @__PURE__ */ new Set([
    'new-message',
    'updated-message',
    'message-reaction',
    'reaction'
  ]);
  if (eventType && !allowedEventTypes.has(eventType)) {
    res.statusCode = 200;
    res.end('ok');
    if (firstTarget) {
      logVerbose(firstTarget.core, firstTarget.runtime, `webhook ignored type=${eventType}`);
    }
    return true;
  }
  const reaction = normalizeWebhookReaction(payload);
  if ((eventType === 'updated-message' || eventType === 'message-reaction' || eventType === 'reaction') && !reaction) {
    res.statusCode = 200;
    res.end('ok');
    if (firstTarget) {
      logVerbose(
        firstTarget.core,
        firstTarget.runtime,
        `webhook ignored ${eventType || 'event'} without reaction`
      );
    }
    return true;
  }
  const message = reaction ? null : normalizeWebhookMessage(payload);
  if (!message && !reaction) {
    res.statusCode = 400;
    res.end('invalid payload');
    console.warn('[bluebubbles] webhook rejected: unable to parse message payload');
    return true;
  }
  const matching = targets.filter((target) => {
    const token = target.account.config.password?.trim();
    if (!token) {
      return true;
    }
    const guidParam = url.searchParams.get('guid') ?? url.searchParams.get('password');
    const headerToken = req.headers['x-guid'] ?? req.headers['x-password'] ?? req.headers['x-bluebubbles-guid'] ?? req.headers['authorization'];
    const guid = (Array.isArray(headerToken) ? headerToken[0] : headerToken) ?? guidParam ?? '';
    if (guid && guid.trim() === token) {
      return true;
    }
    const remote = req.socket?.remoteAddress ?? '';
    if (remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1') {
      return true;
    }
    return false;
  });
  if (matching.length === 0) {
    res.statusCode = 401;
    res.end('unauthorized');
    console.warn(
      `[bluebubbles] webhook rejected: unauthorized guid=${maskSecret(url.searchParams.get('guid') ?? url.searchParams.get('password') ?? '')}`
    );
    return true;
  }
  for (const target of matching) {
    target.statusSink?.({ lastInboundAt: Date.now() });
    if (reaction) {
      processReaction(reaction, target).catch((err) => {
        target.runtime.error?.(
          `[${target.account.accountId}] BlueBubbles reaction failed: ${String(err)}`
        );
      });
    } else if (message) {
      const debouncer = getOrCreateDebouncer(target);
      debouncer.enqueue({ message, target }).catch((err) => {
        target.runtime.error?.(
          `[${target.account.accountId}] BlueBubbles webhook failed: ${String(err)}`
        );
      });
    }
  }
  res.statusCode = 200;
  res.end('ok');
  if (reaction) {
    if (firstTarget) {
      logVerbose(
        firstTarget.core,
        firstTarget.runtime,
        `webhook accepted reaction sender=${reaction.senderId} msg=${reaction.messageId} action=${reaction.action}`
      );
    }
  } else if (message) {
    if (firstTarget) {
      logVerbose(
        firstTarget.core,
        firstTarget.runtime,
        `webhook accepted sender=${message.senderId} group=${message.isGroup} chatGuid=${message.chatGuid ?? ''} chatId=${message.chatId ?? ''}`
      );
    }
  }
  return true;
}
async function processMessage(message, target) {
  const { account, config, runtime, core, statusSink } = target;
  const groupFlag = resolveGroupFlagFromChatGuid(message.chatGuid);
  const isGroup = typeof groupFlag === 'boolean' ? groupFlag : message.isGroup;
  const text = message.text.trim();
  const attachments = message.attachments ?? [];
  const placeholder = buildMessagePlaceholder(message);
  const tapbackContext = resolveTapbackContext(message);
  const tapbackParsed = parseTapbackText({
    text,
    emojiHint: tapbackContext?.emojiHint,
    actionHint: tapbackContext?.actionHint,
    requireQuoted: !tapbackContext
  });
  const isTapbackMessage = Boolean(tapbackParsed);
  const rawBody = tapbackParsed ? tapbackParsed.action === 'removed' ? `removed ${tapbackParsed.emoji} reaction` : `reacted with ${tapbackParsed.emoji}` : text || placeholder;
  const cacheMessageId = message.messageId?.trim();
  let messageShortId;
  const cacheInboundMessage = () => {
    if (!cacheMessageId) {
      return;
    }
    const cacheEntry = rememberBlueBubblesReplyCache({
      accountId: account.accountId,
      messageId: cacheMessageId,
      chatGuid: message.chatGuid,
      chatIdentifier: message.chatIdentifier,
      chatId: message.chatId,
      senderLabel: message.fromMe ? 'me' : message.senderId,
      body: rawBody,
      timestamp: message.timestamp ?? Date.now()
    });
    messageShortId = cacheEntry.shortId;
  };
  if (message.fromMe) {
    cacheInboundMessage();
    return;
  }
  if (!rawBody) {
    logVerbose(core, runtime, `drop: empty text sender=${message.senderId}`);
    return;
  }
  logVerbose(
    core,
    runtime,
    `msg sender=${message.senderId} group=${isGroup} textLen=${text.length} attachments=${attachments.length} chatGuid=${message.chatGuid ?? ''} chatId=${message.chatId ?? ''}`
  );
  const dmPolicy = account.config.dmPolicy ?? 'pairing';
  const groupPolicy = account.config.groupPolicy ?? 'allowlist';
  const configAllowFrom = (account.config.allowFrom ?? []).map((entry) => String(entry));
  const configGroupAllowFrom = (account.config.groupAllowFrom ?? []).map((entry) => String(entry));
  const storeAllowFrom = await core.channel.pairing.readAllowFromStore('bluebubbles').catch(() => []);
  const effectiveAllowFrom = [...configAllowFrom, ...storeAllowFrom].map((entry) => String(entry).trim()).filter(Boolean);
  const effectiveGroupAllowFrom = [
    ...configGroupAllowFrom.length > 0 ? configGroupAllowFrom : configAllowFrom,
    ...storeAllowFrom
  ].map((entry) => String(entry).trim()).filter(Boolean);
  const groupAllowEntry = formatGroupAllowlistEntry({
    chatGuid: message.chatGuid,
    chatId: message.chatId ?? void 0,
    chatIdentifier: message.chatIdentifier ?? void 0
  });
  const groupName = message.chatName?.trim() || void 0;
  if (isGroup) {
    if (groupPolicy === 'disabled') {
      logVerbose(core, runtime, 'Blocked BlueBubbles group message (groupPolicy=disabled)');
      logGroupAllowlistHint({
        runtime,
        reason: 'groupPolicy=disabled',
        entry: groupAllowEntry,
        chatName: groupName,
        accountId: account.accountId
      });
      return;
    }
    if (groupPolicy === 'allowlist') {
      if (effectiveGroupAllowFrom.length === 0) {
        logVerbose(core, runtime, 'Blocked BlueBubbles group message (no allowlist)');
        logGroupAllowlistHint({
          runtime,
          reason: 'groupPolicy=allowlist (empty allowlist)',
          entry: groupAllowEntry,
          chatName: groupName,
          accountId: account.accountId
        });
        return;
      }
      const allowed = isAllowedBlueBubblesSender({
        allowFrom: effectiveGroupAllowFrom,
        sender: message.senderId,
        chatId: message.chatId ?? void 0,
        chatGuid: message.chatGuid ?? void 0,
        chatIdentifier: message.chatIdentifier ?? void 0
      });
      if (!allowed) {
        logVerbose(
          core,
          runtime,
          `Blocked BlueBubbles sender ${message.senderId} (not in groupAllowFrom)`
        );
        logVerbose(
          core,
          runtime,
          `drop: group sender not allowed sender=${message.senderId} allowFrom=${effectiveGroupAllowFrom.join(',')}`
        );
        logGroupAllowlistHint({
          runtime,
          reason: 'groupPolicy=allowlist (not allowlisted)',
          entry: groupAllowEntry,
          chatName: groupName,
          accountId: account.accountId
        });
        return;
      }
    }
  } else {
    if (dmPolicy === 'disabled') {
      logVerbose(core, runtime, `Blocked BlueBubbles DM from ${message.senderId}`);
      logVerbose(core, runtime, `drop: dmPolicy disabled sender=${message.senderId}`);
      return;
    }
    if (dmPolicy !== 'open') {
      const allowed = isAllowedBlueBubblesSender({
        allowFrom: effectiveAllowFrom,
        sender: message.senderId,
        chatId: message.chatId ?? void 0,
        chatGuid: message.chatGuid ?? void 0,
        chatIdentifier: message.chatIdentifier ?? void 0
      });
      if (!allowed) {
        if (dmPolicy === 'pairing') {
          const { code, created } = await core.channel.pairing.upsertPairingRequest({
            channel: 'bluebubbles',
            id: message.senderId,
            meta: { name: message.senderName }
          });
          runtime.log?.(
            `[bluebubbles] pairing request sender=${message.senderId} created=${created}`
          );
          if (created) {
            logVerbose(core, runtime, `bluebubbles pairing request sender=${message.senderId}`);
            try {
              await sendMessageBlueBubbles(
                message.senderId,
                core.channel.pairing.buildPairingReply({
                  channel: 'bluebubbles',
                  idLine: `Your BlueBubbles sender id: ${message.senderId}`,
                  code
                }),
                { cfg: config, accountId: account.accountId }
              );
              statusSink?.({ lastOutboundAt: Date.now() });
            } catch (err) {
              logVerbose(
                core,
                runtime,
                `bluebubbles pairing reply failed for ${message.senderId}: ${String(err)}`
              );
              runtime.error?.(
                `[bluebubbles] pairing reply failed sender=${message.senderId}: ${String(err)}`
              );
            }
          }
        } else {
          logVerbose(
            core,
            runtime,
            `Blocked unauthorized BlueBubbles sender ${message.senderId} (dmPolicy=${dmPolicy})`
          );
          logVerbose(
            core,
            runtime,
            `drop: dm sender not allowed sender=${message.senderId} allowFrom=${effectiveAllowFrom.join(',')}`
          );
        }
        return;
      }
    }
  }
  const chatId = message.chatId ?? void 0;
  const chatGuid = message.chatGuid ?? void 0;
  const chatIdentifier = message.chatIdentifier ?? void 0;
  const peerId = isGroup ? chatGuid ?? chatIdentifier ?? (chatId ? String(chatId) : 'group') : message.senderId;
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: 'bluebubbles',
    accountId: account.accountId,
    peer: {
      kind: isGroup ? 'group' : 'dm',
      id: peerId
    }
  });
  const messageText = text;
  const mentionRegexes = core.channel.mentions.buildMentionRegexes(config, route.agentId);
  const wasMentioned = isGroup ? core.channel.mentions.matchesMentionPatterns(messageText, mentionRegexes) : true;
  const canDetectMention = mentionRegexes.length > 0;
  const requireMention = core.channel.groups.resolveRequireMention({
    cfg: config,
    channel: 'bluebubbles',
    groupId: peerId,
    accountId: account.accountId
  });
  const useAccessGroups = config.commands?.useAccessGroups !== false;
  const hasControlCmd = core.channel.text.hasControlCommand(messageText, config);
  const ownerAllowedForCommands = effectiveAllowFrom.length > 0 ? isAllowedBlueBubblesSender({
    allowFrom: effectiveAllowFrom,
    sender: message.senderId,
    chatId: message.chatId ?? void 0,
    chatGuid: message.chatGuid ?? void 0,
    chatIdentifier: message.chatIdentifier ?? void 0
  }) : false;
  const groupAllowedForCommands = effectiveGroupAllowFrom.length > 0 ? isAllowedBlueBubblesSender({
    allowFrom: effectiveGroupAllowFrom,
    sender: message.senderId,
    chatId: message.chatId ?? void 0,
    chatGuid: message.chatGuid ?? void 0,
    chatIdentifier: message.chatIdentifier ?? void 0
  }) : false;
  const dmAuthorized = dmPolicy === 'open' || ownerAllowedForCommands;
  const commandGate = resolveControlCommandGate({
    useAccessGroups,
    authorizers: [
      { configured: effectiveAllowFrom.length > 0, allowed: ownerAllowedForCommands },
      { configured: effectiveGroupAllowFrom.length > 0, allowed: groupAllowedForCommands }
    ],
    allowTextCommands: true,
    hasControlCommand: hasControlCmd
  });
  const commandAuthorized = isGroup ? commandGate.commandAuthorized : dmAuthorized;
  if (isGroup && commandGate.shouldBlock) {
    logInboundDrop({
      log: (msg) => logVerbose(core, runtime, msg),
      channel: 'bluebubbles',
      reason: 'control command (unauthorized)',
      target: message.senderId
    });
    return;
  }
  const shouldBypassMention = isGroup && requireMention && !wasMentioned && commandAuthorized && hasControlCmd;
  const effectiveWasMentioned = wasMentioned || shouldBypassMention;
  if (isGroup && requireMention && canDetectMention && !wasMentioned && !shouldBypassMention) {
    logVerbose(core, runtime, 'bluebubbles: skipping group message (no mention)');
    return;
  }
  cacheInboundMessage();
  const baseUrl = account.config.serverUrl?.trim();
  const password = account.config.password?.trim();
  const maxBytes = account.config.mediaMaxMb && account.config.mediaMaxMb > 0 ? account.config.mediaMaxMb * 1024 * 1024 : 8 * 1024 * 1024;
  const mediaUrls = [];
  const mediaPaths = [];
  const mediaTypes = [];
  if (attachments.length > 0) {
    if (!baseUrl || !password) {
      logVerbose(core, runtime, 'attachment download skipped (missing serverUrl/password)');
    } else {
      for (const attachment of attachments) {
        if (!attachment.guid) {
          continue;
        }
        if (attachment.totalBytes && attachment.totalBytes > maxBytes) {
          logVerbose(
            core,
            runtime,
            `attachment too large guid=${attachment.guid} bytes=${attachment.totalBytes}`
          );
          continue;
        }
        try {
          const downloaded = await downloadBlueBubblesAttachment(attachment, {
            cfg: config,
            accountId: account.accountId,
            maxBytes
          });
          const saved = await core.channel.media.saveMediaBuffer(
            downloaded.buffer,
            downloaded.contentType,
            'inbound',
            maxBytes
          );
          mediaPaths.push(saved.path);
          mediaUrls.push(saved.path);
          if (saved.contentType) {
            mediaTypes.push(saved.contentType);
          }
        } catch (err) {
          logVerbose(
            core,
            runtime,
            `attachment download failed guid=${attachment.guid} err=${String(err)}`
          );
        }
      }
    }
  }
  let replyToId = message.replyToId;
  let replyToBody = message.replyToBody;
  let replyToSender = message.replyToSender;
  let replyToShortId;
  if (isTapbackMessage && tapbackContext?.replyToId) {
    replyToId = tapbackContext.replyToId;
  }
  if (replyToId) {
    const cached = resolveReplyContextFromCache({
      accountId: account.accountId,
      replyToId,
      chatGuid: message.chatGuid,
      chatIdentifier: message.chatIdentifier,
      chatId: message.chatId
    });
    if (cached) {
      if (!replyToBody && cached.body) {
        replyToBody = cached.body;
      }
      if (!replyToSender && cached.senderLabel) {
        replyToSender = cached.senderLabel;
      }
      replyToShortId = cached.shortId;
      if (core.logging.shouldLogVerbose()) {
        const preview = (cached.body ?? '').replace(/\s+/g, ' ').slice(0, 120);
        logVerbose(
          core,
          runtime,
          `reply-context cache hit replyToId=${replyToId} sender=${replyToSender ?? ''} body="${preview}"`
        );
      }
    }
  }
  if (replyToId && !replyToShortId) {
    replyToShortId = getShortIdForUuid(replyToId);
  }
  const replyTag = formatReplyTag({ replyToId, replyToShortId });
  const baseBody = replyTag ? isTapbackMessage ? `${rawBody} ${replyTag}` : `${replyTag} ${rawBody}` : rawBody;
  const fromLabel = isGroup ? void 0 : message.senderName || `user:${message.senderId}`;
  const groupSubject = isGroup ? message.chatName?.trim() || void 0 : void 0;
  const groupMembers = isGroup ? formatGroupMembers({
    participants: message.participants,
    fallback: message.senderId ? { id: message.senderId, name: message.senderName } : void 0
  }) : void 0;
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey
  });
  const body = core.channel.reply.formatAgentEnvelope({
    channel: 'BlueBubbles',
    from: fromLabel,
    timestamp: message.timestamp,
    previousTimestamp,
    envelope: envelopeOptions,
    body: baseBody
  });
  let chatGuidForActions = chatGuid;
  if (!chatGuidForActions && baseUrl && password) {
    const target2 = isGroup && (chatId || chatIdentifier) ? chatId ? { kind: 'chat_id', chatId } : { kind: 'chat_identifier', chatIdentifier: chatIdentifier ?? '' } : { kind: 'handle', address: message.senderId };
    if (target2.kind !== 'chat_identifier' || target2.chatIdentifier) {
      chatGuidForActions = await resolveChatGuidForTarget({
        baseUrl,
        password,
        target: target2
      }) ?? void 0;
    }
  }
  const ackReactionScope = config.messages?.ackReactionScope ?? 'group-mentions';
  const removeAckAfterReply = config.messages?.removeAckAfterReply ?? false;
  const ackReactionValue = resolveBlueBubblesAckReaction({
    cfg: config,
    agentId: route.agentId,
    core,
    runtime
  });
  const shouldAckReaction = () => Boolean(
    ackReactionValue && core.channel.reactions.shouldAckReaction({
      scope: ackReactionScope,
      isDirect: !isGroup,
      isGroup,
      isMentionableGroup: isGroup,
      requireMention: Boolean(requireMention),
      canDetectMention,
      effectiveWasMentioned,
      shouldBypassMention
    })
  );
  const ackMessageId = message.messageId?.trim() || '';
  const ackReactionPromise = shouldAckReaction() && ackMessageId && chatGuidForActions && ackReactionValue ? sendBlueBubblesReaction({
    chatGuid: chatGuidForActions,
    messageGuid: ackMessageId,
    emoji: ackReactionValue,
    opts: { cfg: config, accountId: account.accountId }
  }).then(
    () => true,
    (err) => {
      logVerbose(
        core,
        runtime,
        `ack reaction failed chatGuid=${chatGuidForActions} msg=${ackMessageId}: ${String(err)}`
      );
      return false;
    }
  ) : null;
  const sendReadReceipts = account.config.sendReadReceipts !== false;
  if (chatGuidForActions && baseUrl && password && sendReadReceipts) {
    try {
      await markBlueBubblesChatRead(chatGuidForActions, {
        cfg: config,
        accountId: account.accountId
      });
      logVerbose(core, runtime, `marked read chatGuid=${chatGuidForActions}`);
    } catch (err) {
      runtime.error?.(`[bluebubbles] mark read failed: ${String(err)}`);
    }
  } else if (!sendReadReceipts) {
    logVerbose(core, runtime, 'mark read skipped (sendReadReceipts=false)');
  } else {
    logVerbose(core, runtime, 'mark read skipped (missing chatGuid or credentials)');
  }
  const outboundTarget = isGroup ? formatBlueBubblesChatTarget({
    chatId,
    chatGuid: chatGuidForActions ?? chatGuid,
    chatIdentifier
  }) || peerId : chatGuidForActions ? formatBlueBubblesChatTarget({ chatGuid: chatGuidForActions }) : message.senderId;
  const maybeEnqueueOutboundMessageId = (messageId, snippet) => {
    const trimmed = messageId?.trim();
    if (!trimmed || trimmed === 'ok' || trimmed === 'unknown') {
      return;
    }
    const cacheEntry = rememberBlueBubblesReplyCache({
      accountId: account.accountId,
      messageId: trimmed,
      chatGuid: chatGuidForActions ?? chatGuid,
      chatIdentifier,
      chatId,
      senderLabel: 'me',
      body: snippet ?? '',
      timestamp: Date.now()
    });
    const displayId = cacheEntry.shortId || trimmed;
    const preview = snippet ? ` "${snippet.slice(0, 12)}${snippet.length > 12 ? '\u2026' : ''}"` : '';
    core.system.enqueueSystemEvent(`Assistant sent${preview} [message_id:${displayId}]`, {
      sessionKey: route.sessionKey,
      contextKey: `bluebubbles:outbound:${outboundTarget}:${trimmed}`
    });
  };
  const ctxPayload = {
    Body: body,
    BodyForAgent: body,
    RawBody: rawBody,
    CommandBody: rawBody,
    BodyForCommands: rawBody,
    MediaUrl: mediaUrls[0],
    MediaUrls: mediaUrls.length > 0 ? mediaUrls : void 0,
    MediaPath: mediaPaths[0],
    MediaPaths: mediaPaths.length > 0 ? mediaPaths : void 0,
    MediaType: mediaTypes[0],
    MediaTypes: mediaTypes.length > 0 ? mediaTypes : void 0,
    From: isGroup ? `group:${peerId}` : `bluebubbles:${message.senderId}`,
    To: `bluebubbles:${outboundTarget}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? 'group' : 'direct',
    ConversationLabel: fromLabel,
    // Use short ID for token savings (agent can use this to reference the message)
    ReplyToId: replyToShortId || replyToId,
    ReplyToIdFull: replyToId,
    ReplyToBody: replyToBody,
    ReplyToSender: replyToSender,
    GroupSubject: groupSubject,
    GroupMembers: groupMembers,
    SenderName: message.senderName || void 0,
    SenderId: message.senderId,
    Provider: 'bluebubbles',
    Surface: 'bluebubbles',
    // Use short ID for token savings (agent can use this to reference the message)
    MessageSid: messageShortId || message.messageId,
    MessageSidFull: message.messageId,
    Timestamp: message.timestamp,
    OriginatingChannel: 'bluebubbles',
    OriginatingTo: `bluebubbles:${outboundTarget}`,
    WasMentioned: effectiveWasMentioned,
    CommandAuthorized: commandAuthorized
  };
  let sentMessage = false;
  let streamingActive = false;
  let typingRestartTimer;
  const typingRestartDelayMs = 150;
  const clearTypingRestartTimer = () => {
    if (typingRestartTimer) {
      clearTimeout(typingRestartTimer);
      typingRestartTimer = void 0;
    }
  };
  const restartTypingSoon = () => {
    if (!streamingActive || !chatGuidForActions || !baseUrl || !password) {
      return;
    }
    clearTypingRestartTimer();
    typingRestartTimer = setTimeout(() => {
      typingRestartTimer = void 0;
      if (!streamingActive) {
        return;
      }
      sendBlueBubblesTyping(chatGuidForActions, true, {
        cfg: config,
        accountId: account.accountId
      }).catch((err) => {
        runtime.error?.(`[bluebubbles] typing restart failed: ${String(err)}`);
      });
    }, typingRestartDelayMs);
  };
  try {
    const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
      cfg: config,
      agentId: route.agentId,
      channel: 'bluebubbles',
      accountId: account.accountId
    });
    await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg: config,
      dispatcherOptions: {
        ...prefixOptions,
        deliver: async (payload, info) => {
          const rawReplyToId = typeof payload.replyToId === 'string' ? payload.replyToId.trim() : '';
          const replyToMessageGuid = rawReplyToId ? resolveBlueBubblesMessageId(rawReplyToId, { requireKnownShortId: true }) : '';
          const mediaList = payload.mediaUrls?.length ? payload.mediaUrls : payload.mediaUrl ? [payload.mediaUrl] : [];
          if (mediaList.length > 0) {
            const tableMode2 = core.channel.text.resolveMarkdownTableMode({
              cfg: config,
              channel: 'bluebubbles',
              accountId: account.accountId
            });
            const text3 = core.channel.text.convertMarkdownTables(payload.text ?? '', tableMode2);
            let first = true;
            for (const mediaUrl of mediaList) {
              const caption = first ? text3 : void 0;
              first = false;
              const result = await sendBlueBubblesMedia({
                cfg: config,
                to: outboundTarget,
                mediaUrl,
                caption: caption ?? void 0,
                replyToId: replyToMessageGuid || null,
                accountId: account.accountId
              });
              const cachedBody = (caption ?? '').trim() || '<media:attachment>';
              maybeEnqueueOutboundMessageId(result.messageId, cachedBody);
              sentMessage = true;
              statusSink?.({ lastOutboundAt: Date.now() });
              if (info.kind === 'block') {
                restartTypingSoon();
              }
            }
            return;
          }
          const textLimit = account.config.textChunkLimit && account.config.textChunkLimit > 0 ? account.config.textChunkLimit : DEFAULT_TEXT_LIMIT;
          const chunkMode = account.config.chunkMode ?? 'length';
          const tableMode = core.channel.text.resolveMarkdownTableMode({
            cfg: config,
            channel: 'bluebubbles',
            accountId: account.accountId
          });
          const text2 = core.channel.text.convertMarkdownTables(payload.text ?? '', tableMode);
          const chunks = chunkMode === 'newline' ? core.channel.text.chunkTextWithMode(text2, textLimit, chunkMode) : core.channel.text.chunkMarkdownText(text2, textLimit);
          if (!chunks.length && text2) {
            chunks.push(text2);
          }
          if (!chunks.length) {
            return;
          }
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const result = await sendMessageBlueBubbles(outboundTarget, chunk, {
              cfg: config,
              accountId: account.accountId,
              replyToMessageGuid: replyToMessageGuid || void 0
            });
            maybeEnqueueOutboundMessageId(result.messageId, chunk);
            sentMessage = true;
            statusSink?.({ lastOutboundAt: Date.now() });
            if (info.kind === 'block') {
              restartTypingSoon();
            }
          }
        },
        onReplyStart: async () => {
          if (!chatGuidForActions) {
            return;
          }
          if (!baseUrl || !password) {
            return;
          }
          streamingActive = true;
          clearTypingRestartTimer();
          try {
            await sendBlueBubblesTyping(chatGuidForActions, true, {
              cfg: config,
              accountId: account.accountId
            });
          } catch (err) {
            runtime.error?.(`[bluebubbles] typing start failed: ${String(err)}`);
          }
        },
        onIdle: async () => {
          if (!chatGuidForActions) {
            return;
          }
          if (!baseUrl || !password) {
            return;
          }
        },
        onError: (err, info) => {
          runtime.error?.(`BlueBubbles ${info.kind} reply failed: ${String(err)}`);
        }
      },
      replyOptions: {
        onModelSelected,
        disableBlockStreaming: typeof account.config.blockStreaming === 'boolean' ? !account.config.blockStreaming : void 0
      }
    });
  } finally {
    const shouldStopTyping = Boolean(chatGuidForActions && baseUrl && password) && (streamingActive || !sentMessage);
    streamingActive = false;
    clearTypingRestartTimer();
    if (sentMessage && chatGuidForActions && ackMessageId) {
      core.channel.reactions.removeAckReactionAfterReply({
        removeAfterReply: removeAckAfterReply,
        ackReactionPromise,
        ackReactionValue: ackReactionValue ?? null,
        remove: () => sendBlueBubblesReaction({
          chatGuid: chatGuidForActions,
          messageGuid: ackMessageId,
          emoji: ackReactionValue ?? '',
          remove: true,
          opts: { cfg: config, accountId: account.accountId }
        }),
        onError: (err) => {
          logAckFailure({
            log: (msg) => logVerbose(core, runtime, msg),
            channel: 'bluebubbles',
            target: `${chatGuidForActions}/${ackMessageId}`,
            error: err
          });
        }
      });
    }
    if (shouldStopTyping) {
      sendBlueBubblesTyping(chatGuidForActions, false, {
        cfg: config,
        accountId: account.accountId
      }).catch((err) => {
        logTypingFailure({
          log: (msg) => logVerbose(core, runtime, msg),
          channel: 'bluebubbles',
          action: 'stop',
          target: chatGuidForActions,
          error: err
        });
      });
    }
  }
}
async function processReaction(reaction, target) {
  const { account, config, runtime, core } = target;
  if (reaction.fromMe) {
    return;
  }
  const dmPolicy = account.config.dmPolicy ?? 'pairing';
  const groupPolicy = account.config.groupPolicy ?? 'allowlist';
  const configAllowFrom = (account.config.allowFrom ?? []).map((entry) => String(entry));
  const configGroupAllowFrom = (account.config.groupAllowFrom ?? []).map((entry) => String(entry));
  const storeAllowFrom = await core.channel.pairing.readAllowFromStore('bluebubbles').catch(() => []);
  const effectiveAllowFrom = [...configAllowFrom, ...storeAllowFrom].map((entry) => String(entry).trim()).filter(Boolean);
  const effectiveGroupAllowFrom = [
    ...configGroupAllowFrom.length > 0 ? configGroupAllowFrom : configAllowFrom,
    ...storeAllowFrom
  ].map((entry) => String(entry).trim()).filter(Boolean);
  if (reaction.isGroup) {
    if (groupPolicy === 'disabled') {
      return;
    }
    if (groupPolicy === 'allowlist') {
      if (effectiveGroupAllowFrom.length === 0) {
        return;
      }
      const allowed = isAllowedBlueBubblesSender({
        allowFrom: effectiveGroupAllowFrom,
        sender: reaction.senderId,
        chatId: reaction.chatId ?? void 0,
        chatGuid: reaction.chatGuid ?? void 0,
        chatIdentifier: reaction.chatIdentifier ?? void 0
      });
      if (!allowed) {
        return;
      }
    }
  } else {
    if (dmPolicy === 'disabled') {
      return;
    }
    if (dmPolicy !== 'open') {
      const allowed = isAllowedBlueBubblesSender({
        allowFrom: effectiveAllowFrom,
        sender: reaction.senderId,
        chatId: reaction.chatId ?? void 0,
        chatGuid: reaction.chatGuid ?? void 0,
        chatIdentifier: reaction.chatIdentifier ?? void 0
      });
      if (!allowed) {
        return;
      }
    }
  }
  const chatId = reaction.chatId ?? void 0;
  const chatGuid = reaction.chatGuid ?? void 0;
  const chatIdentifier = reaction.chatIdentifier ?? void 0;
  const peerId = reaction.isGroup ? chatGuid ?? chatIdentifier ?? (chatId ? String(chatId) : 'group') : reaction.senderId;
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: 'bluebubbles',
    accountId: account.accountId,
    peer: {
      kind: reaction.isGroup ? 'group' : 'dm',
      id: peerId
    }
  });
  const senderLabel = reaction.senderName || reaction.senderId;
  const chatLabel = reaction.isGroup ? ` in group:${peerId}` : '';
  const messageDisplayId = getShortIdForUuid(reaction.messageId) || reaction.messageId;
  const text = reaction.action === 'removed' ? `${senderLabel} removed ${reaction.emoji} reaction [[reply_to:${messageDisplayId}]]${chatLabel}` : `${senderLabel} reacted with ${reaction.emoji} [[reply_to:${messageDisplayId}]]${chatLabel}`;
  core.system.enqueueSystemEvent(text, {
    sessionKey: route.sessionKey,
    contextKey: `bluebubbles:reaction:${reaction.action}:${peerId}:${reaction.messageId}:${reaction.senderId}:${reaction.emoji}`
  });
  logVerbose(core, runtime, `reaction event enqueued: ${text}`);
}
async function monitorBlueBubblesProvider(options) {
  const { account, config, runtime, abortSignal, statusSink } = options;
  const core = getBlueBubblesRuntime();
  const path = options.webhookPath?.trim() || DEFAULT_WEBHOOK_PATH;
  const serverInfo = await fetchBlueBubblesServerInfo({
    baseUrl: account.baseUrl,
    password: account.config.password,
    accountId: account.accountId,
    timeoutMs: 5e3
  }).catch(() => null);
  if (serverInfo?.os_version) {
    runtime.log?.(`[${account.accountId}] BlueBubbles server macOS ${serverInfo.os_version}`);
  }
  const unregister = registerBlueBubblesWebhookTarget({
    account,
    config,
    runtime,
    core,
    path,
    statusSink
  });
  return await new Promise((resolve) => {
    const stop = () => {
      unregister();
      resolve();
    };
    if (abortSignal?.aborted) {
      stop();
      return;
    }
    abortSignal?.addEventListener('abort', stop, { once: true });
    runtime.log?.(
      `[${account.accountId}] BlueBubbles webhook listening on ${normalizeWebhookPath(path)}`
    );
  });
}
function resolveWebhookPathFromConfig(config) {
  const raw = config?.webhookPath?.trim();
  if (raw) {
    return normalizeWebhookPath(raw);
  }
  return DEFAULT_WEBHOOK_PATH;
}
export {
  _resetBlueBubblesShortIdState,
  handleBlueBubblesWebhookRequest,
  monitorBlueBubblesProvider,
  registerBlueBubblesWebhookTarget,
  resolveBlueBubblesMessageId,
  resolveWebhookPathFromConfig
};
