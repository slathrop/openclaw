function resolveTlonAccount(cfg, accountId) {
  const base = cfg.channels?.tlon;
  if (!base) {
    return {
      accountId: accountId || 'default',
      name: null,
      enabled: false,
      configured: false,
      ship: null,
      url: null,
      code: null,
      groupChannels: [],
      dmAllowlist: [],
      autoDiscoverChannels: null,
      showModelSignature: null
    };
  }
  const useDefault = !accountId || accountId === 'default';
  const account = useDefault ? base : base.accounts?.[accountId];
  const ship = account?.ship ?? base.ship ?? null;
  const url = account?.url ?? base.url ?? null;
  const code = account?.code ?? base.code ?? null;
  const groupChannels = account?.groupChannels ?? base.groupChannels ?? [];
  const dmAllowlist = account?.dmAllowlist ?? base.dmAllowlist ?? [];
  const autoDiscoverChannels = account?.autoDiscoverChannels ?? base.autoDiscoverChannels ?? null;
  const showModelSignature = account?.showModelSignature ?? base.showModelSignature ?? null;
  const configured = Boolean(ship && url && code);
  return {
    accountId: accountId || 'default',
    name: account?.name ?? base.name ?? null,
    enabled: (account?.enabled ?? base.enabled ?? true) !== false,
    configured,
    ship,
    url,
    code,
    groupChannels,
    dmAllowlist,
    autoDiscoverChannels,
    showModelSignature
  };
}
function listTlonAccountIds(cfg) {
  const base = cfg.channels?.tlon;
  if (!base) {
    return [];
  }
  const accounts = base.accounts ?? {};
  return [...base.ship ? ['default'] : [], ...Object.keys(accounts)];
}
export {
  listTlonAccountIds,
  resolveTlonAccount
};
