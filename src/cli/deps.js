const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { logWebSelfId, sendMessageWhatsApp } from '../channels/web/index.js';
import { sendMessageDiscord } from '../discord/send.js';
import { sendMessageIMessage } from '../imessage/send.js';
import { sendMessageSignal } from '../signal/send.js';
import { sendMessageSlack } from '../slack/send.js';
import { sendMessageTelegram } from '../telegram/send.js';
function createDefaultDeps() {
  return {
    sendMessageWhatsApp,
    sendMessageTelegram,
    sendMessageDiscord,
    sendMessageSlack,
    sendMessageSignal,
    sendMessageIMessage
  };
}
__name(createDefaultDeps, 'createDefaultDeps');
function createOutboundSendDeps(deps) {
  return {
    sendWhatsApp: deps.sendMessageWhatsApp,
    sendTelegram: deps.sendMessageTelegram,
    sendDiscord: deps.sendMessageDiscord,
    sendSlack: deps.sendMessageSlack,
    sendSignal: deps.sendMessageSignal,
    sendIMessage: deps.sendMessageIMessage
  };
}
__name(createOutboundSendDeps, 'createOutboundSendDeps');
export {
  createDefaultDeps,
  createOutboundSendDeps,
  logWebSelfId
};
