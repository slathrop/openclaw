import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { discordPlugin } from './src/channel.js';
import { setDiscordRuntime } from './src/runtime.js';
const plugin = {
  id: 'discord',
  name: 'Discord',
  description: 'Discord channel plugin',
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setDiscordRuntime(api.runtime);
    api.registerChannel({ plugin: discordPlugin });
  }
};
const stdin_default = plugin;
export {
  stdin_default as default
};
