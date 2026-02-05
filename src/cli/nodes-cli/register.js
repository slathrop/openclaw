const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { formatDocsLink } from '../../terminal/links.js';
import { theme } from '../../terminal/theme.js';
import { registerNodesCameraCommands } from './register.camera.js';
import { registerNodesCanvasCommands } from './register.canvas.js';
import { registerNodesInvokeCommands } from './register.invoke.js';
import { registerNodesLocationCommands } from './register.location.js';
import { registerNodesNotifyCommand } from './register.notify.js';
import { registerNodesPairingCommands } from './register.pairing.js';
import { registerNodesScreenCommands } from './register.screen.js';
import { registerNodesStatusCommands } from './register.status.js';
function registerNodesCli(program) {
  const nodes = program.command('nodes').description('Manage gateway-owned node pairing').addHelpText(
    'after',
    () => `
${theme.muted('Docs:')} ${formatDocsLink('/cli/nodes', 'docs.openclaw.ai/cli/nodes')}
`
  );
  registerNodesStatusCommands(nodes);
  registerNodesPairingCommands(nodes);
  registerNodesInvokeCommands(nodes);
  registerNodesNotifyCommand(nodes);
  registerNodesCanvasCommands(nodes);
  registerNodesCameraCommands(nodes);
  registerNodesScreenCommands(nodes);
  registerNodesLocationCommands(nodes);
}
__name(registerNodesCli, 'registerNodesCli');
export {
  registerNodesCli
};
