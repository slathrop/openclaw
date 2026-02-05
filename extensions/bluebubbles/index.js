import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { bluebubblesPlugin } from './src/channel.js';
import { handleBlueBubblesWebhookRequest } from './src/monitor.js';
import { setBlueBubblesRuntime } from './src/runtime.js';
const plugin = {
  id: 'bluebubbles',
  name: 'BlueBubbles',
  description: 'BlueBubbles channel plugin (macOS app)',
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setBlueBubblesRuntime(api.runtime);
    api.registerChannel({ plugin: bluebubblesPlugin });
    api.registerHttpHandler(handleBlueBubblesWebhookRequest);
  }
};
const stdin_default = plugin;
export {
  stdin_default as default
};
