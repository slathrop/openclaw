import { scot, da } from '@urbit/aura';
async function sendDm({ api, fromShip, toShip, text }) {
  const story = [{ inline: [text] }];
  const sentAt = Date.now();
  const idUd = scot('ud', da.fromUnix(sentAt));
  const id = `${fromShip}/${idUd}`;
  const delta = {
    add: {
      memo: {
        content: story,
        author: fromShip,
        sent: sentAt
      },
      kind: null,
      time: null
    }
  };
  const action = {
    ship: toShip,
    diff: { id, delta }
  };
  await api.poke({
    app: 'chat',
    mark: 'chat-dm-action',
    json: action
  });
  return { channel: 'tlon', messageId: id };
}
async function sendGroupMessage({
  api,
  fromShip,
  hostShip,
  channelName,
  text,
  replyToId
}) {
  const story = [{ inline: [text] }];
  const sentAt = Date.now();
  let formattedReplyId = replyToId;
  if (replyToId && /^\d+$/.test(replyToId)) {
    try {
      formattedReplyId = formatUd(BigInt(replyToId));
    } catch { /* intentionally empty */ }
  }
  const action = {
    channel: {
      nest: `chat/${hostShip}/${channelName}`,
      action: formattedReplyId ? {
        // Thread reply - needs post wrapper around reply action
        // ReplyActionAdd takes Memo: {content, author, sent} - no kind/blob/meta
        post: {
          reply: {
            id: formattedReplyId,
            action: {
              add: {
                content: story,
                author: fromShip,
                sent: sentAt
              }
            }
          }
        }
      } : {
        // Regular post
        post: {
          add: {
            content: story,
            author: fromShip,
            sent: sentAt,
            kind: '/chat',
            blob: null,
            meta: null
          }
        }
      }
    }
  };
  await api.poke({
    app: 'channels',
    mark: 'channel-action-1',
    json: action
  });
  return { channel: 'tlon', messageId: `${fromShip}/${sentAt}` };
}
function buildMediaText(text, mediaUrl) {
  const cleanText = text?.trim() ?? '';
  const cleanUrl = mediaUrl?.trim() ?? '';
  if (cleanText && cleanUrl) {
    return `${cleanText}
${cleanUrl}`;
  }
  if (cleanUrl) {
    return cleanUrl;
  }
  return cleanText;
}
export {
  buildMediaText,
  sendDm,
  sendGroupMessage
};
