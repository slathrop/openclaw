import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { matrixPlugin } from './src/channel.js';
import { setMatrixRuntime } from './src/runtime.js';
const plugin = {
  id: 'matrix',
  name: 'Matrix',
  description: 'Matrix channel plugin (matrix-js-sdk)',
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setMatrixRuntime(api.runtime);
    api.registerChannel({ plugin: matrixPlugin });
  }
};
const stdin_default = plugin;
export {
  stdin_default as default
};
