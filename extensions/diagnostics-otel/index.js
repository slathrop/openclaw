import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { createDiagnosticsOtelService } from './src/service.js';
const plugin = {
  id: 'diagnostics-otel',
  name: 'Diagnostics OpenTelemetry',
  description: 'Export diagnostics events to OpenTelemetry',
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    api.registerService(createDiagnosticsOtelService());
  }
};
const stdin_default = plugin;
export {
  stdin_default as default
};
