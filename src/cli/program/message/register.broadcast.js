const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { CHANNEL_TARGETS_DESCRIPTION } from '../../../infra/outbound/channel-target.js';
function registerMessageBroadcastCommand(message, helpers) {
  helpers.withMessageBase(
    message.command('broadcast').description('Broadcast a message to multiple targets')
  ).requiredOption('--targets <target...>', CHANNEL_TARGETS_DESCRIPTION).option('--message <text>', 'Message to send').option('--media <url>', 'Media URL').action(async (options) => {
    await helpers.runMessageAction('broadcast', options);
  });
}
__name(registerMessageBroadcastCommand, 'registerMessageBroadcastCommand');
export {
  registerMessageBroadcastCommand
};
