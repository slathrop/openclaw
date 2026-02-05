const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { collectOption } from '../helpers.js';
function registerMessagePermissionsCommand(message, helpers) {
  helpers.withMessageBase(
    helpers.withRequiredMessageTarget(
      message.command('permissions').description('Fetch channel permissions')
    )
  ).action(async (opts) => {
    await helpers.runMessageAction('permissions', opts);
  });
}
__name(registerMessagePermissionsCommand, 'registerMessagePermissionsCommand');
function registerMessageSearchCommand(message, helpers) {
  helpers.withMessageBase(message.command('search').description('Search Discord messages')).requiredOption('--guild-id <id>', 'Guild id').requiredOption('--query <text>', 'Search query').option('--channel-id <id>', 'Channel id').option('--channel-ids <id>', 'Channel id (repeat)', collectOption, []).option('--author-id <id>', 'Author id').option('--author-ids <id>', 'Author id (repeat)', collectOption, []).option('--limit <n>', 'Result limit').action(async (opts) => {
    await helpers.runMessageAction('search', opts);
  });
}
__name(registerMessageSearchCommand, 'registerMessageSearchCommand');
export {
  registerMessagePermissionsCommand,
  registerMessageSearchCommand
};
