const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { listChannelPlugins } from '../../channels/plugins/index.js';
const CHANNEL_ONBOARDING_ADAPTERS = /* @__PURE__ */ __name(() => new Map(
  listChannelPlugins().map((plugin) => plugin.onboarding ? [plugin.id, plugin.onboarding] : null).filter(
    (entry) => Boolean(entry)
  )
), 'CHANNEL_ONBOARDING_ADAPTERS');
function getChannelOnboardingAdapter(channel) {
  return CHANNEL_ONBOARDING_ADAPTERS().get(channel);
}
__name(getChannelOnboardingAdapter, 'getChannelOnboardingAdapter');
function listChannelOnboardingAdapters() {
  return Array.from(CHANNEL_ONBOARDING_ADAPTERS().values());
}
__name(listChannelOnboardingAdapters, 'listChannelOnboardingAdapters');
const getProviderOnboardingAdapter = getChannelOnboardingAdapter;
const listProviderOnboardingAdapters = listChannelOnboardingAdapters;
export {
  getChannelOnboardingAdapter,
  getProviderOnboardingAdapter,
  listChannelOnboardingAdapters,
  listProviderOnboardingAdapters
};
