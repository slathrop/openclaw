function resolveMSTeamsCredentials(cfg) {
  const appId = cfg?.appId?.trim() || process.env.MSTEAMS_APP_ID?.trim();
  const appPassword = cfg?.appPassword?.trim() || process.env.MSTEAMS_APP_PASSWORD?.trim();
  const tenantId = cfg?.tenantId?.trim() || process.env.MSTEAMS_TENANT_ID?.trim();
  if (!appId || !appPassword || !tenantId) {
    return void 0;
  }
  return { appId, appPassword, tenantId };
}
export {
  resolveMSTeamsCredentials
};
