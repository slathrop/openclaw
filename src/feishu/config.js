import { firstDefined } from './access.js';
function resolveFeishuConfig(params) {
  const { cfg, accountId } = params;
  const feishuCfg = cfg.channels?.feishu;
  const accountCfg = accountId ? feishuCfg?.accounts?.[accountId] : void 0;
  const defaults = cfg.channels?.defaults;
  return {
    enabled: firstDefined(accountCfg?.enabled, feishuCfg?.enabled, true) ?? true,
    dmPolicy: firstDefined(accountCfg?.dmPolicy, feishuCfg?.dmPolicy) ?? 'pairing',
    groupPolicy: firstDefined(accountCfg?.groupPolicy, feishuCfg?.groupPolicy, defaults?.groupPolicy) ?? 'open',
    allowFrom: (accountCfg?.allowFrom ?? feishuCfg?.allowFrom ?? []).map(String),
    groupAllowFrom: (accountCfg?.groupAllowFrom ?? feishuCfg?.groupAllowFrom ?? []).map(String),
    historyLimit: firstDefined(accountCfg?.historyLimit, feishuCfg?.historyLimit) ?? 10,
    dmHistoryLimit: firstDefined(accountCfg?.dmHistoryLimit, feishuCfg?.dmHistoryLimit) ?? 20,
    textChunkLimit: firstDefined(accountCfg?.textChunkLimit, feishuCfg?.textChunkLimit) ?? 2e3,
    chunkMode: firstDefined(accountCfg?.chunkMode, feishuCfg?.chunkMode) ?? 'length',
    blockStreaming: firstDefined(accountCfg?.blockStreaming, feishuCfg?.blockStreaming) ?? true,
    streaming: firstDefined(accountCfg?.streaming, feishuCfg?.streaming) ?? true,
    mediaMaxMb: firstDefined(accountCfg?.mediaMaxMb, feishuCfg?.mediaMaxMb) ?? 30,
    groups: { ...feishuCfg?.groups, ...accountCfg?.groups }
  };
}
function resolveFeishuGroupConfig(params) {
  const resolved = resolveFeishuConfig({ cfg: params.cfg, accountId: params.accountId });
  const groupConfig = resolved.groups[params.chatId];
  return { groupConfig };
}
function resolveFeishuGroupRequireMention(params) {
  const { groupConfig } = resolveFeishuGroupConfig(params);
  return groupConfig?.requireMention ?? true;
}
function resolveFeishuGroupEnabled(params) {
  const { groupConfig } = resolveFeishuGroupConfig(params);
  return groupConfig?.enabled ?? true;
}
export {
  resolveFeishuConfig,
  resolveFeishuGroupConfig,
  resolveFeishuGroupEnabled,
  resolveFeishuGroupRequireMention
};
