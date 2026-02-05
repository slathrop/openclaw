const isRecord = (value) => Boolean(value && typeof value === 'object');
const asString = (value) => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : void 0;
function readZalouserAccountStatus(value) {
  if (!isRecord(value)) {
    return null;
  }
  return {
    accountId: value.accountId,
    enabled: value.enabled,
    configured: value.configured,
    dmPolicy: value.dmPolicy,
    lastError: value.lastError
  };
}
function isMissingZca(lastError) {
  if (!lastError) {
    return false;
  }
  const lower = lastError.toLowerCase();
  return lower.includes('zca') && (lower.includes('not found') || lower.includes('enoent'));
}
function collectZalouserStatusIssues(accounts) {
  const issues = [];
  for (const entry of accounts) {
    const account = readZalouserAccountStatus(entry);
    if (!account) {
      continue;
    }
    const accountId = asString(account.accountId) ?? 'default';
    const enabled = account.enabled !== false;
    if (!enabled) {
      continue;
    }
    const configured = account.configured === true;
    const lastError = asString(account.lastError)?.trim();
    if (!configured) {
      if (isMissingZca(lastError)) {
        issues.push({
          channel: 'zalouser',
          accountId,
          kind: 'runtime',
          message: 'zca CLI not found in PATH.',
          fix: 'Install zca-cli and ensure it is on PATH for the Gateway process.'
        });
      } else {
        issues.push({
          channel: 'zalouser',
          accountId,
          kind: 'auth',
          message: 'Not authenticated (no zca session).',
          fix: 'Run: openclaw channels login --channel zalouser'
        });
      }
      continue;
    }
    if (account.dmPolicy === 'open') {
      issues.push({
        channel: 'zalouser',
        accountId,
        kind: 'config',
        message: 'Zalo Personal dmPolicy is "open", allowing any user to message the bot without pairing.',
        fix: 'Set channels.zalouser.dmPolicy to "pairing" or "allowlist" to restrict access.'
      });
    }
  }
  return issues;
}
export {
  collectZalouserStatusIssues
};
