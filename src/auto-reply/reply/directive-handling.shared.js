import { formatCliCommand } from '../../cli/command-format.js';
const SYSTEM_MARK = '\u2699\uFE0F';
const formatDirectiveAck = (text) => {
  if (!text) {
    return text;
  }
  if (text.startsWith(SYSTEM_MARK)) {
    return text;
  }
  return `${SYSTEM_MARK} ${text}`;
};
const formatOptionsLine = (options) => `Options: ${options}.`;
const withOptions = (line, options) => `${line}
${formatOptionsLine(options)}`;
const formatElevatedRuntimeHint = () => `${SYSTEM_MARK} Runtime is direct; sandboxing does not apply.`;
const formatElevatedEvent = (level) => {
  if (level === 'full') {
    return 'Elevated FULL \u2014 exec runs on host with auto-approval.';
  }
  if (level === 'ask' || level === 'on') {
    return 'Elevated ASK \u2014 exec runs on host; approvals may still apply.';
  }
  return 'Elevated OFF \u2014 exec stays in sandbox.';
};
const formatReasoningEvent = (level) => {
  if (level === 'stream') {
    return 'Reasoning STREAM \u2014 emit live <think>.';
  }
  if (level === 'on') {
    return 'Reasoning ON \u2014 include <think>.';
  }
  return 'Reasoning OFF \u2014 hide <think>.';
};
function formatElevatedUnavailableText(params) {
  const lines = [];
  lines.push(
    `elevated is not available right now (runtime=${params.runtimeSandboxed ? 'sandboxed' : 'direct'}).`
  );
  const failures = params.failures ?? [];
  if (failures.length > 0) {
    lines.push(`Failing gates: ${failures.map((f) => `${f.gate} (${f.key})`).join(', ')}`);
  } else {
    lines.push(
      'Fix-it keys: tools.elevated.enabled, tools.elevated.allowFrom.<provider>, agents.list[].tools.elevated.*'
    );
  }
  if (params.sessionKey) {
    lines.push(
      `See: ${formatCliCommand(`openclaw sandbox explain --session ${params.sessionKey}`)}`
    );
  }
  return lines.join('\n');
}
export {
  SYSTEM_MARK,
  formatDirectiveAck,
  formatElevatedEvent,
  formatElevatedRuntimeHint,
  formatElevatedUnavailableText,
  formatOptionsLine,
  formatReasoningEvent,
  withOptions
};
