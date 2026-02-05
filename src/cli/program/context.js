const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { VERSION } from '../../version.js';
import { resolveCliChannelOptions } from '../channel-options.js';
function createProgramContext() {
  const channelOptions = resolveCliChannelOptions();
  return {
    programVersion: VERSION,
    channelOptions,
    messageChannelOptions: channelOptions.join('|'),
    agentChannelOptions: ['last', ...channelOptions].join('|')
  };
}
__name(createProgramContext, 'createProgramContext');
export {
  createProgramContext
};
