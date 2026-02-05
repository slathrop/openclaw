const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { API_CONSTANTS } from 'grammy';
function resolveTelegramAllowedUpdates() {
  const updates = [...API_CONSTANTS.DEFAULT_UPDATE_TYPES];
  if (!updates.includes('message_reaction')) {
    updates.push('message_reaction');
  }
  return updates;
}
__name(resolveTelegramAllowedUpdates, 'resolveTelegramAllowedUpdates');
export {
  resolveTelegramAllowedUpdates
};
