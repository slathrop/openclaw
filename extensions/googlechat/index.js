import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { googlechatDock, googlechatPlugin } from './src/channel.js';
import { handleGoogleChatWebhookRequest } from './src/monitor.js';
import { setGoogleChatRuntime } from './src/runtime.js';
const plugin = {
  id: 'googlechat',
  name: 'Google Chat',
  description: 'OpenClaw Google Chat channel plugin',
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setGoogleChatRuntime(api.runtime);
    api.registerChannel({ plugin: googlechatPlugin, dock: googlechatDock });
    api.registerHttpHandler(handleGoogleChatWebhookRequest);
  }
};
const stdin_default = plugin;
export {
  stdin_default as default
};
