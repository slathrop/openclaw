const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { defaultRuntime } from '../runtime.js';
import { runConfigureWizard } from './configure.wizard.js';
async function configureCommand(runtime = defaultRuntime) {
  await runConfigureWizard({ command: 'configure' }, runtime);
}
__name(configureCommand, 'configureCommand');
async function configureCommandWithSections(sections, runtime = defaultRuntime) {
  await runConfigureWizard({ command: 'configure', sections }, runtime);
}
__name(configureCommandWithSections, 'configureCommandWithSections');
export {
  configureCommand,
  configureCommandWithSections
};
