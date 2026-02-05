import {
  addChannelAllowFromStoreEntry,
  approveChannelPairingCode,
  listChannelPairingRequests,
  readChannelAllowFromStore,
  upsertChannelPairingRequest
} from '../pairing/pairing-store.js';
const PROVIDER = 'feishu';
async function readFeishuAllowFromStore(env = process.env) {
  return readChannelAllowFromStore(PROVIDER, env);
}
async function addFeishuAllowFromStoreEntry(params) {
  return addChannelAllowFromStoreEntry({
    channel: PROVIDER,
    entry: params.entry,
    env: params.env
  });
}
async function listFeishuPairingRequests(env = process.env) {
  const list = await listChannelPairingRequests(PROVIDER, env);
  return list.map((r) => ({
    openId: r.id,
    code: r.code,
    createdAt: r.createdAt,
    lastSeenAt: r.lastSeenAt,
    unionId: r.meta?.unionId,
    name: r.meta?.name
  }));
}
async function upsertFeishuPairingRequest(params) {
  return upsertChannelPairingRequest({
    channel: PROVIDER,
    id: params.openId,
    env: params.env,
    meta: {
      unionId: params.unionId,
      name: params.name
    }
  });
}
async function approveFeishuPairingCode(params) {
  const res = await approveChannelPairingCode({
    channel: PROVIDER,
    code: params.code,
    env: params.env
  });
  if (!res) {
    return null;
  }
  const entry = res.entry ? {
    openId: res.entry.id,
    code: res.entry.code,
    createdAt: res.entry.createdAt,
    lastSeenAt: res.entry.lastSeenAt,
    unionId: res.entry.meta?.unionId,
    name: res.entry.meta?.name
  } : void 0;
  return { openId: res.id, entry };
}
async function resolveFeishuEffectiveAllowFrom(params) {
  const env = params.env ?? process.env;
  const feishuCfg = params.cfg.channels?.feishu;
  const accountCfg = params.accountId ? feishuCfg?.accounts?.[params.accountId] : void 0;
  const allowFrom = accountCfg?.allowFrom ?? feishuCfg?.allowFrom ?? [];
  const groupAllowFrom = accountCfg?.groupAllowFrom ?? feishuCfg?.groupAllowFrom ?? [];
  const cfgAllowFrom = allowFrom.map((v) => String(v).trim()).filter(Boolean).map((v) => v.replace(/^feishu:/i, '')).filter((v) => v !== '*');
  const cfgGroupAllowFrom = groupAllowFrom.map((v) => String(v).trim()).filter(Boolean).map((v) => v.replace(/^feishu:/i, '')).filter((v) => v !== '*');
  const storeAllowFrom = await readFeishuAllowFromStore(env);
  const dm = Array.from(/* @__PURE__ */ new Set([...cfgAllowFrom, ...storeAllowFrom]));
  const group = Array.from(
    /* @__PURE__ */ new Set([
      ...cfgGroupAllowFrom.length > 0 ? cfgGroupAllowFrom : cfgAllowFrom,
      ...storeAllowFrom
    ])
  );
  return { dm, group };
}
export {
  addFeishuAllowFromStoreEntry,
  approveFeishuPairingCode,
  listFeishuPairingRequests,
  readFeishuAllowFromStore,
  resolveFeishuEffectiveAllowFrom,
  upsertFeishuPairingRequest
};
