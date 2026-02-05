const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { registerBrowserElementCommands } from './register.element.js';
import { registerBrowserFilesAndDownloadsCommands } from './register.files-downloads.js';
import { registerBrowserFormWaitEvalCommands } from './register.form-wait-eval.js';
import { registerBrowserNavigationCommands } from './register.navigation.js';
function registerBrowserActionInputCommands(browser, parentOpts) {
  registerBrowserNavigationCommands(browser, parentOpts);
  registerBrowserElementCommands(browser, parentOpts);
  registerBrowserFilesAndDownloadsCommands(browser, parentOpts);
  registerBrowserFormWaitEvalCommands(browser, parentOpts);
}
__name(registerBrowserActionInputCommands, 'registerBrowserActionInputCommands');
export {
  registerBrowserActionInputCommands
};
