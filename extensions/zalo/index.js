import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { zaloDock, zaloPlugin } from './src/channel.js';
import { handleZaloWebhookRequest } from './src/monitor.js';
import { setZaloRuntime } from './src/runtime.js';
const plugin = {
  id: 'zalo',
  name: 'Zalo',
  description: 'Zalo channel plugin (Bot API)',
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setZaloRuntime(api.runtime);
    api.registerChannel({ plugin: zaloPlugin, dock: zaloDock });
    api.registerHttpHandler(handleZaloWebhookRequest);
  }
};
const stdin_default = plugin;
export {
  stdin_default as default
};
