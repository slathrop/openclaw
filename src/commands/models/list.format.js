const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { colorize, isRich as isRichTerminal, theme } from '../../terminal/theme.js';
const isRich = /* @__PURE__ */ __name((opts) => Boolean(isRichTerminal() && !opts?.json && !opts?.plain), 'isRich');
const pad = /* @__PURE__ */ __name((value, size) => value.padEnd(size), 'pad');
const formatKey = /* @__PURE__ */ __name((key, rich) => colorize(rich, theme.warn, key), 'formatKey');
const formatValue = /* @__PURE__ */ __name((value, rich) => colorize(rich, theme.info, value), 'formatValue');
const formatKeyValue = /* @__PURE__ */ __name((key, value, rich, valueColor = theme.info) => `${formatKey(key, rich)}=${colorize(rich, valueColor, value)}`, 'formatKeyValue');
const formatSeparator = /* @__PURE__ */ __name((rich) => colorize(rich, theme.muted, ' | '), 'formatSeparator');
const formatTag = /* @__PURE__ */ __name((tag, rich) => {
  if (!rich) {
    return tag;
  }
  if (tag === 'default') {
    return theme.success(tag);
  }
  if (tag === 'image') {
    return theme.accentBright(tag);
  }
  if (tag === 'configured') {
    return theme.accent(tag);
  }
  if (tag === 'missing') {
    return theme.error(tag);
  }
  if (tag.startsWith('fallback#')) {
    return theme.warn(tag);
  }
  if (tag.startsWith('img-fallback#')) {
    return theme.warn(tag);
  }
  if (tag.startsWith('alias:')) {
    return theme.accentDim(tag);
  }
  return theme.muted(tag);
}, 'formatTag');
const truncate = /* @__PURE__ */ __name((value, max) => {
  if (value.length <= max) {
    return value;
  }
  if (max <= 3) {
    return value.slice(0, max);
  }
  return `${value.slice(0, max - 3)}...`;
}, 'truncate');
const maskApiKey = /* @__PURE__ */ __name((value) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'missing';
  }
  if (trimmed.length <= 16) {
    return trimmed;
  }
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-8)}`;
}, 'maskApiKey');
export {
  formatKey,
  formatKeyValue,
  formatSeparator,
  formatTag,
  formatValue,
  isRich,
  maskApiKey,
  pad,
  truncate
};
