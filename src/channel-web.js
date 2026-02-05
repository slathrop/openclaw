import {
  DEFAULT_WEB_MEDIA_BYTES,
  HEARTBEAT_PROMPT,
  HEARTBEAT_TOKEN,
  monitorWebChannel,
  resolveHeartbeatRecipients,
  runWebHeartbeatOnce
} from './web/auto-reply.js';
import {
  extractMediaPlaceholder,
  extractText,
  monitorWebInbox
} from './web/inbound.js';
import { loginWeb } from './web/login.js';
import { loadWebMedia, optimizeImageToJpeg } from './web/media.js';
import { sendMessageWhatsApp } from './web/outbound.js';
import {
  createWaSocket,
  formatError,
  getStatusCode,
  logoutWeb,
  logWebSelfId,
  pickWebChannel,
  WA_WEB_AUTH_DIR,
  waitForWaConnection,
  webAuthExists
} from './web/session.js';
export {
  DEFAULT_WEB_MEDIA_BYTES,
  HEARTBEAT_PROMPT,
  HEARTBEAT_TOKEN,
  WA_WEB_AUTH_DIR,
  createWaSocket,
  extractMediaPlaceholder,
  extractText,
  formatError,
  getStatusCode,
  loadWebMedia,
  logWebSelfId,
  loginWeb,
  logoutWeb,
  monitorWebChannel,
  monitorWebInbox,
  optimizeImageToJpeg,
  pickWebChannel,
  resolveHeartbeatRecipients,
  runWebHeartbeatOnce,
  sendMessageWhatsApp,
  waitForWaConnection,
  webAuthExists
};
