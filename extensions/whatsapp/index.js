import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { whatsappPlugin } from './src/channel.js';
import { setWhatsAppRuntime } from './src/runtime.js';
const plugin = {
  id: 'whatsapp',
  name: 'WhatsApp',
  description: 'WhatsApp channel plugin',
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setWhatsAppRuntime(api.runtime);
    api.registerChannel({ plugin: whatsappPlugin });
  }
};
const stdin_default = plugin;
export {
  stdin_default as default
};
