/**
 * @module pi-settings
 * Pi agent session settings and compaction configuration.
 */
const DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR = 2e4;
function ensurePiCompactionReserveTokens(params) {
  const minReserveTokens = params.minReserveTokens ?? DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR;
  const current = params.settingsManager.getCompactionReserveTokens();
  if (current >= minReserveTokens) {
    return { didOverride: false, reserveTokens: current };
  }
  params.settingsManager.applyOverrides({
    compaction: { reserveTokens: minReserveTokens }
  });
  return { didOverride: true, reserveTokens: minReserveTokens };
}
function resolveCompactionReserveTokensFloor(cfg) {
  const raw = cfg?.agents?.defaults?.compaction?.reserveTokensFloor;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Math.floor(raw);
  }
  return DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR;
}
export {
  DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR,
  ensurePiCompactionReserveTokens,
  resolveCompactionReserveTokensFloor
};
