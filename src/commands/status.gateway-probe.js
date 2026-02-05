const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
function resolveGatewayProbeAuth(cfg) {
  const isRemoteMode = cfg.gateway?.mode === 'remote';
  const remote = isRemoteMode ? cfg.gateway?.remote : void 0;
  const authToken = cfg.gateway?.auth?.token;
  const authPassword = cfg.gateway?.auth?.password;
  const token = isRemoteMode ? typeof remote?.token === 'string' && remote.token.trim().length > 0 ? remote.token.trim() : void 0 : process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || (typeof authToken === 'string' && authToken.trim().length > 0 ? authToken.trim() : void 0);
  const password = process.env.OPENCLAW_GATEWAY_PASSWORD?.trim() || (isRemoteMode ? typeof remote?.password === 'string' && remote.password.trim().length > 0 ? remote.password.trim() : void 0 : typeof authPassword === 'string' && authPassword.trim().length > 0 ? authPassword.trim() : void 0);
  return { token, password };
}
__name(resolveGatewayProbeAuth, 'resolveGatewayProbeAuth');
function pickGatewaySelfPresence(presence) {
  if (!Array.isArray(presence)) {
    return null;
  }
  const entries = presence;
  const self = entries.find((e) => e.mode === 'gateway' && e.reason === 'self') ?? null;
  if (!self) {
    return null;
  }
  return {
    host: typeof self.host === 'string' ? self.host : void 0,
    ip: typeof self.ip === 'string' ? self.ip : void 0,
    version: typeof self.version === 'string' ? self.version : void 0,
    platform: typeof self.platform === 'string' ? self.platform : void 0
  };
}
__name(pickGatewaySelfPresence, 'pickGatewaySelfPresence');
export {
  pickGatewaySelfPresence,
  resolveGatewayProbeAuth
};
