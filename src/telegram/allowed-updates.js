import { API_CONSTANTS } from 'grammy';
function resolveTelegramAllowedUpdates() {
  const updates = [...API_CONSTANTS.DEFAULT_UPDATE_TYPES];
  if (!updates.includes('message_reaction')) {
    updates.push('message_reaction');
  }
  return updates;
}
export {
  resolveTelegramAllowedUpdates
};
