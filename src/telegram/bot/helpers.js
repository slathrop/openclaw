const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { formatLocationText } from '../../channels/location.js';
const TELEGRAM_GENERAL_TOPIC_ID = 1;
function resolveTelegramForumThreadId(params) {
  if (!params.isForum) {
    return void 0;
  }
  if (params.messageThreadId === null || params.messageThreadId === undefined) {
    return TELEGRAM_GENERAL_TOPIC_ID;
  }
  return params.messageThreadId;
}
__name(resolveTelegramForumThreadId, 'resolveTelegramForumThreadId');
function resolveTelegramThreadSpec(params) {
  if (params.isGroup) {
    const id = resolveTelegramForumThreadId({
      isForum: params.isForum,
      messageThreadId: params.messageThreadId
    });
    return {
      id,
      scope: params.isForum ? 'forum' : 'none'
    };
  }
  if (params.messageThreadId === null || params.messageThreadId === undefined) {
    return { scope: 'dm' };
  }
  return {
    id: params.messageThreadId,
    scope: 'dm'
  };
}
__name(resolveTelegramThreadSpec, 'resolveTelegramThreadSpec');
function buildTelegramThreadParams(thread) {
  if (!thread?.id) {
    return void 0;
  }
  const normalized = Math.trunc(thread.id);
  if (normalized === TELEGRAM_GENERAL_TOPIC_ID && thread.scope === 'forum') {
    return void 0;
  }
  return { message_thread_id: normalized };
}
__name(buildTelegramThreadParams, 'buildTelegramThreadParams');
function buildTypingThreadParams(messageThreadId) {
  if (messageThreadId === null || messageThreadId === undefined) {
    return void 0;
  }
  return { message_thread_id: Math.trunc(messageThreadId) };
}
__name(buildTypingThreadParams, 'buildTypingThreadParams');
function resolveTelegramStreamMode(telegramCfg) {
  const raw = telegramCfg?.streamMode?.trim().toLowerCase();
  if (raw === 'off' || raw === 'partial' || raw === 'block') {
    return raw;
  }
  return 'partial';
}
__name(resolveTelegramStreamMode, 'resolveTelegramStreamMode');
function buildTelegramGroupPeerId(chatId, messageThreadId) {
  return messageThreadId !== null && messageThreadId !== undefined ? `${chatId}:topic:${messageThreadId}` : String(chatId);
}
__name(buildTelegramGroupPeerId, 'buildTelegramGroupPeerId');
function buildTelegramGroupFrom(chatId, messageThreadId) {
  return `telegram:group:${buildTelegramGroupPeerId(chatId, messageThreadId)}`;
}
__name(buildTelegramGroupFrom, 'buildTelegramGroupFrom');
function buildSenderName(msg) {
  const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ').trim() || msg.from?.username;
  return name || void 0;
}
__name(buildSenderName, 'buildSenderName');
function buildSenderLabel(msg, senderId) {
  const name = buildSenderName(msg);
  const username = msg.from?.username ? `@${msg.from.username}` : void 0;
  let label = name;
  if (name && username) {
    label = `${name} (${username})`;
  } else if (!name && username) {
    label = username;
  }
  const normalizedSenderId = senderId !== null && senderId !== undefined && `${senderId}`.trim() ? `${senderId}`.trim() : void 0;
  const fallbackId = normalizedSenderId ?? (msg.from?.id !== null && msg.from?.id !== undefined ? String(msg.from.id) : void 0);
  const idPart = fallbackId ? `id:${fallbackId}` : void 0;
  if (label && idPart) {
    return `${label} ${idPart}`;
  }
  if (label) {
    return label;
  }
  return idPart ?? 'id:unknown';
}
__name(buildSenderLabel, 'buildSenderLabel');
function buildGroupLabel(msg, chatId, messageThreadId) {
  const title = msg.chat?.title;
  const topicSuffix = messageThreadId !== null && messageThreadId !== undefined ? ` topic:${messageThreadId}` : '';
  if (title) {
    return `${title} id:${chatId}${topicSuffix}`;
  }
  return `group:${chatId}${topicSuffix}`;
}
__name(buildGroupLabel, 'buildGroupLabel');
function hasBotMention(msg, botUsername) {
  const text = (msg.text ?? msg.caption ?? '').toLowerCase();
  if (text.includes(`@${botUsername}`)) {
    return true;
  }
  const entities = msg.entities ?? msg.caption_entities ?? [];
  for (const ent of entities) {
    if (ent.type !== 'mention') {
      continue;
    }
    const slice = (msg.text ?? msg.caption ?? '').slice(ent.offset, ent.offset + ent.length);
    if (slice.toLowerCase() === `@${botUsername}`) {
      return true;
    }
  }
  return false;
}
__name(hasBotMention, 'hasBotMention');
function expandTextLinks(text, entities) {
  if (!text || !entities?.length) {
    return text;
  }
  const textLinks = entities.filter(
    (entity) => entity.type === 'text_link' && Boolean(entity.url)
  ).toSorted((a, b) => b.offset - a.offset);
  if (textLinks.length === 0) {
    return text;
  }
  let result = text;
  for (const entity of textLinks) {
    const linkText = text.slice(entity.offset, entity.offset + entity.length);
    const markdown = `[${linkText}](${entity.url})`;
    result = result.slice(0, entity.offset) + markdown + result.slice(entity.offset + entity.length);
  }
  return result;
}
__name(expandTextLinks, 'expandTextLinks');
function resolveTelegramReplyId(raw) {
  if (!raw) {
    return void 0;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return void 0;
  }
  return parsed;
}
__name(resolveTelegramReplyId, 'resolveTelegramReplyId');
function describeReplyTarget(msg) {
  const reply = msg.reply_to_message;
  const quote = msg.quote;
  let body = '';
  let kind = 'reply';
  if (quote?.text) {
    body = quote.text.trim();
    if (body) {
      kind = 'quote';
    }
  }
  if (!body && reply) {
    const replyBody = (reply.text ?? reply.caption ?? '').trim();
    body = replyBody;
    if (!body) {
      if (reply.photo) {
        body = '<media:image>';
      } else if (reply.video) {
        body = '<media:video>';
      } else if (reply.audio || reply.voice) {
        body = '<media:audio>';
      } else if (reply.document) {
        body = '<media:document>';
      } else {
        const locationData = extractTelegramLocation(reply);
        if (locationData) {
          body = formatLocationText(locationData);
        }
      }
    }
  }
  if (!body) {
    return null;
  }
  const sender = reply ? buildSenderName(reply) : void 0;
  const senderLabel = sender ?? 'unknown sender';
  return {
    id: reply?.message_id ? String(reply.message_id) : void 0,
    sender: senderLabel,
    body,
    kind
  };
}
__name(describeReplyTarget, 'describeReplyTarget');
function normalizeForwardedUserLabel(user) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  const username = user.username?.trim() || void 0;
  const id = String(user.id);
  const display = (name && username ? `${name} (@${username})` : name || (username ? `@${username}` : void 0)) || `user:${id}`;
  return { display, name: name || void 0, username, id };
}
__name(normalizeForwardedUserLabel, 'normalizeForwardedUserLabel');
function normalizeForwardedChatLabel(chat, fallbackKind) {
  const title = chat.title?.trim() || void 0;
  const username = chat.username?.trim() || void 0;
  const id = String(chat.id);
  const display = title || (username ? `@${username}` : void 0) || `${fallbackKind}:${id}`;
  return { display, title, username, id };
}
__name(normalizeForwardedChatLabel, 'normalizeForwardedChatLabel');
function buildForwardedContextFromUser(params) {
  const { display, name, username, id } = normalizeForwardedUserLabel(params.user);
  if (!display) {
    return null;
  }
  return {
    from: display,
    date: params.date,
    fromType: params.type,
    fromId: id,
    fromUsername: username,
    fromTitle: name
  };
}
__name(buildForwardedContextFromUser, 'buildForwardedContextFromUser');
function buildForwardedContextFromHiddenName(params) {
  const trimmed = params.name?.trim();
  if (!trimmed) {
    return null;
  }
  return {
    from: trimmed,
    date: params.date,
    fromType: params.type,
    fromTitle: trimmed
  };
}
__name(buildForwardedContextFromHiddenName, 'buildForwardedContextFromHiddenName');
function buildForwardedContextFromChat(params) {
  const fallbackKind = params.type === 'channel' ? 'channel' : 'chat';
  const { display, title, username, id } = normalizeForwardedChatLabel(params.chat, fallbackKind);
  if (!display) {
    return null;
  }
  const signature = params.signature?.trim() || void 0;
  const from = signature ? `${display} (${signature})` : display;
  const chatType = params.chat.type?.trim() || void 0;
  return {
    from,
    date: params.date,
    fromType: params.type,
    fromId: id,
    fromUsername: username,
    fromTitle: title,
    fromSignature: signature,
    fromChatType: chatType,
    fromMessageId: params.messageId
  };
}
__name(buildForwardedContextFromChat, 'buildForwardedContextFromChat');
function resolveForwardOrigin(origin) {
  switch (origin.type) {
    case 'user':
      return buildForwardedContextFromUser({
        user: origin.sender_user,
        date: origin.date,
        type: 'user'
      });
    case 'hidden_user':
      return buildForwardedContextFromHiddenName({
        name: origin.sender_user_name,
        date: origin.date,
        type: 'hidden_user'
      });
    case 'chat':
      return buildForwardedContextFromChat({
        chat: origin.sender_chat,
        date: origin.date,
        type: 'chat',
        signature: origin.author_signature
      });
    case 'channel':
      return buildForwardedContextFromChat({
        chat: origin.chat,
        date: origin.date,
        type: 'channel',
        signature: origin.author_signature,
        messageId: origin.message_id
      });
    default:
      origin;
      return null;
  }
}
__name(resolveForwardOrigin, 'resolveForwardOrigin');
function normalizeForwardedContext(msg) {
  if (!msg.forward_origin) {
    return null;
  }
  return resolveForwardOrigin(msg.forward_origin);
}
__name(normalizeForwardedContext, 'normalizeForwardedContext');
function extractTelegramLocation(msg) {
  const { venue, location } = msg;
  if (venue) {
    return {
      latitude: venue.location.latitude,
      longitude: venue.location.longitude,
      accuracy: venue.location.horizontal_accuracy,
      name: venue.title,
      address: venue.address,
      source: 'place',
      isLive: false
    };
  }
  if (location) {
    const isLive = typeof location.live_period === 'number' && location.live_period > 0;
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.horizontal_accuracy,
      source: isLive ? 'live' : 'pin',
      isLive
    };
  }
  return null;
}
__name(extractTelegramLocation, 'extractTelegramLocation');
export {
  buildGroupLabel,
  buildSenderLabel,
  buildSenderName,
  buildTelegramGroupFrom,
  buildTelegramGroupPeerId,
  buildTelegramThreadParams,
  buildTypingThreadParams,
  describeReplyTarget,
  expandTextLinks,
  extractTelegramLocation,
  hasBotMention,
  normalizeForwardedContext,
  resolveTelegramForumThreadId,
  resolveTelegramReplyId,
  resolveTelegramStreamMode,
  resolveTelegramThreadSpec
};
