/**
 * @module sessions/group
 * Group session key resolution and display name generation.
 */
import {listDeliverableMessageChannels} from '../../utils/message-channel.js';

const getGroupSurfaces = () => new Set([...listDeliverableMessageChannels(), 'webchat']);

/**
 * @param {string} [raw]
 * @returns {string}
 */
function normalizeGroupLabel(raw) {
  const trimmed = raw?.trim().toLowerCase() ?? '';
  if (!trimmed) {
    return '';
  }
  const dashed = trimmed.replace(/\s+/g, '-');
  const cleaned = dashed.replace(/[^a-z0-9#@._+-]+/g, '-');
  return cleaned.replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '');
}

/**
 * @param {string} [value]
 * @returns {string}
 */
function shortenGroupId(value) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  if (trimmed.length <= 14) {
    return trimmed;
  }
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

/**
 * Builds a human-readable display name for a group session.
 * @param {{ provider?: string, subject?: string, groupChannel?: string, space?: string, id?: string, key: string }} params
 * @returns {string}
 */
export function buildGroupDisplayName(params) {
  const providerKey = (params.provider?.trim().toLowerCase() || 'group').trim();
  const groupChannel = params.groupChannel?.trim();
  const space = params.space?.trim();
  const subject = params.subject?.trim();
  const detail =
    (groupChannel && space
      ? `${space}${groupChannel.startsWith('#') ? '' : '#'}${groupChannel}`
      : groupChannel || subject || space || '') || '';
  const fallbackId = params.id?.trim() || params.key;
  const rawLabel = detail || fallbackId;
  let token = normalizeGroupLabel(rawLabel);
  if (!token) {
    token = normalizeGroupLabel(shortenGroupId(rawLabel));
  }
  if (!params.groupChannel && token.startsWith('#')) {
    token = token.replace(/^#+/, '');
  }
  if (token && !/^[@#]/.test(token) && !token.startsWith('g-') && !token.includes('#')) {
    token = `g-${token}`;
  }
  return token ? `${providerKey}:${token}` : providerKey;
}

/**
 * Resolves a group session key from a message context.
 * @param {import('../../auto-reply/templating.js').MsgContext} ctx
 * @returns {import('./types.js').GroupKeyResolution | null}
 */
export function resolveGroupSessionKey(ctx) {
  const from = typeof ctx.From === 'string' ? ctx.From.trim() : '';
  const chatType = ctx.ChatType?.trim().toLowerCase();
  const normalizedChatType =
    chatType === 'channel' ? 'channel' : chatType === 'group' ? 'group' : undefined;

  const isWhatsAppGroupId = from.toLowerCase().endsWith('@g.us');
  const looksLikeGroup =
    normalizedChatType === 'group' ||
    normalizedChatType === 'channel' ||
    from.includes(':group:') ||
    from.includes(':channel:') ||
    isWhatsAppGroupId;
  if (!looksLikeGroup) {
    return null;
  }

  const providerHint = ctx.Provider?.trim().toLowerCase();

  const parts = from.split(':').filter(Boolean);
  const head = parts[0]?.trim().toLowerCase() ?? '';
  const headIsSurface = head ? getGroupSurfaces().has(head) : false;

  const provider = headIsSurface
    ? head
    : (providerHint ?? (isWhatsAppGroupId ? 'whatsapp' : undefined));
  if (!provider) {
    return null;
  }

  const second = parts[1]?.trim().toLowerCase();
  const secondIsKind = second === 'group' || second === 'channel';
  const kind = secondIsKind
    ? second
    : from.includes(':channel:') || normalizedChatType === 'channel'
      ? 'channel'
      : 'group';
  const id = headIsSurface
    ? secondIsKind
      ? parts.slice(2).join(':')
      : parts.slice(1).join(':')
    : from;
  const finalId = id.trim().toLowerCase();
  if (!finalId) {
    return null;
  }

  return {
    key: `${provider}:${kind}:${finalId}`,
    channel: provider,
    id: finalId,
    chatType: kind === 'channel' ? 'channel' : 'group'
  };
}
