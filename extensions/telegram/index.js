import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { telegramPlugin } from './src/channel.js';
import { setTelegramRuntime } from './src/runtime.js';
const plugin = {
  id: 'telegram',
  name: 'Telegram',
  description: 'Telegram channel plugin',
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setTelegramRuntime(api.runtime);
    api.registerChannel({ plugin: telegramPlugin });
  }
};
const stdin_default = plugin;
export {
  stdin_default as default
};
