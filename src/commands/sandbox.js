const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { confirm as clackConfirm } from '@clack/prompts';
import {
  listSandboxBrowsers,
  listSandboxContainers,
  removeSandboxBrowserContainer,
  removeSandboxContainer
} from '../agents/sandbox.js';
import {
  displayBrowsers,
  displayContainers,
  displayRecreatePreview,
  displayRecreateResult,
  displaySummary
} from './sandbox-display.js';
async function sandboxListCommand(opts, runtime) {
  const containers = opts.browser ? [] : await listSandboxContainers().catch(() => []);
  const browsers = opts.browser ? await listSandboxBrowsers().catch(() => []) : [];
  if (opts.json) {
    runtime.log(JSON.stringify({ containers, browsers }, null, 2));
    return;
  }
  if (opts.browser) {
    displayBrowsers(browsers, runtime);
  } else {
    displayContainers(containers, runtime);
  }
  displaySummary(containers, browsers, runtime);
}
__name(sandboxListCommand, 'sandboxListCommand');
async function sandboxRecreateCommand(opts, runtime) {
  if (!validateRecreateOptions(opts, runtime)) {
    return;
  }
  const filtered = await fetchAndFilterContainers(opts);
  if (filtered.containers.length + filtered.browsers.length === 0) {
    runtime.log('No containers found matching the criteria.');
    return;
  }
  displayRecreatePreview(filtered.containers, filtered.browsers, runtime);
  if (!opts.force && !await confirmRecreate()) {
    runtime.log('Cancelled.');
    return;
  }
  const result = await removeContainers(filtered, runtime);
  displayRecreateResult(result, runtime);
  if (result.failCount > 0) {
    runtime.exit(1);
  }
}
__name(sandboxRecreateCommand, 'sandboxRecreateCommand');
function validateRecreateOptions(opts, runtime) {
  if (!opts.all && !opts.session && !opts.agent) {
    runtime.error('Please specify --all, --session <key>, or --agent <id>');
    runtime.exit(1);
    return false;
  }
  const exclusiveCount = [opts.all, opts.session, opts.agent].filter(Boolean).length;
  if (exclusiveCount > 1) {
    runtime.error('Please specify only one of: --all, --session, --agent');
    runtime.exit(1);
    return false;
  }
  return true;
}
__name(validateRecreateOptions, 'validateRecreateOptions');
async function fetchAndFilterContainers(opts) {
  const allContainers = await listSandboxContainers().catch(() => []);
  const allBrowsers = await listSandboxBrowsers().catch(() => []);
  let containers = opts.browser ? [] : allContainers;
  let browsers = opts.browser ? allBrowsers : [];
  if (opts.session) {
    containers = containers.filter((c) => c.sessionKey === opts.session);
    browsers = browsers.filter((b) => b.sessionKey === opts.session);
  } else if (opts.agent) {
    const matchesAgent = createAgentMatcher(opts.agent);
    containers = containers.filter(matchesAgent);
    browsers = browsers.filter(matchesAgent);
  }
  return { containers, browsers };
}
__name(fetchAndFilterContainers, 'fetchAndFilterContainers');
function createAgentMatcher(agentId) {
  const agentPrefix = `agent:${agentId}`;
  return (item) => item.sessionKey === agentPrefix || item.sessionKey.startsWith(`${agentPrefix}:`);
}
__name(createAgentMatcher, 'createAgentMatcher');
async function confirmRecreate() {
  const result = await clackConfirm({
    message: 'This will stop and remove these containers. Continue?',
    initialValue: false
  });
  return result !== false && result !== /* @__PURE__ */ Symbol.for('clack:cancel');
}
__name(confirmRecreate, 'confirmRecreate');
async function removeContainers(filtered, runtime) {
  runtime.log('\nRemoving containers...\n');
  let successCount = 0;
  let failCount = 0;
  for (const container of filtered.containers) {
    const result = await removeContainer(container.containerName, removeSandboxContainer, runtime);
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  for (const browser of filtered.browsers) {
    const result = await removeContainer(
      browser.containerName,
      removeSandboxBrowserContainer,
      runtime
    );
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  return { successCount, failCount };
}
__name(removeContainers, 'removeContainers');
async function removeContainer(containerName, removeFn, runtime) {
  try {
    await removeFn(containerName);
    runtime.log(`\u2713 Removed ${containerName}`);
    return { success: true };
  } catch (err) {
    runtime.error(`\u2717 Failed to remove ${containerName}: ${String(err)}`);
    return { success: false };
  }
}
__name(removeContainer, 'removeContainer');
export {
  sandboxListCommand,
  sandboxRecreateCommand
};
