import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { feishuPlugin } from './src/channel.js';
const plugin = {
  id: 'feishu',
  name: 'Feishu',
  description: 'Feishu (Lark) channel plugin',
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    api.registerChannel({ plugin: feishuPlugin });
  }
};
const stdin_default = plugin;
export {
  stdin_default as default
};
