import { getPairingAdapter } from '../channels/plugins/pairing.js';
function resolvePairingIdLabel(channel) {
  return getPairingAdapter(channel)?.idLabel ?? 'userId';
}
export {
  resolvePairingIdLabel
};
