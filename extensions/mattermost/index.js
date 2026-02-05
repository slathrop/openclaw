import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { mattermostPlugin } from './src/channel.js';
import { setMattermostRuntime } from './src/runtime.js';
const plugin = {
  id: 'mattermost',
  name: 'Mattermost',
  description: 'Mattermost channel plugin',
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setMattermostRuntime(api.runtime);
    api.registerChannel({ plugin: mattermostPlugin });
  }
};
const stdin_default = plugin;
export {
  stdin_default as default
};
