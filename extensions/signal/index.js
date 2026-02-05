import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { signalPlugin } from './src/channel.js';
import { setSignalRuntime } from './src/runtime.js';
const plugin = {
  id: 'signal',
  name: 'Signal',
  description: 'Signal channel plugin',
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setSignalRuntime(api.runtime);
    api.registerChannel({ plugin: signalPlugin });
  }
};
const stdin_default = plugin;
export {
  stdin_default as default
};
