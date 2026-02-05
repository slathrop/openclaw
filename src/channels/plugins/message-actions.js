import { getChannelPlugin, listChannelPlugins } from './index.js';
function listChannelMessageActions(cfg) {
  const actions = /* @__PURE__ */ new Set(['send', 'broadcast']);
  for (const plugin of listChannelPlugins()) {
    const list = plugin.actions?.listActions?.({ cfg });
    if (!list) {
      continue;
    }
    for (const action of list) {
      actions.add(action);
    }
  }
  return Array.from(actions);
}
function supportsChannelMessageButtons(cfg) {
  for (const plugin of listChannelPlugins()) {
    if (plugin.actions?.supportsButtons?.({ cfg })) {
      return true;
    }
  }
  return false;
}
function supportsChannelMessageCards(cfg) {
  for (const plugin of listChannelPlugins()) {
    if (plugin.actions?.supportsCards?.({ cfg })) {
      return true;
    }
  }
  return false;
}
async function dispatchChannelMessageAction(ctx) {
  const plugin = getChannelPlugin(ctx.channel);
  if (!plugin?.actions?.handleAction) {
    return null;
  }
  if (plugin.actions.supportsAction && !plugin.actions.supportsAction({ action: ctx.action })) {
    return null;
  }
  return await plugin.actions.handleAction(ctx);
}
export {
  dispatchChannelMessageAction,
  listChannelMessageActions,
  supportsChannelMessageButtons,
  supportsChannelMessageCards
};
