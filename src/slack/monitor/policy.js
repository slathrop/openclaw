const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
function isSlackChannelAllowedByPolicy(params) {
  const { groupPolicy, channelAllowlistConfigured, channelAllowed } = params;
  if (groupPolicy === 'disabled') {
    return false;
  }
  if (groupPolicy === 'open') {
    return true;
  }
  if (!channelAllowlistConfigured) {
    return false;
  }
  return channelAllowed;
}
__name(isSlackChannelAllowedByPolicy, 'isSlackChannelAllowedByPolicy');
export {
  isSlackChannelAllowedByPolicy
};
