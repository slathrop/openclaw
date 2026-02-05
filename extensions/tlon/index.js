import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { tlonPlugin } from './src/channel.js';
import { setTlonRuntime } from './src/runtime.js';
const plugin = {
  id: 'tlon',
  name: 'Tlon',
  description: 'Tlon/Urbit channel plugin',
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setTlonRuntime(api.runtime);
    api.registerChannel({ plugin: tlonPlugin });
  }
};
const stdin_default = plugin;
export {
  stdin_default as default
};
