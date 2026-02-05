/**
 * WhatsApp action tool for messaging and media operations.
 * @module agents/tools/whatsapp-actions
 */
import { sendReactionWhatsApp } from '../../web/outbound.js';
import { createActionGate, jsonResult, readReactionParams, readStringParam } from './common.js';
async function handleWhatsAppAction(params, cfg) {
  const action = readStringParam(params, 'action', { required: true });
  const isActionEnabled = createActionGate(cfg.channels?.whatsapp?.actions);
  if (action === 'react') {
    if (!isActionEnabled('reactions')) {
      throw new Error('WhatsApp reactions are disabled.');
    }
    const chatJid = readStringParam(params, 'chatJid', { required: true });
    const messageId = readStringParam(params, 'messageId', { required: true });
    const { emoji, remove, isEmpty } = readReactionParams(params, {
      removeErrorMessage: 'Emoji is required to remove a WhatsApp reaction.'
    });
    const participant = readStringParam(params, 'participant');
    const accountId = readStringParam(params, 'accountId');
    const fromMeRaw = params.fromMe;
    const fromMe = typeof fromMeRaw === 'boolean' ? fromMeRaw : void 0;
    const resolvedEmoji = remove ? '' : emoji;
    await sendReactionWhatsApp(chatJid, messageId, resolvedEmoji, {
      verbose: false,
      fromMe,
      participant: participant ?? void 0,
      accountId: accountId ?? void 0
    });
    if (!remove && !isEmpty) {
      return jsonResult({ ok: true, added: emoji });
    }
    return jsonResult({ ok: true, removed: true });
  }
  throw new Error(`Unsupported WhatsApp action: ${action}`);
}
export {
  handleWhatsAppAction
};
