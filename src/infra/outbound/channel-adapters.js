/**
 * Channel-specific message adapter configuration.
 * Provides per-channel capabilities like embed support for cross-context markers.
 * @module
 */

const DEFAULT_ADAPTER = {
  supportsEmbeds: false
};
const DISCORD_ADAPTER = {
  supportsEmbeds: true,
  buildCrossContextEmbeds: (originLabel) => [
    {
      description: `From ${originLabel}`
    }
  ]
};
function getChannelMessageAdapter(channel) {
  if (channel === 'discord') {
    return DISCORD_ADAPTER;
  }
  return DEFAULT_ADAPTER;
}
export {
  getChannelMessageAdapter
};
