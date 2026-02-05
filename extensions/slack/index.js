import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { slackPlugin } from './src/channel.js';
import { setSlackRuntime } from './src/runtime.js';
const plugin = {
  id: 'slack',
  name: 'Slack',
  description: 'Slack channel plugin',
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setSlackRuntime(api.runtime);
    api.registerChannel({ plugin: slackPlugin });
  }
};
const stdin_default = plugin;
export {
  stdin_default as default
};
