/**
 * LINE rich menu creation and management
 * @typedef {object} RichMenuSize
 * @property {number} width
 * @property {number} height
 * @typedef {object} RichMenuAreaRequest
 * @property {{x: number, y: number, width: number, height: number}} bounds
 * @property {{type: string, [key: string]: unknown}} action
 * @typedef {object} CreateRichMenuParams
 * @property {string} [name]
 * @property {string} [chatBarText]
 * @property {RichMenuSize} [size]
 * @property {RichMenuAreaRequest[]} [areas]
 * @property {boolean} [selected]
 * @typedef {object} RichMenuOpts
 * @property {string} [accountId]
 * @property {string} [channelAccessToken]
 */
import { messagingApi } from '@line/bot-sdk';
import { readFile } from 'node:fs/promises';
import { loadConfig } from '../config/config.js';
import { logVerbose } from '../globals.js';
import { resolveLineAccount } from './accounts.js';
function resolveToken(explicit, params) {
  if (explicit?.trim()) {
    return explicit.trim();
  }
  if (!params.channelAccessToken) {
    throw new Error(
      `LINE channel access token missing for account "${params.accountId}" (set channels.line.channelAccessToken or LINE_CHANNEL_ACCESS_TOKEN).`
    );
  }
  return params.channelAccessToken.trim();
}
function getClient(opts = {}) {
  const cfg = loadConfig();
  const account = resolveLineAccount({
    cfg,
    accountId: opts.accountId
  });
  const token = resolveToken(opts.channelAccessToken, account);
  return new messagingApi.MessagingApiClient({
    channelAccessToken: token
  });
}
function getBlobClient(opts = {}) {
  const cfg = loadConfig();
  const account = resolveLineAccount({
    cfg,
    accountId: opts.accountId
  });
  const token = resolveToken(opts.channelAccessToken, account);
  return new messagingApi.MessagingApiBlobClient({
    channelAccessToken: token
  });
}
async function createRichMenu(menu, opts = {}) {
  const client = getClient(opts);
  const richMenuRequest = {
    size: menu.size,
    selected: menu.selected ?? false,
    name: menu.name.slice(0, 300),
    // LINE limit
    chatBarText: menu.chatBarText.slice(0, 14),
    // LINE limit
    areas: menu.areas
  };
  const response = await client.createRichMenu(richMenuRequest);
  if (opts.verbose) {
    logVerbose(`line: created rich menu ${response.richMenuId}`);
  }
  return response.richMenuId;
}
async function uploadRichMenuImage(richMenuId, imagePath, opts = {}) {
  const blobClient = getBlobClient(opts);
  const imageData = await readFile(imagePath);
  const contentType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  await blobClient.setRichMenuImage(richMenuId, new Blob([imageData], { type: contentType }));
  if (opts.verbose) {
    logVerbose(`line: uploaded image to rich menu ${richMenuId}`);
  }
}
async function setDefaultRichMenu(richMenuId, opts = {}) {
  const client = getClient(opts);
  await client.setDefaultRichMenu(richMenuId);
  if (opts.verbose) {
    logVerbose(`line: set default rich menu to ${richMenuId}`);
  }
}
async function cancelDefaultRichMenu(opts = {}) {
  const client = getClient(opts);
  await client.cancelDefaultRichMenu();
  if (opts.verbose) {
    logVerbose('line: cancelled default rich menu');
  }
}
async function getDefaultRichMenuId(opts = {}) {
  const client = getClient(opts);
  try {
    const response = await client.getDefaultRichMenuId();
    return response.richMenuId ?? null;
  } catch {
    return null;
  }
}
async function linkRichMenuToUser(userId, richMenuId, opts = {}) {
  const client = getClient(opts);
  await client.linkRichMenuIdToUser(userId, richMenuId);
  if (opts.verbose) {
    logVerbose(`line: linked rich menu ${richMenuId} to user ${userId}`);
  }
}
async function linkRichMenuToUsers(userIds, richMenuId, opts = {}) {
  const client = getClient(opts);
  const batches = [];
  for (let i = 0; i < userIds.length; i += 500) {
    batches.push(userIds.slice(i, i + 500));
  }
  for (const batch of batches) {
    await client.linkRichMenuIdToUsers({
      richMenuId,
      userIds: batch
    });
  }
  if (opts.verbose) {
    logVerbose(`line: linked rich menu ${richMenuId} to ${userIds.length} users`);
  }
}
async function unlinkRichMenuFromUser(userId, opts = {}) {
  const client = getClient(opts);
  await client.unlinkRichMenuIdFromUser(userId);
  if (opts.verbose) {
    logVerbose(`line: unlinked rich menu from user ${userId}`);
  }
}
async function unlinkRichMenuFromUsers(userIds, opts = {}) {
  const client = getClient(opts);
  const batches = [];
  for (let i = 0; i < userIds.length; i += 500) {
    batches.push(userIds.slice(i, i + 500));
  }
  for (const batch of batches) {
    await client.unlinkRichMenuIdFromUsers({
      userIds: batch
    });
  }
  if (opts.verbose) {
    logVerbose(`line: unlinked rich menu from ${userIds.length} users`);
  }
}
async function getRichMenuIdOfUser(userId, opts = {}) {
  const client = getClient(opts);
  try {
    const response = await client.getRichMenuIdOfUser(userId);
    return response.richMenuId ?? null;
  } catch {
    return null;
  }
}
async function getRichMenuList(opts = {}) {
  const client = getClient(opts);
  const response = await client.getRichMenuList();
  return response.richmenus ?? [];
}
async function getRichMenu(richMenuId, opts = {}) {
  const client = getClient(opts);
  try {
    return await client.getRichMenu(richMenuId);
  } catch {
    return null;
  }
}
async function deleteRichMenu(richMenuId, opts = {}) {
  const client = getClient(opts);
  await client.deleteRichMenu(richMenuId);
  if (opts.verbose) {
    logVerbose(`line: deleted rich menu ${richMenuId}`);
  }
}
async function createRichMenuAlias(richMenuId, aliasId, opts = {}) {
  const client = getClient(opts);
  await client.createRichMenuAlias({
    richMenuId,
    richMenuAliasId: aliasId
  });
  if (opts.verbose) {
    logVerbose(`line: created alias ${aliasId} for rich menu ${richMenuId}`);
  }
}
async function deleteRichMenuAlias(aliasId, opts = {}) {
  const client = getClient(opts);
  await client.deleteRichMenuAlias(aliasId);
  if (opts.verbose) {
    logVerbose(`line: deleted alias ${aliasId}`);
  }
}
function createGridLayout(height, actions) {
  const colWidth = Math.floor(2500 / 3);
  const rowHeight = Math.floor(height / 2);
  return [
    // Top row
    { bounds: { x: 0, y: 0, width: colWidth, height: rowHeight }, action: actions[0] },
    { bounds: { x: colWidth, y: 0, width: colWidth, height: rowHeight }, action: actions[1] },
    { bounds: { x: colWidth * 2, y: 0, width: colWidth, height: rowHeight }, action: actions[2] },
    // Bottom row
    { bounds: { x: 0, y: rowHeight, width: colWidth, height: rowHeight }, action: actions[3] },
    {
      bounds: { x: colWidth, y: rowHeight, width: colWidth, height: rowHeight },
      action: actions[4]
    },
    {
      bounds: { x: colWidth * 2, y: rowHeight, width: colWidth, height: rowHeight },
      action: actions[5]
    }
  ];
}
function messageAction(label, text) {
  return {
    type: 'message',
    label: label.slice(0, 20),
    text: text ?? label
  };
}
function uriAction(label, uri) {
  return {
    type: 'uri',
    label: label.slice(0, 20),
    uri
  };
}
function postbackAction(label, data, displayText) {
  return {
    type: 'postback',
    label: label.slice(0, 20),
    data: data.slice(0, 300),
    displayText: displayText?.slice(0, 300)
  };
}
function datetimePickerAction(label, data, mode, options) {
  return {
    type: 'datetimepicker',
    label: label.slice(0, 20),
    data: data.slice(0, 300),
    mode,
    initial: options?.initial,
    max: options?.max,
    min: options?.min
  };
}
function createDefaultMenuConfig() {
  return {
    size: { width: 2500, height: 843 },
    selected: false,
    name: 'Default Menu',
    chatBarText: 'Menu',
    areas: createGridLayout(843, [
      messageAction('Help', '/help'),
      messageAction('Status', '/status'),
      messageAction('Settings', '/settings'),
      messageAction('About', '/about'),
      messageAction('Feedback', '/feedback'),
      messageAction('Contact', '/contact')
    ])
  };
}
export {
  cancelDefaultRichMenu,
  createDefaultMenuConfig,
  createGridLayout,
  createRichMenu,
  createRichMenuAlias,
  datetimePickerAction,
  deleteRichMenu,
  deleteRichMenuAlias,
  getDefaultRichMenuId,
  getRichMenu,
  getRichMenuIdOfUser,
  getRichMenuList,
  linkRichMenuToUser,
  linkRichMenuToUsers,
  messageAction,
  postbackAction,
  setDefaultRichMenu,
  unlinkRichMenuFromUser,
  unlinkRichMenuFromUsers,
  uploadRichMenuImage,
  uriAction
};
