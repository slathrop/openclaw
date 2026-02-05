const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { collectOption } from '../helpers.js';
function registerMessagePollCommand(message, helpers) {
  helpers.withMessageBase(
    helpers.withRequiredMessageTarget(message.command('poll').description('Send a poll'))
  ).requiredOption('--poll-question <text>', 'Poll question').option(
    '--poll-option <choice>',
    'Poll option (repeat 2-12 times)',
    collectOption,
    []
  ).option('--poll-multi', 'Allow multiple selections', false).option('--poll-duration-hours <n>', 'Poll duration (Discord)').option('-m, --message <text>', 'Optional message body').action(async (opts) => {
    await helpers.runMessageAction('poll', opts);
  });
}
__name(registerMessagePollCommand, 'registerMessagePollCommand');
export {
  registerMessagePollCommand
};
