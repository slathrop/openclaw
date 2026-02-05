const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { messageCommand } from '../../../commands/message.js';
import { danger, setVerbose } from '../../../globals.js';
import { CHANNEL_TARGET_DESCRIPTION } from '../../../infra/outbound/channel-target.js';
import { defaultRuntime } from '../../../runtime.js';
import { runCommandWithRuntime } from '../../cli-utils.js';
import { createDefaultDeps } from '../../deps.js';
import { ensurePluginRegistryLoaded } from '../../plugin-registry.js';
function createMessageCliHelpers(message, messageChannelOptions) {
  const withMessageBase = /* @__PURE__ */ __name((command) => command.option('--channel <channel>', `Channel: ${messageChannelOptions}`).option('--account <id>', 'Channel account id (accountId)').option('--json', 'Output result as JSON', false).option('--dry-run', 'Print payload and skip sending', false).option('--verbose', 'Verbose logging', false), 'withMessageBase');
  const withMessageTarget = /* @__PURE__ */ __name((command) => command.option('-t, --target <dest>', CHANNEL_TARGET_DESCRIPTION), 'withMessageTarget');
  const withRequiredMessageTarget = /* @__PURE__ */ __name((command) => command.requiredOption('-t, --target <dest>', CHANNEL_TARGET_DESCRIPTION), 'withRequiredMessageTarget');
  const runMessageAction = /* @__PURE__ */ __name(async (action, opts) => {
    setVerbose(Boolean(opts.verbose));
    ensurePluginRegistryLoaded();
    const deps = createDefaultDeps();
    await runCommandWithRuntime(
      defaultRuntime,
      async () => {
        await messageCommand(
          {
            ...(() => {
              const { account, ...rest } = opts;
              return {
                ...rest,
                accountId: typeof account === 'string' ? account : void 0
              };
            })(),
            action
          },
          deps,
          defaultRuntime
        );
      },
      (err) => {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    );
  }, 'runMessageAction');
  void message;
  return {
    withMessageBase,
    withMessageTarget,
    withRequiredMessageTarget,
    runMessageAction
  };
}
__name(createMessageCliHelpers, 'createMessageCliHelpers');
export {
  createMessageCliHelpers
};
