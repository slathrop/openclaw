/**
 * @module pi-embedded-messaging
 * Messaging tool integration for embedded Pi agent sessions.
 */
import { getChannelPlugin, normalizeChannelId } from '../channels/plugins/index.js';
const CORE_MESSAGING_TOOLS = /* @__PURE__ */ new Set(['sessions_send', 'message']);
function isMessagingTool(toolName) {
  if (CORE_MESSAGING_TOOLS.has(toolName)) {
    return true;
  }
  const providerId = normalizeChannelId(toolName);
  return Boolean(providerId && getChannelPlugin(providerId)?.actions);
}
function isMessagingToolSendAction(toolName, args) {
  const action = typeof args.action === 'string' ? args.action.trim() : '';
  if (toolName === 'sessions_send') {
    return true;
  }
  if (toolName === 'message') {
    return action === 'send' || action === 'thread-reply';
  }
  const providerId = normalizeChannelId(toolName);
  if (!providerId) {
    return false;
  }
  const plugin = getChannelPlugin(providerId);
  if (!plugin?.actions?.extractToolSend) {
    return false;
  }
  return Boolean(plugin.actions.extractToolSend({ args })?.to);
}
export {
  isMessagingTool,
  isMessagingToolSendAction
};
