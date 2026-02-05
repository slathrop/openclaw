import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { imessagePlugin } from './src/channel.js';
import { setIMessageRuntime } from './src/runtime.js';
const plugin = {
  id: 'imessage',
  name: 'iMessage',
  description: 'iMessage channel plugin',
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setIMessageRuntime(api.runtime);
    api.registerChannel({ plugin: imessagePlugin });
  }
};
const stdin_default = plugin;
export {
  stdin_default as default
};
