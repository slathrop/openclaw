import { loadConfig } from '../config/config.js';
import { resolveSignalAccount } from './accounts.js';
import { signalRpcRequest } from './client.js';
function normalizeSignalId(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/^signal:/i, '').trim();
}
function normalizeSignalUuid(raw) {
  const trimmed = normalizeSignalId(raw);
  if (!trimmed) {
    return '';
  }
  if (trimmed.toLowerCase().startsWith('uuid:')) {
    return trimmed.slice('uuid:'.length).trim();
  }
  return trimmed;
}
function resolveTargetAuthorParams(params) {
  const candidates = [params.targetAuthor, params.targetAuthorUuid, params.fallback];
  for (const candidate of candidates) {
    const raw = candidate?.trim();
    if (!raw) {
      continue;
    }
    const normalized = normalizeSignalUuid(raw);
    if (normalized) {
      return { targetAuthor: normalized };
    }
  }
  return {};
}
function resolveReactionRpcContext(opts, accountInfo) {
  const hasBaseUrl = Boolean(opts.baseUrl?.trim());
  const hasAccount = Boolean(opts.account?.trim());
  const resolvedAccount = accountInfo || (!hasBaseUrl || !hasAccount ? resolveSignalAccount({
    cfg: loadConfig(),
    accountId: opts.accountId
  }) : void 0);
  const baseUrl = opts.baseUrl?.trim() || resolvedAccount?.baseUrl;
  if (!baseUrl) {
    throw new Error('Signal base URL is required');
  }
  const account = opts.account?.trim() || resolvedAccount?.config.account?.trim();
  return { baseUrl, account };
}
async function sendReactionSignal(recipient, targetTimestamp, emoji, opts = {}) {
  const accountInfo = resolveSignalAccount({
    cfg: loadConfig(),
    accountId: opts.accountId
  });
  const { baseUrl, account } = resolveReactionRpcContext(opts, accountInfo);
  const normalizedRecipient = normalizeSignalUuid(recipient);
  const groupId = opts.groupId?.trim();
  if (!normalizedRecipient && !groupId) {
    throw new Error('Recipient or groupId is required for Signal reaction');
  }
  if (!Number.isFinite(targetTimestamp) || targetTimestamp <= 0) {
    throw new Error('Valid targetTimestamp is required for Signal reaction');
  }
  if (!emoji?.trim()) {
    throw new Error('Emoji is required for Signal reaction');
  }
  const targetAuthorParams = resolveTargetAuthorParams({
    targetAuthor: opts.targetAuthor,
    targetAuthorUuid: opts.targetAuthorUuid,
    fallback: normalizedRecipient
  });
  if (groupId && !targetAuthorParams.targetAuthor) {
    throw new Error('targetAuthor is required for group reactions');
  }
  const params = {
    emoji: emoji.trim(),
    targetTimestamp,
    ...targetAuthorParams
  };
  if (normalizedRecipient) {
    params.recipients = [normalizedRecipient];
  }
  if (groupId) {
    params.groupIds = [groupId];
  }
  if (account) {
    params.account = account;
  }
  const result = await signalRpcRequest('sendReaction', params, {
    baseUrl,
    timeoutMs: opts.timeoutMs
  });
  return {
    ok: true,
    timestamp: result?.timestamp
  };
}
async function removeReactionSignal(recipient, targetTimestamp, emoji, opts = {}) {
  const accountInfo = resolveSignalAccount({
    cfg: loadConfig(),
    accountId: opts.accountId
  });
  const { baseUrl, account } = resolveReactionRpcContext(opts, accountInfo);
  const normalizedRecipient = normalizeSignalUuid(recipient);
  const groupId = opts.groupId?.trim();
  if (!normalizedRecipient && !groupId) {
    throw new Error('Recipient or groupId is required for Signal reaction removal');
  }
  if (!Number.isFinite(targetTimestamp) || targetTimestamp <= 0) {
    throw new Error('Valid targetTimestamp is required for Signal reaction removal');
  }
  if (!emoji?.trim()) {
    throw new Error('Emoji is required for Signal reaction removal');
  }
  const targetAuthorParams = resolveTargetAuthorParams({
    targetAuthor: opts.targetAuthor,
    targetAuthorUuid: opts.targetAuthorUuid,
    fallback: normalizedRecipient
  });
  if (groupId && !targetAuthorParams.targetAuthor) {
    throw new Error('targetAuthor is required for group reaction removal');
  }
  const params = {
    emoji: emoji.trim(),
    targetTimestamp,
    remove: true,
    ...targetAuthorParams
  };
  if (normalizedRecipient) {
    params.recipients = [normalizedRecipient];
  }
  if (groupId) {
    params.groupIds = [groupId];
  }
  if (account) {
    params.account = account;
  }
  const result = await signalRpcRequest('sendReaction', params, {
    baseUrl,
    timeoutMs: opts.timeoutMs
  });
  return {
    ok: true,
    timestamp: result?.timestamp
  };
}
export {
  removeReactionSignal,
  sendReactionSignal
};
