const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { parseTimeoutMs } from './parse-timeout.js';
function parseEnvPairs(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return void 0;
  }
  const env = {};
  for (const pair of pairs) {
    if (typeof pair !== 'string') {
      continue;
    }
    const idx = pair.indexOf('=');
    if (idx <= 0) {
      continue;
    }
    const key = pair.slice(0, idx).trim();
    if (!key) {
      continue;
    }
    env[key] = pair.slice(idx + 1);
  }
  return Object.keys(env).length > 0 ? env : void 0;
}
__name(parseEnvPairs, 'parseEnvPairs');
export {
  parseEnvPairs,
  parseTimeoutMs
};
