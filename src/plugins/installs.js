/** @module plugins/installs - Plugin installation tracking and management. */

function recordPluginInstall(cfg, update) {
  const { pluginId, ...record } = update;
  const installs = {
    ...cfg.plugins?.installs,
    [pluginId]: {
      ...cfg.plugins?.installs?.[pluginId],
      ...record,
      installedAt: record.installedAt ?? (/* @__PURE__ */ new Date()).toISOString()
    }
  };
  return {
    ...cfg,
    plugins: {
      ...cfg.plugins,
      installs: {
        ...installs,
        [pluginId]: installs[pluginId]
      }
    }
  };
}
export {
  recordPluginInstall
};
