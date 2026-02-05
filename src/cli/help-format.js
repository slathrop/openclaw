const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { theme } from '../terminal/theme.js';
function formatHelpExample(command, description) {
  return `  ${theme.command(command)}
    ${theme.muted(description)}`;
}
__name(formatHelpExample, 'formatHelpExample');
function formatHelpExampleLine(command, description) {
  if (!description) {
    return `  ${theme.command(command)}`;
  }
  return `  ${theme.command(command)} ${theme.muted(`# ${description}`)}`;
}
__name(formatHelpExampleLine, 'formatHelpExampleLine');
function formatHelpExamples(examples, inline = false) {
  const formatter = inline ? formatHelpExampleLine : formatHelpExample;
  return examples.map(([command, description]) => formatter(command, description)).join('\n');
}
__name(formatHelpExamples, 'formatHelpExamples');
function formatHelpExampleGroup(label, examples, inline = false) {
  return `${theme.muted(label)}
${formatHelpExamples(examples, inline)}`;
}
__name(formatHelpExampleGroup, 'formatHelpExampleGroup');
export {
  formatHelpExample,
  formatHelpExampleGroup,
  formatHelpExampleLine,
  formatHelpExamples
};
