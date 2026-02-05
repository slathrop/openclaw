const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
function normalizeLegacyConfigValues(cfg) {
  const changes = [];
  let next = cfg;
  const legacyAckReaction = cfg.messages?.ackReaction?.trim();
  const hasWhatsAppConfig = cfg.channels?.whatsapp !== void 0;
  if (legacyAckReaction && hasWhatsAppConfig) {
    const hasWhatsAppAck = cfg.channels?.whatsapp?.ackReaction !== void 0;
    if (!hasWhatsAppAck) {
      const legacyScope = cfg.messages?.ackReactionScope ?? 'group-mentions';
      let direct = true;
      let group = 'mentions';
      if (legacyScope === 'all') {
        direct = true;
        group = 'always';
      } else if (legacyScope === 'direct') {
        direct = true;
        group = 'never';
      } else if (legacyScope === 'group-all') {
        direct = false;
        group = 'always';
      } else if (legacyScope === 'group-mentions') {
        direct = false;
        group = 'mentions';
      }
      next = {
        ...next,
        channels: {
          ...next.channels,
          whatsapp: {
            ...next.channels?.whatsapp,
            ackReaction: { emoji: legacyAckReaction, direct, group }
          }
        }
      };
      changes.push(
        `Copied messages.ackReaction \u2192 channels.whatsapp.ackReaction (scope: ${legacyScope}).`
      );
    }
  }
  return { config: next, changes };
}
__name(normalizeLegacyConfigValues, 'normalizeLegacyConfigValues');
export {
  normalizeLegacyConfigValues
};
