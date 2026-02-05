const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
function normalizeSlackSlashCommandName(raw) {
  return raw.replace(/^\/+/, '');
}
__name(normalizeSlackSlashCommandName, 'normalizeSlackSlashCommandName');
function resolveSlackSlashCommandConfig(raw) {
  const normalizedName = normalizeSlackSlashCommandName(raw?.name?.trim() || 'openclaw');
  const name = normalizedName || 'openclaw';
  return {
    enabled: raw?.enabled === true,
    name,
    sessionPrefix: raw?.sessionPrefix?.trim() || 'slack:slash',
    ephemeral: raw?.ephemeral !== false
  };
}
__name(resolveSlackSlashCommandConfig, 'resolveSlackSlashCommandConfig');
function buildSlackSlashCommandMatcher(name) {
  const normalized = normalizeSlackSlashCommandName(name);
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^/?${escaped}$`);
}
__name(buildSlackSlashCommandMatcher, 'buildSlackSlashCommandMatcher');
export {
  buildSlackSlashCommandMatcher,
  normalizeSlackSlashCommandName,
  resolveSlackSlashCommandConfig
};
