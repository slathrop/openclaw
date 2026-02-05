import { LitElement } from 'lit';
import {
  handleChannelConfigReload as handleChannelConfigReloadInternal,
  handleChannelConfigSave as handleChannelConfigSaveInternal,
  handleNostrProfileCancel as handleNostrProfileCancelInternal,
  handleNostrProfileEdit as handleNostrProfileEditInternal,
  handleNostrProfileFieldChange as handleNostrProfileFieldChangeInternal,
  handleNostrProfileImport as handleNostrProfileImportInternal,
  handleNostrProfileSave as handleNostrProfileSaveInternal,
  handleNostrProfileToggleAdvanced as handleNostrProfileToggleAdvancedInternal,
  handleWhatsAppLogout as handleWhatsAppLogoutInternal,
  handleWhatsAppStart as handleWhatsAppStartInternal,
  handleWhatsAppWait as handleWhatsAppWaitInternal
} from './app-channels.js';
import {
  handleAbortChat as handleAbortChatInternal,
  handleSendChat as handleSendChatInternal,
  removeQueuedMessage as removeQueuedMessageInternal
} from './app-chat.js';
import { DEFAULT_CRON_FORM, DEFAULT_LOG_LEVEL_FILTERS } from './app-defaults.js';
import { connectGateway as connectGatewayInternal } from './app-gateway.js';
import {
  handleConnected,
  handleDisconnected,
  handleFirstUpdated,
  handleUpdated
} from './app-lifecycle.js';
import { renderApp } from './app-render.js';
import {
  exportLogs as exportLogsInternal,
  handleChatScroll as handleChatScrollInternal,
  handleLogsScroll as handleLogsScrollInternal,
  resetChatScroll as resetChatScrollInternal,
  scheduleChatScroll as scheduleChatScrollInternal
} from './app-scroll.js';
import {
  applySettings as applySettingsInternal,
  loadCron as loadCronInternal,
  loadOverview as loadOverviewInternal,
  setTab as setTabInternal,
  setTheme as setThemeInternal,
  onPopState as onPopStateInternal
} from './app-settings.js';
import {
  resetToolStream as resetToolStreamInternal
} from './app-tool-stream.js';
import { resolveInjectedAssistantIdentity } from './assistant-identity.js';
import { loadAssistantIdentity as loadAssistantIdentityInternal } from './controllers/assistant-identity.js';
import { loadSettings } from './storage.js';

const injectedAssistantIdentity = resolveInjectedAssistantIdentity();

function resolveOnboardingMode() {
  if (!window.location.search) {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('onboarding');
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export class OpenClawApp extends LitElement {
  static properties = {
    settings: { state: true },
    password: { state: true },
    tab: { state: true },
    onboarding: { state: true },
    connected: { state: true },
    theme: { state: true },
    themeResolved: { state: true },
    hello: { state: true },
    lastError: { state: true },
    eventLog: { state: true },
    assistantName: { state: true },
    assistantAvatar: { state: true },
    assistantAgentId: { state: true },
    sessionKey: { state: true },
    chatLoading: { state: true },
    chatSending: { state: true },
    chatMessage: { state: true },
    chatMessages: { state: true },
    chatToolMessages: { state: true },
    chatStream: { state: true },
    chatStreamStartedAt: { state: true },
    chatRunId: { state: true },
    compactionStatus: { state: true },
    chatAvatarUrl: { state: true },
    chatThinkingLevel: { state: true },
    chatQueue: { state: true },
    chatAttachments: { state: true },
    sidebarOpen: { state: true },
    sidebarContent: { state: true },
    sidebarError: { state: true },
    splitRatio: { state: true },
    nodesLoading: { state: true },
    nodes: { state: true },
    devicesLoading: { state: true },
    devicesError: { state: true },
    devicesList: { state: true },
    execApprovalsLoading: { state: true },
    execApprovalsSaving: { state: true },
    execApprovalsDirty: { state: true },
    execApprovalsSnapshot: { state: true },
    execApprovalsForm: { state: true },
    execApprovalsSelectedAgent: { state: true },
    execApprovalsTarget: { state: true },
    execApprovalsTargetNodeId: { state: true },
    execApprovalQueue: { state: true },
    execApprovalBusy: { state: true },
    execApprovalError: { state: true },
    pendingGatewayUrl: { state: true },
    configLoading: { state: true },
    configRaw: { state: true },
    configRawOriginal: { state: true },
    configValid: { state: true },
    configIssues: { state: true },
    configSaving: { state: true },
    configApplying: { state: true },
    updateRunning: { state: true },
    applySessionKey: { state: true },
    configSnapshot: { state: true },
    configSchema: { state: true },
    configSchemaVersion: { state: true },
    configSchemaLoading: { state: true },
    configUiHints: { state: true },
    configForm: { state: true },
    configFormOriginal: { state: true },
    configFormDirty: { state: true },
    configFormMode: { state: true },
    configSearchQuery: { state: true },
    configActiveSection: { state: true },
    configActiveSubsection: { state: true },
    channelsLoading: { state: true },
    channelsSnapshot: { state: true },
    channelsError: { state: true },
    channelsLastSuccess: { state: true },
    whatsappLoginMessage: { state: true },
    whatsappLoginQrDataUrl: { state: true },
    whatsappLoginConnected: { state: true },
    whatsappBusy: { state: true },
    nostrProfileFormState: { state: true },
    nostrProfileAccountId: { state: true },
    presenceLoading: { state: true },
    presenceEntries: { state: true },
    presenceError: { state: true },
    presenceStatus: { state: true },
    agentsLoading: { state: true },
    agentsList: { state: true },
    agentsError: { state: true },
    agentsSelectedId: { state: true },
    agentsPanel: { state: true },
    agentFilesLoading: { state: true },
    agentFilesError: { state: true },
    agentFilesList: { state: true },
    agentFileContents: { state: true },
    agentFileDrafts: { state: true },
    agentFileActive: { state: true },
    agentFileSaving: { state: true },
    agentIdentityLoading: { state: true },
    agentIdentityError: { state: true },
    agentIdentityById: { state: true },
    agentSkillsLoading: { state: true },
    agentSkillsError: { state: true },
    agentSkillsReport: { state: true },
    agentSkillsAgentId: { state: true },
    sessionsLoading: { state: true },
    sessionsResult: { state: true },
    sessionsError: { state: true },
    sessionsFilterActive: { state: true },
    sessionsFilterLimit: { state: true },
    sessionsIncludeGlobal: { state: true },
    sessionsIncludeUnknown: { state: true },
    cronLoading: { state: true },
    cronJobs: { state: true },
    cronStatus: { state: true },
    cronError: { state: true },
    cronForm: { state: true },
    cronRunsJobId: { state: true },
    cronRuns: { state: true },
    cronBusy: { state: true },
    skillsLoading: { state: true },
    skillsReport: { state: true },
    skillsError: { state: true },
    skillsFilter: { state: true },
    skillEdits: { state: true },
    skillsBusyKey: { state: true },
    skillMessages: { state: true },
    debugLoading: { state: true },
    debugStatus: { state: true },
    debugHealth: { state: true },
    debugModels: { state: true },
    debugHeartbeat: { state: true },
    debugCallMethod: { state: true },
    debugCallParams: { state: true },
    debugCallResult: { state: true },
    debugCallError: { state: true },
    logsLoading: { state: true },
    logsError: { state: true },
    logsFile: { state: true },
    logsEntries: { state: true },
    logsFilterText: { state: true },
    logsLevelFilters: { state: true },
    logsAutoFollow: { state: true },
    logsTruncated: { state: true },
    logsCursor: { state: true },
    logsLastFetchAt: { state: true },
    logsLimit: { state: true },
    logsMaxBytes: { state: true },
    logsAtBottom: { state: true },
    chatNewMessagesBelow: { state: true }
  };

  constructor() {
    super();
    // Reactive properties (via static properties)
    this.settings = loadSettings();
    this.password = '';
    this.tab = 'chat';
    this.onboarding = resolveOnboardingMode();
    this.connected = false;
    this.theme = this.settings.theme ?? 'system';
    this.themeResolved = 'dark';
    this.hello = null;
    this.lastError = null;
    this.eventLog = [];

    this.assistantName = injectedAssistantIdentity.name;
    this.assistantAvatar = injectedAssistantIdentity.avatar;
    this.assistantAgentId = injectedAssistantIdentity.agentId ?? null;

    this.sessionKey = this.settings.sessionKey;
    this.chatLoading = false;
    this.chatSending = false;
    this.chatMessage = '';
    this.chatMessages = [];
    this.chatToolMessages = [];
    this.chatStream = null;
    this.chatStreamStartedAt = null;
    this.chatRunId = null;
    this.compactionStatus = null;
    this.chatAvatarUrl = null;
    this.chatThinkingLevel = null;
    this.chatQueue = [];
    this.chatAttachments = [];
    // Sidebar state for tool output viewing
    this.sidebarOpen = false;
    this.sidebarContent = null;
    this.sidebarError = null;
    this.splitRatio = this.settings.splitRatio;

    this.nodesLoading = false;
    this.nodes = [];
    this.devicesLoading = false;
    this.devicesError = null;
    this.devicesList = null;
    this.execApprovalsLoading = false;
    this.execApprovalsSaving = false;
    this.execApprovalsDirty = false;
    this.execApprovalsSnapshot = null;
    this.execApprovalsForm = null;
    this.execApprovalsSelectedAgent = null;
    this.execApprovalsTarget = 'gateway';
    this.execApprovalsTargetNodeId = null;
    this.execApprovalQueue = [];
    this.execApprovalBusy = false;
    this.execApprovalError = null;
    this.pendingGatewayUrl = null;

    this.configLoading = false;
    this.configRaw = '{\n}\n';
    this.configRawOriginal = '';
    this.configValid = null;
    this.configIssues = [];
    this.configSaving = false;
    this.configApplying = false;
    this.updateRunning = false;
    this.applySessionKey = this.settings.lastActiveSessionKey;
    this.configSnapshot = null;
    this.configSchema = null;
    this.configSchemaVersion = null;
    this.configSchemaLoading = false;
    this.configUiHints = {};
    this.configForm = null;
    this.configFormOriginal = null;
    this.configFormDirty = false;
    this.configFormMode = 'form';
    this.configSearchQuery = '';
    this.configActiveSection = null;
    this.configActiveSubsection = null;

    this.channelsLoading = false;
    this.channelsSnapshot = null;
    this.channelsError = null;
    this.channelsLastSuccess = null;
    this.whatsappLoginMessage = null;
    this.whatsappLoginQrDataUrl = null;
    this.whatsappLoginConnected = null;
    this.whatsappBusy = false;
    this.nostrProfileFormState = null;
    this.nostrProfileAccountId = null;

    this.presenceLoading = false;
    this.presenceEntries = [];
    this.presenceError = null;
    this.presenceStatus = null;

    this.agentsLoading = false;
    this.agentsList = null;
    this.agentsError = null;
    this.agentsSelectedId = null;
    this.agentsPanel = 'overview';
    this.agentFilesLoading = false;
    this.agentFilesError = null;
    this.agentFilesList = null;
    this.agentFileContents = {};
    this.agentFileDrafts = {};
    this.agentFileActive = null;
    this.agentFileSaving = false;
    this.agentIdentityLoading = false;
    this.agentIdentityError = null;
    this.agentIdentityById = {};
    this.agentSkillsLoading = false;
    this.agentSkillsError = null;
    this.agentSkillsReport = null;
    this.agentSkillsAgentId = null;

    this.sessionsLoading = false;
    this.sessionsResult = null;
    this.sessionsError = null;
    this.sessionsFilterActive = '';
    this.sessionsFilterLimit = '120';
    this.sessionsIncludeGlobal = true;
    this.sessionsIncludeUnknown = false;

    this.cronLoading = false;
    this.cronJobs = [];
    this.cronStatus = null;
    this.cronError = null;
    this.cronForm = { ...DEFAULT_CRON_FORM };
    this.cronRunsJobId = null;
    this.cronRuns = [];
    this.cronBusy = false;

    this.skillsLoading = false;
    this.skillsReport = null;
    this.skillsError = null;
    this.skillsFilter = '';
    this.skillEdits = {};
    this.skillsBusyKey = null;
    this.skillMessages = {};

    this.debugLoading = false;
    this.debugStatus = null;
    this.debugHealth = null;
    this.debugModels = [];
    this.debugHeartbeat = null;
    this.debugCallMethod = '';
    this.debugCallParams = '{}';
    this.debugCallResult = null;
    this.debugCallError = null;

    this.logsLoading = false;
    this.logsError = null;
    this.logsFile = null;
    this.logsEntries = [];
    this.logsFilterText = '';
    this.logsLevelFilters = {
      ...DEFAULT_LOG_LEVEL_FILTERS
    };
    this.logsAutoFollow = true;
    this.logsTruncated = false;
    this.logsCursor = null;
    this.logsLastFetchAt = null;
    this.logsLimit = 500;
    this.logsMaxBytes = 250_000;
    this.logsAtBottom = true;

    this.chatNewMessagesBelow = false;

    // Non-reactive fields (accessed by extracted helper modules)
    this.eventLogBuffer = [];
    this.toolStreamSyncTimer = null;
    this.sidebarCloseTimer = null;
    this.client = null;
    this.chatScrollFrame = null;
    this.chatScrollTimeout = null;
    this.chatHasAutoScrolled = false;
    this.chatUserNearBottom = true;
    this.nodesPollInterval = null;
    this.logsPollInterval = null;
    this.debugPollInterval = null;
    this.logsScrollFrame = null;
    this.toolStreamById = new Map();
    this.toolStreamOrder = [];
    this.refreshSessionsAfterChat = new Set();
    this.basePath = '';
    this.popStateHandler = () =>
      onPopStateInternal(this);
    this.themeMedia = null;
    this.themeMediaHandler = null;
    this.topbarObserver = null;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    handleConnected(this);
  }

  firstUpdated() {
    handleFirstUpdated(this);
  }

  disconnectedCallback() {
    handleDisconnected(this);
    super.disconnectedCallback();
  }

  updated(changed) {
    handleUpdated(this, changed);
  }

  connect() {
    connectGatewayInternal(this);
  }

  handleChatScroll(event) {
    handleChatScrollInternal(this, event);
  }

  handleLogsScroll(event) {
    handleLogsScrollInternal(this, event);
  }

  exportLogs(lines, label) {
    exportLogsInternal(lines, label);
  }

  resetToolStream() {
    resetToolStreamInternal(this);
  }

  resetChatScroll() {
    resetChatScrollInternal(this);
  }

  scrollToBottom() {
    resetChatScrollInternal(this);
    scheduleChatScrollInternal(this, true);
  }

  async loadAssistantIdentity() {
    await loadAssistantIdentityInternal(this);
  }

  applySettings(next) {
    applySettingsInternal(this, next);
  }

  setTab(next) {
    setTabInternal(this, next);
  }

  setTheme(next, context) {
    setThemeInternal(this, next, context);
  }

  async loadOverview() {
    await loadOverviewInternal(this);
  }

  async loadCron() {
    await loadCronInternal(this);
  }

  async handleAbortChat() {
    await handleAbortChatInternal(this);
  }

  removeQueuedMessage(id) {
    removeQueuedMessageInternal(this, id);
  }

  async handleSendChat(messageOverride, opts) {
    await handleSendChatInternal(this, messageOverride, opts);
  }

  async handleWhatsAppStart(force) {
    await handleWhatsAppStartInternal(this, force);
  }

  async handleWhatsAppWait() {
    await handleWhatsAppWaitInternal(this);
  }

  async handleWhatsAppLogout() {
    await handleWhatsAppLogoutInternal(this);
  }

  async handleChannelConfigSave() {
    await handleChannelConfigSaveInternal(this);
  }

  async handleChannelConfigReload() {
    await handleChannelConfigReloadInternal(this);
  }

  handleNostrProfileEdit(accountId, profile) {
    handleNostrProfileEditInternal(this, accountId, profile);
  }

  handleNostrProfileCancel() {
    handleNostrProfileCancelInternal(this);
  }

  handleNostrProfileFieldChange(field, value) {
    handleNostrProfileFieldChangeInternal(this, field, value);
  }

  async handleNostrProfileSave() {
    await handleNostrProfileSaveInternal(this);
  }

  async handleNostrProfileImport() {
    await handleNostrProfileImportInternal(this);
  }

  handleNostrProfileToggleAdvanced() {
    handleNostrProfileToggleAdvancedInternal(this);
  }

  async handleExecApprovalDecision(decision) {
    const active = this.execApprovalQueue[0];
    if (!active || !this.client || this.execApprovalBusy) {
      return;
    }
    this.execApprovalBusy = true;
    this.execApprovalError = null;
    try {
      await this.client.request('exec.approval.resolve', {
        id: active.id,
        decision
      });
      this.execApprovalQueue = this.execApprovalQueue.filter((entry) => entry.id !== active.id);
    } catch (err) {
      this.execApprovalError = `Exec approval failed: ${String(err)}`;
    } finally {
      this.execApprovalBusy = false;
    }
  }

  handleGatewayUrlConfirm() {
    const nextGatewayUrl = this.pendingGatewayUrl;
    if (!nextGatewayUrl) {
      return;
    }
    this.pendingGatewayUrl = null;
    applySettingsInternal(this, {
      ...this.settings,
      gatewayUrl: nextGatewayUrl
    });
    this.connect();
  }

  handleGatewayUrlCancel() {
    this.pendingGatewayUrl = null;
  }

  // Sidebar handlers for tool output viewing
  handleOpenSidebar(content) {
    if (this.sidebarCloseTimer !== null && this.sidebarCloseTimer !== undefined) {
      window.clearTimeout(this.sidebarCloseTimer);
      this.sidebarCloseTimer = null;
    }
    this.sidebarContent = content;
    this.sidebarError = null;
    this.sidebarOpen = true;
  }

  handleCloseSidebar() {
    this.sidebarOpen = false;
    // Clear content after transition
    if (this.sidebarCloseTimer !== null && this.sidebarCloseTimer !== undefined) {
      window.clearTimeout(this.sidebarCloseTimer);
    }
    this.sidebarCloseTimer = window.setTimeout(() => {
      if (this.sidebarOpen) {
        return;
      }
      this.sidebarContent = null;
      this.sidebarError = null;
      this.sidebarCloseTimer = null;
    }, 200);
  }

  handleSplitRatioChange(ratio) {
    const newRatio = Math.max(0.4, Math.min(0.7, ratio));
    this.splitRatio = newRatio;
    this.applySettings({ ...this.settings, splitRatio: newRatio });
  }

  render() {
    return renderApp(this);
  }
}

customElements.define('openclaw-app', OpenClawApp);
