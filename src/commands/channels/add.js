const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from '../../agents/agent-scope.js';
import { listChannelPluginCatalogEntries } from '../../channels/plugins/catalog.js';
import { getChannelPlugin, normalizeChannelId } from '../../channels/plugins/index.js';
import { writeConfigFile } from '../../config/config.js';
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from '../../routing/session-key.js';
import { defaultRuntime } from '../../runtime.js';
import { createClackPrompter } from '../../wizard/clack-prompter.js';
import { setupChannels } from '../onboard-channels.js';
import {
  ensureOnboardingPluginInstalled,
  reloadOnboardingPluginRegistry
} from '../onboarding/plugin-install.js';
import { applyAccountName, applyChannelAccountConfig } from './add-mutators.js';
import { channelLabel, requireValidConfig, shouldUseWizard } from './shared.js';
function parseList(value) {
  if (!value?.trim()) {
    return void 0;
  }
  const parsed = value.split(/[\n,;]+/g).map((entry) => entry.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : void 0;
}
__name(parseList, 'parseList');
function resolveCatalogChannelEntry(raw, cfg) {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return void 0;
  }
  const workspaceDir = cfg ? resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg)) : void 0;
  return listChannelPluginCatalogEntries({ workspaceDir }).find((entry) => {
    if (entry.id.toLowerCase() === trimmed) {
      return true;
    }
    return (entry.meta.aliases ?? []).some((alias) => alias.trim().toLowerCase() === trimmed);
  });
}
__name(resolveCatalogChannelEntry, 'resolveCatalogChannelEntry');
async function channelsAddCommand(opts, runtime = defaultRuntime, params) {
  const cfg = await requireValidConfig(runtime);
  if (!cfg) {
    return;
  }
  let nextConfig = cfg;
  const useWizard = shouldUseWizard(params);
  if (useWizard) {
    const prompter = createClackPrompter();
    let selection = [];
    const accountIds = {};
    await prompter.intro('Channel setup');
    let nextConfig2 = await setupChannels(cfg, runtime, prompter, {
      allowDisable: false,
      allowSignalInstall: true,
      promptAccountIds: true,
      onSelection: /* @__PURE__ */ __name((value) => {
        selection = value;
      }, 'onSelection'),
      onAccountId: /* @__PURE__ */ __name((channel2, accountId2) => {
        accountIds[channel2] = accountId2;
      }, 'onAccountId')
    });
    if (selection.length === 0) {
      await prompter.outro('No channels selected.');
      return;
    }
    const wantsNames = await prompter.confirm({
      message: 'Add display names for these accounts? (optional)',
      initialValue: false
    });
    if (wantsNames) {
      for (const channel2 of selection) {
        const accountId2 = accountIds[channel2] ?? DEFAULT_ACCOUNT_ID;
        const plugin2 = getChannelPlugin(channel2);
        const account = plugin2?.config.resolveAccount(nextConfig2, accountId2);
        const snapshot = plugin2?.config.describeAccount?.(account, nextConfig2);
        const existingName = snapshot?.name ?? account?.name;
        const name = await prompter.text({
          message: `${channel2} account name (${accountId2})`,
          initialValue: existingName
        });
        if (name?.trim()) {
          nextConfig2 = applyAccountName({
            cfg: nextConfig2,
            channel: channel2,
            accountId: accountId2,
            name
          });
        }
      }
    }
    await writeConfigFile(nextConfig2);
    await prompter.outro('Channels updated.');
    return;
  }
  const rawChannel = String(opts.channel ?? '');
  let channel = normalizeChannelId(rawChannel);
  const catalogEntry = channel ? void 0 : resolveCatalogChannelEntry(rawChannel, nextConfig);
  if (!channel && catalogEntry) {
    const prompter = createClackPrompter();
    const workspaceDir = resolveAgentWorkspaceDir(nextConfig, resolveDefaultAgentId(nextConfig));
    const result = await ensureOnboardingPluginInstalled({
      cfg: nextConfig,
      entry: catalogEntry,
      prompter,
      runtime,
      workspaceDir
    });
    nextConfig = result.cfg;
    if (!result.installed) {
      return;
    }
    reloadOnboardingPluginRegistry({ cfg: nextConfig, runtime, workspaceDir });
    channel = normalizeChannelId(catalogEntry.id) ?? catalogEntry.id;
  }
  if (!channel) {
    const hint = catalogEntry ? `Plugin ${catalogEntry.meta.label} could not be loaded after install.` : `Unknown channel: ${String(opts.channel ?? '')}`;
    runtime.error(hint);
    runtime.exit(1);
    return;
  }
  const plugin = getChannelPlugin(channel);
  if (!plugin?.setup?.applyAccountConfig) {
    runtime.error(`Channel ${channel} does not support add.`);
    runtime.exit(1);
    return;
  }
  const accountId = plugin.setup.resolveAccountId?.({ cfg: nextConfig, accountId: opts.account }) ?? normalizeAccountId(opts.account);
  const useEnv = opts.useEnv === true;
  const initialSyncLimit = typeof opts.initialSyncLimit === 'number' ? opts.initialSyncLimit : typeof opts.initialSyncLimit === 'string' && opts.initialSyncLimit.trim() ? Number.parseInt(opts.initialSyncLimit, 10) : void 0;
  const groupChannels = parseList(opts.groupChannels);
  const dmAllowlist = parseList(opts.dmAllowlist);
  const validationError = plugin.setup.validateInput?.({
    cfg: nextConfig,
    accountId,
    input: {
      name: opts.name,
      token: opts.token,
      tokenFile: opts.tokenFile,
      botToken: opts.botToken,
      appToken: opts.appToken,
      signalNumber: opts.signalNumber,
      cliPath: opts.cliPath,
      dbPath: opts.dbPath,
      service: opts.service,
      region: opts.region,
      authDir: opts.authDir,
      httpUrl: opts.httpUrl,
      httpHost: opts.httpHost,
      httpPort: opts.httpPort,
      webhookPath: opts.webhookPath,
      webhookUrl: opts.webhookUrl,
      audienceType: opts.audienceType,
      audience: opts.audience,
      homeserver: opts.homeserver,
      userId: opts.userId,
      accessToken: opts.accessToken,
      password: opts.password,
      deviceName: opts.deviceName,
      initialSyncLimit,
      useEnv,
      ship: opts.ship,
      url: opts.url,
      code: opts.code,
      groupChannels,
      dmAllowlist,
      autoDiscoverChannels: opts.autoDiscoverChannels
    }
  });
  if (validationError) {
    runtime.error(validationError);
    runtime.exit(1);
    return;
  }
  nextConfig = applyChannelAccountConfig({
    cfg: nextConfig,
    channel,
    accountId,
    name: opts.name,
    token: opts.token,
    tokenFile: opts.tokenFile,
    botToken: opts.botToken,
    appToken: opts.appToken,
    signalNumber: opts.signalNumber,
    cliPath: opts.cliPath,
    dbPath: opts.dbPath,
    service: opts.service,
    region: opts.region,
    authDir: opts.authDir,
    httpUrl: opts.httpUrl,
    httpHost: opts.httpHost,
    httpPort: opts.httpPort,
    webhookPath: opts.webhookPath,
    webhookUrl: opts.webhookUrl,
    audienceType: opts.audienceType,
    audience: opts.audience,
    homeserver: opts.homeserver,
    userId: opts.userId,
    accessToken: opts.accessToken,
    password: opts.password,
    deviceName: opts.deviceName,
    initialSyncLimit,
    useEnv,
    ship: opts.ship,
    url: opts.url,
    code: opts.code,
    groupChannels,
    dmAllowlist,
    autoDiscoverChannels: opts.autoDiscoverChannels
  });
  await writeConfigFile(nextConfig);
  runtime.log(`Added ${channelLabel(channel)} account "${accountId}".`);
}
__name(channelsAddCommand, 'channelsAddCommand');
export {
  channelsAddCommand
};
