import { normalizeShip } from '../targets.js';
function formatModelName(modelString) {
  if (!modelString) {
    return 'AI';
  }
  const modelName = modelString.includes('/') ? modelString.split('/')[1] : modelString;
  const modelMappings = {
    'claude-opus-4-6': 'Claude Opus 4.6',
    'claude-opus-4-5': 'Claude Opus 4.5',
    'claude-sonnet-4-5': 'Claude Sonnet 4.5',
    'claude-sonnet-3-5': 'Claude Sonnet 3.5',
    'gpt-4o': 'GPT-4o',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-4': 'GPT-4',
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'gemini-pro': 'Gemini Pro'
  };
  if (modelMappings[modelName]) {
    return modelMappings[modelName];
  }
  return modelName.replace(/-/g, ' ').split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
function isBotMentioned(messageText, botShipName) {
  if (!messageText || !botShipName) {
    return false;
  }
  const normalizedBotShip = normalizeShip(botShipName);
  const escapedShip = normalizedBotShip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentionPattern = new RegExp(`(^|\\s)${escapedShip}(?=\\s|$)`, 'i');
  return mentionPattern.test(messageText);
}
function isDmAllowed(senderShip, allowlist) {
  if (!allowlist || allowlist.length === 0) {
    return true;
  }
  const normalizedSender = normalizeShip(senderShip);
  return allowlist.map((ship) => normalizeShip(ship)).some((ship) => ship === normalizedSender);
}
function extractMessageText(content) {
  if (!content || !Array.isArray(content)) {
    return '';
  }
  return content.map((block) => {
    if (block.inline && Array.isArray(block.inline)) {
      return block.inline.map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object') {
          if (item.ship) {
            return item.ship;
          }
          if (item.break !== void 0) {
            return '\n';
          }
          if (item.link && item.link.href) {
            return item.link.href;
          }
        }
        return '';
      }).join('');
    }
    return '';
  }).join('\n').trim();
}
function isSummarizationRequest(messageText) {
  const patterns = [
    /summarize\s+(this\s+)?(channel|chat|conversation)/i,
    /what\s+did\s+i\s+miss/i,
    /catch\s+me\s+up/i,
    /channel\s+summary/i,
    /tldr/i
  ];
  return patterns.some((pattern) => pattern.test(messageText));
}
function formatChangesDate(daysAgo = 5) {
  const now = /* @__PURE__ */ new Date();
  const targetDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1e3);
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;
  const day = targetDate.getDate();
  return `~${year}.${month}.${day}..20.19.51..9b9d`;
}
export {
  extractMessageText,
  formatChangesDate,
  formatModelName,
  isBotMentioned,
  isDmAllowed,
  isSummarizationRequest
};
