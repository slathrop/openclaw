const isRecord = (value) => Boolean(value && typeof value === 'object');
const asString = (value) => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : void 0;
function readZaloAccountStatus(value) {
  if (!isRecord(value)) {
    return null;
  }
  return {
    accountId: value.accountId,
    enabled: value.enabled,
    configured: value.configured,
    dmPolicy: value.dmPolicy
  };
}
function collectZaloStatusIssues(accounts) {
  const issues = [];
  for (const entry of accounts) {
    const account = readZaloAccountStatus(entry);
    if (!account) {
      continue;
    }
    const accountId = asString(account.accountId) ?? 'default';
    const enabled = account.enabled !== false;
    const configured = account.configured === true;
    if (!enabled || !configured) {
      continue;
    }
    if (account.dmPolicy === 'open') {
      issues.push({
        channel: 'zalo',
        accountId,
        kind: 'config',
        message: 'Zalo dmPolicy is "open", allowing any user to message the bot without pairing.',
        fix: 'Set channels.zalo.dmPolicy to "pairing" or "allowlist" to restrict access.'
      });
    }
  }
  return issues;
}
export {
  collectZaloStatusIssues
};
