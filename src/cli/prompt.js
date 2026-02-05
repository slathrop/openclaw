const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { stdin as input, stdout as output } from 'node:process';
import readline from 'node:readline/promises';
import { isVerbose, isYes } from '../globals.js';
async function promptYesNo(question, defaultYes = false) {
  if (isVerbose() && isYes()) {
    return true;
  }
  if (isYes()) {
    return true;
  }
  const rl = readline.createInterface({ input, output });
  const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
  const answer = (await rl.question(`${question}${suffix}`)).trim().toLowerCase();
  rl.close();
  if (!answer) {
    return defaultYes;
  }
  return answer.startsWith('y');
}
__name(promptYesNo, 'promptYesNo');
export {
  promptYesNo
};
