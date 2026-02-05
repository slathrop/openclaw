import {
  readNumberParam,
  readStringArrayParam,
  readStringParam
} from '../../../../agents/tools/common.js';
import { handleDiscordAction } from '../../../../agents/tools/discord-actions.js';
import { resolveDiscordChannelId } from '../../../../discord/targets.js';
import { tryHandleDiscordMessageActionGuildAdmin } from './handle-action.guild-admin.js';
const providerId = 'discord';
function readParentIdParam(params) {
  if (params.clearParent === true) {
    return null;
  }
  if (params.parentId === null) {
    return null;
  }
  return readStringParam(params, 'parentId');
}
async function handleDiscordMessageAction(ctx) {
  const { action, params, cfg } = ctx;
  const accountId = ctx.accountId ?? readStringParam(params, 'accountId');
  const resolveChannelId = () => resolveDiscordChannelId(
    readStringParam(params, 'channelId') ?? readStringParam(params, 'to', { required: true })
  );
  if (action === 'send') {
    const to = readStringParam(params, 'to', { required: true });
    const content = readStringParam(params, 'message', {
      required: true,
      allowEmpty: true
    });
    const mediaUrl = readStringParam(params, 'media', { trim: false });
    const replyTo = readStringParam(params, 'replyTo');
    const embeds = Array.isArray(params.embeds) ? params.embeds : void 0;
    return await handleDiscordAction(
      {
        action: 'sendMessage',
        accountId: accountId ?? void 0,
        to,
        content,
        mediaUrl: mediaUrl ?? void 0,
        replyTo: replyTo ?? void 0,
        embeds
      },
      cfg
    );
  }
  if (action === 'poll') {
    const to = readStringParam(params, 'to', { required: true });
    const question = readStringParam(params, 'pollQuestion', {
      required: true
    });
    const answers = readStringArrayParam(params, 'pollOption', { required: true }) ?? [];
    const allowMultiselect = typeof params.pollMulti === 'boolean' ? params.pollMulti : void 0;
    const durationHours = readNumberParam(params, 'pollDurationHours', {
      integer: true
    });
    return await handleDiscordAction(
      {
        action: 'poll',
        accountId: accountId ?? void 0,
        to,
        question,
        answers,
        allowMultiselect,
        durationHours: durationHours ?? void 0,
        content: readStringParam(params, 'message')
      },
      cfg
    );
  }
  if (action === 'react') {
    const messageId = readStringParam(params, 'messageId', { required: true });
    const emoji = readStringParam(params, 'emoji', { allowEmpty: true });
    const remove = typeof params.remove === 'boolean' ? params.remove : void 0;
    return await handleDiscordAction(
      {
        action: 'react',
        accountId: accountId ?? void 0,
        channelId: resolveChannelId(),
        messageId,
        emoji,
        remove
      },
      cfg
    );
  }
  if (action === 'reactions') {
    const messageId = readStringParam(params, 'messageId', { required: true });
    const limit = readNumberParam(params, 'limit', { integer: true });
    return await handleDiscordAction(
      {
        action: 'reactions',
        accountId: accountId ?? void 0,
        channelId: resolveChannelId(),
        messageId,
        limit
      },
      cfg
    );
  }
  if (action === 'read') {
    const limit = readNumberParam(params, 'limit', { integer: true });
    return await handleDiscordAction(
      {
        action: 'readMessages',
        accountId: accountId ?? void 0,
        channelId: resolveChannelId(),
        limit,
        before: readStringParam(params, 'before'),
        after: readStringParam(params, 'after'),
        around: readStringParam(params, 'around')
      },
      cfg
    );
  }
  if (action === 'edit') {
    const messageId = readStringParam(params, 'messageId', { required: true });
    const content = readStringParam(params, 'message', { required: true });
    return await handleDiscordAction(
      {
        action: 'editMessage',
        accountId: accountId ?? void 0,
        channelId: resolveChannelId(),
        messageId,
        content
      },
      cfg
    );
  }
  if (action === 'delete') {
    const messageId = readStringParam(params, 'messageId', { required: true });
    return await handleDiscordAction(
      {
        action: 'deleteMessage',
        accountId: accountId ?? void 0,
        channelId: resolveChannelId(),
        messageId
      },
      cfg
    );
  }
  if (action === 'pin' || action === 'unpin' || action === 'list-pins') {
    const messageId = action === 'list-pins' ? void 0 : readStringParam(params, 'messageId', { required: true });
    return await handleDiscordAction(
      {
        action: action === 'pin' ? 'pinMessage' : action === 'unpin' ? 'unpinMessage' : 'listPins',
        accountId: accountId ?? void 0,
        channelId: resolveChannelId(),
        messageId
      },
      cfg
    );
  }
  if (action === 'permissions') {
    return await handleDiscordAction(
      {
        action: 'permissions',
        accountId: accountId ?? void 0,
        channelId: resolveChannelId()
      },
      cfg
    );
  }
  if (action === 'thread-create') {
    const name = readStringParam(params, 'threadName', { required: true });
    const messageId = readStringParam(params, 'messageId');
    const autoArchiveMinutes = readNumberParam(params, 'autoArchiveMin', {
      integer: true
    });
    return await handleDiscordAction(
      {
        action: 'threadCreate',
        accountId: accountId ?? void 0,
        channelId: resolveChannelId(),
        name,
        messageId,
        autoArchiveMinutes
      },
      cfg
    );
  }
  if (action === 'sticker') {
    const stickerIds = readStringArrayParam(params, 'stickerId', {
      required: true,
      label: 'sticker-id'
    }) ?? [];
    return await handleDiscordAction(
      {
        action: 'sticker',
        accountId: accountId ?? void 0,
        to: readStringParam(params, 'to', { required: true }),
        stickerIds,
        content: readStringParam(params, 'message')
      },
      cfg
    );
  }
  if (action === 'set-presence') {
    return await handleDiscordAction(
      {
        action: 'setPresence',
        accountId: accountId ?? void 0,
        status: readStringParam(params, 'status'),
        activityType: readStringParam(params, 'activityType'),
        activityName: readStringParam(params, 'activityName'),
        activityUrl: readStringParam(params, 'activityUrl'),
        activityState: readStringParam(params, 'activityState')
      },
      cfg
    );
  }
  const adminResult = await tryHandleDiscordMessageActionGuildAdmin({
    ctx,
    resolveChannelId,
    readParentIdParam
  });
  if (adminResult !== void 0) {
    return adminResult;
  }
  throw new Error(`Action ${String(action)} is not supported for provider ${providerId}.`);
}
export {
  handleDiscordMessageAction
};
