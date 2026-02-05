import { html, nothing } from 'lit';
import { clampText, formatAgo, formatList } from '../format.js';
function renderNodes(props) {
  const bindingState = resolveBindingsState(props);
  const approvalsState = resolveExecApprovalsState(props);
  return html`
    ${renderExecApprovals(approvalsState)}
    ${renderBindings(bindingState)}
    ${renderDevices(props)}
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Nodes</div>
          <div class="card-sub">Paired devices and live links.</div>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? 'Loading\u2026' : 'Refresh'}
        </button>
      </div>
      <div class="list" style="margin-top: 16px;">
        ${props.nodes.length === 0 ? html`
                <div class="muted">No nodes found.</div>
              ` : props.nodes.map((n) => renderNode(n))}
      </div>
    </section>
  `;
}
function renderDevices(props) {
  const list = props.devicesList ?? { pending: [], paired: [] };
  const pending = Array.isArray(list.pending) ? list.pending : [];
  const paired = Array.isArray(list.paired) ? list.paired : [];
  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Devices</div>
          <div class="card-sub">Pairing requests + role tokens.</div>
        </div>
        <button class="btn" ?disabled=${props.devicesLoading} @click=${props.onDevicesRefresh}>
          ${props.devicesLoading ? 'Loading\u2026' : 'Refresh'}
        </button>
      </div>
      ${props.devicesError ? html`<div class="callout danger" style="margin-top: 12px;">${props.devicesError}</div>` : nothing}
      <div class="list" style="margin-top: 16px;">
        ${pending.length > 0 ? html`
              <div class="muted" style="margin-bottom: 8px;">Pending</div>
              ${pending.map((req) => renderPendingDevice(req, props))}
            ` : nothing}
        ${paired.length > 0 ? html`
              <div class="muted" style="margin-top: 12px; margin-bottom: 8px;">Paired</div>
              ${paired.map((device) => renderPairedDevice(device, props))}
            ` : nothing}
        ${pending.length === 0 && paired.length === 0 ? html`
                <div class="muted">No paired devices.</div>
              ` : nothing}
      </div>
    </section>
  `;
}
function renderPendingDevice(req, props) {
  const name = req.displayName?.trim() || req.deviceId;
  const age = typeof req.ts === 'number' ? formatAgo(req.ts) : 'n/a';
  const role = req.role?.trim() ? `role: ${req.role}` : 'role: -';
  const repair = req.isRepair ? ' \xB7 repair' : '';
  const ip = req.remoteIp ? ` \xB7 ${req.remoteIp}` : '';
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${name}</div>
        <div class="list-sub">${req.deviceId}${ip}</div>
        <div class="muted" style="margin-top: 6px;">
          ${role} · requested ${age}${repair}
        </div>
      </div>
      <div class="list-meta">
        <div class="row" style="justify-content: flex-end; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn--sm primary" @click=${() => props.onDeviceApprove(req.requestId)}>
            Approve
          </button>
          <button class="btn btn--sm" @click=${() => props.onDeviceReject(req.requestId)}>
            Reject
          </button>
        </div>
      </div>
    </div>
  `;
}
function renderPairedDevice(device, props) {
  const name = device.displayName?.trim() || device.deviceId;
  const ip = device.remoteIp ? ` \xB7 ${device.remoteIp}` : '';
  const roles = `roles: ${formatList(device.roles)}`;
  const scopes = `scopes: ${formatList(device.scopes)}`;
  const tokens = Array.isArray(device.tokens) ? device.tokens : [];
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${name}</div>
        <div class="list-sub">${device.deviceId}${ip}</div>
        <div class="muted" style="margin-top: 6px;">${roles} · ${scopes}</div>
        ${tokens.length === 0 ? html`
                <div class="muted" style="margin-top: 6px">Tokens: none</div>
              ` : html`
              <div class="muted" style="margin-top: 10px;">Tokens</div>
              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                ${tokens.map((token) => renderTokenRow(device.deviceId, token, props))}
              </div>
            `}
      </div>
    </div>
  `;
}
function renderTokenRow(deviceId, token, props) {
  const status = token.revokedAtMs ? 'revoked' : 'active';
  const scopes = `scopes: ${formatList(token.scopes)}`;
  const when = formatAgo(token.rotatedAtMs ?? token.createdAtMs ?? token.lastUsedAtMs ?? null);
  return html`
    <div class="row" style="justify-content: space-between; gap: 8px;">
      <div class="list-sub">${token.role} · ${status} · ${scopes} · ${when}</div>
      <div class="row" style="justify-content: flex-end; gap: 6px; flex-wrap: wrap;">
        <button
          class="btn btn--sm"
          @click=${() => props.onDeviceRotate(deviceId, token.role, token.scopes)}
        >
          Rotate
        </button>
        ${token.revokedAtMs ? nothing : html`
              <button
                class="btn btn--sm danger"
                @click=${() => props.onDeviceRevoke(deviceId, token.role)}
              >
                Revoke
              </button>
            `}
      </div>
    </div>
  `;
}
const EXEC_APPROVALS_DEFAULT_SCOPE = '__defaults__';
const SECURITY_OPTIONS = [
  { value: 'deny', label: 'Deny' },
  { value: 'allowlist', label: 'Allowlist' },
  { value: 'full', label: 'Full' }
];
const ASK_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'on-miss', label: 'On miss' },
  { value: 'always', label: 'Always' }
];
function resolveBindingsState(props) {
  const config = props.configForm;
  const nodes = resolveExecNodes(props.nodes);
  const { defaultBinding, agents } = resolveAgentBindings(config);
  const ready = Boolean(config);
  const disabled = props.configSaving || props.configFormMode === 'raw';
  return {
    ready,
    disabled,
    configDirty: props.configDirty,
    configLoading: props.configLoading,
    configSaving: props.configSaving,
    defaultBinding,
    agents,
    nodes,
    onBindDefault: props.onBindDefault,
    onBindAgent: props.onBindAgent,
    onSave: props.onSaveBindings,
    onLoadConfig: props.onLoadConfig,
    formMode: props.configFormMode
  };
}
function normalizeSecurity(value) {
  if (value === 'allowlist' || value === 'full' || value === 'deny') {
    return value;
  }
  return 'deny';
}
function normalizeAsk(value) {
  if (value === 'always' || value === 'off' || value === 'on-miss') {
    return value;
  }
  return 'on-miss';
}
function resolveExecApprovalsDefaults(form) {
  const defaults = form?.defaults ?? {};
  return {
    security: normalizeSecurity(defaults.security),
    ask: normalizeAsk(defaults.ask),
    askFallback: normalizeSecurity(defaults.askFallback ?? 'deny'),
    autoAllowSkills: Boolean(defaults.autoAllowSkills ?? false)
  };
}
function resolveConfigAgents(config) {
  const agentsNode = config?.agents ?? {};
  const list = Array.isArray(agentsNode.list) ? agentsNode.list : [];
  const agents = [];
  list.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const record = entry;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (!id) {
      return;
    }
    const name = typeof record.name === 'string' ? record.name.trim() : void 0;
    const isDefault = record.default === true;
    agents.push({ id, name: name || void 0, isDefault });
  });
  return agents;
}
function resolveExecApprovalsAgents(config, form) {
  const configAgents = resolveConfigAgents(config);
  const approvalsAgents = Object.keys(form?.agents ?? {});
  const merged = /* @__PURE__ */ new Map();
  configAgents.forEach((agent) => merged.set(agent.id, agent));
  approvalsAgents.forEach((id) => {
    if (merged.has(id)) {
      return;
    }
    merged.set(id, { id });
  });
  const agents = Array.from(merged.values());
  if (agents.length === 0) {
    agents.push({ id: 'main', isDefault: true });
  }
  agents.sort((a, b) => {
    if (a.isDefault && !b.isDefault) {
      return -1;
    }
    if (!a.isDefault && b.isDefault) {
      return 1;
    }
    const aLabel = a.name?.trim() ? a.name : a.id;
    const bLabel = b.name?.trim() ? b.name : b.id;
    return aLabel.localeCompare(bLabel);
  });
  return agents;
}
function resolveExecApprovalsScope(selected, agents) {
  if (selected === EXEC_APPROVALS_DEFAULT_SCOPE) {
    return EXEC_APPROVALS_DEFAULT_SCOPE;
  }
  if (selected && agents.some((agent) => agent.id === selected)) {
    return selected;
  }
  return EXEC_APPROVALS_DEFAULT_SCOPE;
}
function resolveExecApprovalsState(props) {
  const form = props.execApprovalsForm ?? props.execApprovalsSnapshot?.file ?? null;
  const ready = Boolean(form);
  const defaults = resolveExecApprovalsDefaults(form);
  const agents = resolveExecApprovalsAgents(props.configForm, form);
  const targetNodes = resolveExecApprovalsNodes(props.nodes);
  const target = props.execApprovalsTarget;
  let targetNodeId = target === 'node' && props.execApprovalsTargetNodeId ? props.execApprovalsTargetNodeId : null;
  if (target === 'node' && targetNodeId && !targetNodes.some((node) => node.id === targetNodeId)) {
    targetNodeId = null;
  }
  const selectedScope = resolveExecApprovalsScope(props.execApprovalsSelectedAgent, agents);
  const selectedAgent = selectedScope !== EXEC_APPROVALS_DEFAULT_SCOPE ? (form?.agents ?? {})[selectedScope] ?? null : null;
  const allowlist = Array.isArray(selectedAgent?.allowlist) ? selectedAgent.allowlist ?? [] : [];
  return {
    ready,
    disabled: props.execApprovalsSaving || props.execApprovalsLoading,
    dirty: props.execApprovalsDirty,
    loading: props.execApprovalsLoading,
    saving: props.execApprovalsSaving,
    form,
    defaults,
    selectedScope,
    selectedAgent,
    agents,
    allowlist,
    target,
    targetNodeId,
    targetNodes,
    onSelectScope: props.onExecApprovalsSelectAgent,
    onSelectTarget: props.onExecApprovalsTargetChange,
    onPatch: props.onExecApprovalsPatch,
    onRemove: props.onExecApprovalsRemove,
    onLoad: props.onLoadExecApprovals,
    onSave: props.onSaveExecApprovals
  };
}
function renderBindings(state) {
  const supportsBinding = state.nodes.length > 0;
  const defaultValue = state.defaultBinding ?? '';
  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div>
          <div class="card-title">Exec node binding</div>
          <div class="card-sub">
            Pin agents to a specific node when using <span class="mono">exec host=node</span>.
          </div>
        </div>
        <button
          class="btn"
          ?disabled=${state.disabled || !state.configDirty}
          @click=${state.onSave}
        >
          ${state.configSaving ? 'Saving\u2026' : 'Save'}
        </button>
      </div>

      ${state.formMode === 'raw' ? html`
              <div class="callout warn" style="margin-top: 12px">
                Switch the Config tab to <strong>Form</strong> mode to edit bindings here.
              </div>
            ` : nothing}

      ${!state.ready ? html`<div class="row" style="margin-top: 12px; gap: 12px;">
            <div class="muted">Load config to edit bindings.</div>
            <button class="btn" ?disabled=${state.configLoading} @click=${state.onLoadConfig}>
              ${state.configLoading ? 'Loading\u2026' : 'Load config'}
            </button>
          </div>` : html`
            <div class="list" style="margin-top: 16px;">
              <div class="list-item">
                <div class="list-main">
                  <div class="list-title">Default binding</div>
                  <div class="list-sub">Used when agents do not override a node binding.</div>
                </div>
                <div class="list-meta">
                  <label class="field">
                    <span>Node</span>
                    <select
                      ?disabled=${state.disabled || !supportsBinding}
                      @change=${(event) => {
                        const target = event.target;
                        const value = target.value.trim();
                        state.onBindDefault(value ? value : null);
                      }}
                    >
                      <option value="" ?selected=${defaultValue === ''}>Any node</option>
                      ${state.nodes.map(
                        (node) => html`<option
                            value=${node.id}
                            ?selected=${defaultValue === node.id}
                          >
                            ${node.label}
                          </option>`
                      )}
                    </select>
                  </label>
                  ${!supportsBinding ? html`
                          <div class="muted">No nodes with system.run available.</div>
                        ` : nothing}
                </div>
              </div>

              ${state.agents.length === 0 ? html`
                      <div class="muted">No agents found.</div>
                    ` : state.agents.map((agent) => renderAgentBinding(agent, state))}
            </div>
          `}
    </section>
  `;
}
function renderExecApprovals(state) {
  const ready = state.ready;
  const targetReady = state.target !== 'node' || Boolean(state.targetNodeId);
  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div>
          <div class="card-title">Exec approvals</div>
          <div class="card-sub">
            Allowlist and approval policy for <span class="mono">exec host=gateway/node</span>.
          </div>
        </div>
        <button
          class="btn"
          ?disabled=${state.disabled || !state.dirty || !targetReady}
          @click=${state.onSave}
        >
          ${state.saving ? 'Saving\u2026' : 'Save'}
        </button>
      </div>

      ${renderExecApprovalsTarget(state)}

      ${!ready ? html`<div class="row" style="margin-top: 12px; gap: 12px;">
            <div class="muted">Load exec approvals to edit allowlists.</div>
            <button class="btn" ?disabled=${state.loading || !targetReady} @click=${state.onLoad}>
              ${state.loading ? 'Loading\u2026' : 'Load approvals'}
            </button>
          </div>` : html`
            ${renderExecApprovalsTabs(state)}
            ${renderExecApprovalsPolicy(state)}
            ${state.selectedScope === EXEC_APPROVALS_DEFAULT_SCOPE ? nothing : renderExecApprovalsAllowlist(state)}
          `}
    </section>
  `;
}
function renderExecApprovalsTarget(state) {
  const hasNodes = state.targetNodes.length > 0;
  const nodeValue = state.targetNodeId ?? '';
  return html`
    <div class="list" style="margin-top: 12px;">
      <div class="list-item">
        <div class="list-main">
          <div class="list-title">Target</div>
          <div class="list-sub">
            Gateway edits local approvals; node edits the selected node.
          </div>
        </div>
        <div class="list-meta">
          <label class="field">
            <span>Host</span>
            <select
              ?disabled=${state.disabled}
              @change=${(event) => {
                const target = event.target;
                const value = target.value;
                if (value === 'node') {
                  const first = state.targetNodes[0]?.id ?? null;
                  state.onSelectTarget('node', nodeValue || first);
                } else {
                  state.onSelectTarget('gateway', null);
                }
              }}
            >
              <option value="gateway" ?selected=${state.target === 'gateway'}>Gateway</option>
              <option value="node" ?selected=${state.target === 'node'}>Node</option>
            </select>
          </label>
          ${state.target === 'node' ? html`
                <label class="field">
                  <span>Node</span>
                  <select
                    ?disabled=${state.disabled || !hasNodes}
                    @change=${(event) => {
                      const target = event.target;
                      const value = target.value.trim();
                      state.onSelectTarget('node', value ? value : null);
                    }}
                  >
                    <option value="" ?selected=${nodeValue === ''}>Select node</option>
                    ${state.targetNodes.map(
                      (node) => html`<option
                          value=${node.id}
                          ?selected=${nodeValue === node.id}
                        >
                          ${node.label}
                        </option>`
                    )}
                  </select>
                </label>
              ` : nothing}
        </div>
      </div>
      ${state.target === 'node' && !hasNodes ? html`
              <div class="muted">No nodes advertise exec approvals yet.</div>
            ` : nothing}
    </div>
  `;
}
function renderExecApprovalsTabs(state) {
  return html`
    <div class="row" style="margin-top: 12px; gap: 8px; flex-wrap: wrap;">
      <span class="label">Scope</span>
      <div class="row" style="gap: 8px; flex-wrap: wrap;">
        <button
          class="btn btn--sm ${state.selectedScope === EXEC_APPROVALS_DEFAULT_SCOPE ? 'active' : ''}"
          @click=${() => state.onSelectScope(EXEC_APPROVALS_DEFAULT_SCOPE)}
        >
          Defaults
        </button>
        ${state.agents.map((agent) => {
          const label = agent.name?.trim() ? `${agent.name} (${agent.id})` : agent.id;
          return html`
            <button
              class="btn btn--sm ${state.selectedScope === agent.id ? 'active' : ''}"
              @click=${() => state.onSelectScope(agent.id)}
            >
              ${label}
            </button>
          `;
        })}
      </div>
    </div>
  `;
}
function renderExecApprovalsPolicy(state) {
  const isDefaults = state.selectedScope === EXEC_APPROVALS_DEFAULT_SCOPE;
  const defaults = state.defaults;
  const agent = state.selectedAgent ?? {};
  const basePath = isDefaults ? ['defaults'] : ['agents', state.selectedScope];
  const agentSecurity = typeof agent.security === 'string' ? agent.security : void 0;
  const agentAsk = typeof agent.ask === 'string' ? agent.ask : void 0;
  const agentAskFallback = typeof agent.askFallback === 'string' ? agent.askFallback : void 0;
  const securityValue = isDefaults ? defaults.security : agentSecurity ?? '__default__';
  const askValue = isDefaults ? defaults.ask : agentAsk ?? '__default__';
  const askFallbackValue = isDefaults ? defaults.askFallback : agentAskFallback ?? '__default__';
  const autoOverride = typeof agent.autoAllowSkills === 'boolean' ? agent.autoAllowSkills : void 0;
  const autoEffective = autoOverride ?? defaults.autoAllowSkills;
  const autoIsDefault = autoOverride === null || autoOverride === undefined;
  return html`
    <div class="list" style="margin-top: 16px;">
      <div class="list-item">
        <div class="list-main">
          <div class="list-title">Security</div>
          <div class="list-sub">
            ${isDefaults ? 'Default security mode.' : `Default: ${defaults.security}.`}
          </div>
        </div>
        <div class="list-meta">
          <label class="field">
            <span>Mode</span>
            <select
              ?disabled=${state.disabled}
              @change=${(event) => {
                const target = event.target;
                const value = target.value;
                if (!isDefaults && value === '__default__') {
                  state.onRemove([...basePath, 'security']);
                } else {
                  state.onPatch([...basePath, 'security'], value);
                }
              }}
            >
              ${!isDefaults ? html`<option value="__default__" ?selected=${securityValue === '__default__'}>
                    Use default (${defaults.security})
                  </option>` : nothing}
              ${SECURITY_OPTIONS.map(
                (option) => html`<option
                    value=${option.value}
                    ?selected=${securityValue === option.value}
                  >
                    ${option.label}
                  </option>`
              )}
            </select>
          </label>
        </div>
      </div>

      <div class="list-item">
        <div class="list-main">
          <div class="list-title">Ask</div>
          <div class="list-sub">
            ${isDefaults ? 'Default prompt policy.' : `Default: ${defaults.ask}.`}
          </div>
        </div>
        <div class="list-meta">
          <label class="field">
            <span>Mode</span>
            <select
              ?disabled=${state.disabled}
              @change=${(event) => {
                const target = event.target;
                const value = target.value;
                if (!isDefaults && value === '__default__') {
                  state.onRemove([...basePath, 'ask']);
                } else {
                  state.onPatch([...basePath, 'ask'], value);
                }
              }}
            >
              ${!isDefaults ? html`<option value="__default__" ?selected=${askValue === '__default__'}>
                    Use default (${defaults.ask})
                  </option>` : nothing}
              ${ASK_OPTIONS.map(
                (option) => html`<option
                    value=${option.value}
                    ?selected=${askValue === option.value}
                  >
                    ${option.label}
                  </option>`
              )}
            </select>
          </label>
        </div>
      </div>

      <div class="list-item">
        <div class="list-main">
          <div class="list-title">Ask fallback</div>
          <div class="list-sub">
            ${isDefaults ? 'Applied when the UI prompt is unavailable.' : `Default: ${defaults.askFallback}.`}
          </div>
        </div>
        <div class="list-meta">
          <label class="field">
            <span>Fallback</span>
            <select
              ?disabled=${state.disabled}
              @change=${(event) => {
                const target = event.target;
                const value = target.value;
                if (!isDefaults && value === '__default__') {
                  state.onRemove([...basePath, 'askFallback']);
                } else {
                  state.onPatch([...basePath, 'askFallback'], value);
                }
              }}
            >
              ${!isDefaults ? html`<option value="__default__" ?selected=${askFallbackValue === '__default__'}>
                    Use default (${defaults.askFallback})
                  </option>` : nothing}
              ${SECURITY_OPTIONS.map(
                (option) => html`<option
                    value=${option.value}
                    ?selected=${askFallbackValue === option.value}
                  >
                    ${option.label}
                  </option>`
              )}
            </select>
          </label>
        </div>
      </div>

      <div class="list-item">
        <div class="list-main">
          <div class="list-title">Auto-allow skill CLIs</div>
          <div class="list-sub">
            ${isDefaults ? 'Allow skill executables listed by the Gateway.' : autoIsDefault ? `Using default (${defaults.autoAllowSkills ? 'on' : 'off'}).` : `Override (${autoEffective ? 'on' : 'off'}).`}
          </div>
        </div>
        <div class="list-meta">
          <label class="field">
            <span>Enabled</span>
            <input
              type="checkbox"
              ?disabled=${state.disabled}
              .checked=${autoEffective}
              @change=${(event) => {
                const target = event.target;
                state.onPatch([...basePath, 'autoAllowSkills'], target.checked);
              }}
            />
          </label>
          ${!isDefaults && !autoIsDefault ? html`<button
                class="btn btn--sm"
                ?disabled=${state.disabled}
                @click=${() => state.onRemove([...basePath, 'autoAllowSkills'])}
              >
                Use default
              </button>` : nothing}
        </div>
      </div>
    </div>
  `;
}
function renderExecApprovalsAllowlist(state) {
  const allowlistPath = ['agents', state.selectedScope, 'allowlist'];
  const entries = state.allowlist;
  return html`
    <div class="row" style="margin-top: 18px; justify-content: space-between;">
      <div>
        <div class="card-title">Allowlist</div>
        <div class="card-sub">Case-insensitive glob patterns.</div>
      </div>
      <button
        class="btn btn--sm"
        ?disabled=${state.disabled}
        @click=${() => {
          const next = [...entries, { pattern: '' }];
          state.onPatch(allowlistPath, next);
        }}
      >
        Add pattern
      </button>
    </div>
    <div class="list" style="margin-top: 12px;">
      ${entries.length === 0 ? html`
              <div class="muted">No allowlist entries yet.</div>
            ` : entries.map((entry, index) => renderAllowlistEntry(state, entry, index))}
    </div>
  `;
}
function renderAllowlistEntry(state, entry, index) {
  const lastUsed = entry.lastUsedAt ? formatAgo(entry.lastUsedAt) : 'never';
  const lastCommand = entry.lastUsedCommand ? clampText(entry.lastUsedCommand, 120) : null;
  const lastPath = entry.lastResolvedPath ? clampText(entry.lastResolvedPath, 120) : null;
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${entry.pattern?.trim() ? entry.pattern : 'New pattern'}</div>
        <div class="list-sub">Last used: ${lastUsed}</div>
        ${lastCommand ? html`<div class="list-sub mono">${lastCommand}</div>` : nothing}
        ${lastPath ? html`<div class="list-sub mono">${lastPath}</div>` : nothing}
      </div>
      <div class="list-meta">
        <label class="field">
          <span>Pattern</span>
          <input
            type="text"
            .value=${entry.pattern ?? ''}
            ?disabled=${state.disabled}
            @input=${(event) => {
              const target = event.target;
              state.onPatch(
                ['agents', state.selectedScope, 'allowlist', index, 'pattern'],
                target.value
              );
            }}
          />
        </label>
        <button
          class="btn btn--sm danger"
          ?disabled=${state.disabled}
          @click=${() => {
            if (state.allowlist.length <= 1) {
              state.onRemove(['agents', state.selectedScope, 'allowlist']);
              return;
            }
            state.onRemove(['agents', state.selectedScope, 'allowlist', index]);
          }}
        >
          Remove
        </button>
      </div>
    </div>
  `;
}
function renderAgentBinding(agent, state) {
  const bindingValue = agent.binding ?? '__default__';
  const label = agent.name?.trim() ? `${agent.name} (${agent.id})` : agent.id;
  const supportsBinding = state.nodes.length > 0;
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${label}</div>
        <div class="list-sub">
          ${agent.isDefault ? 'default agent' : 'agent'} ·
          ${bindingValue === '__default__' ? `uses default (${state.defaultBinding ?? 'any'})` : `override: ${agent.binding}`}
        </div>
      </div>
      <div class="list-meta">
        <label class="field">
          <span>Binding</span>
          <select
            ?disabled=${state.disabled || !supportsBinding}
            @change=${(event) => {
              const target = event.target;
              const value = target.value.trim();
              state.onBindAgent(agent.index, value === '__default__' ? null : value);
            }}
          >
            <option value="__default__" ?selected=${bindingValue === '__default__'}>
              Use default
            </option>
            ${state.nodes.map(
              (node) => html`<option
                  value=${node.id}
                  ?selected=${bindingValue === node.id}
                >
                  ${node.label}
                </option>`
            )}
          </select>
        </label>
      </div>
    </div>
  `;
}
function resolveExecNodes(nodes) {
  const list = [];
  for (const node of nodes) {
    const commands = Array.isArray(node.commands) ? node.commands : [];
    const supports = commands.some((cmd) => String(cmd) === 'system.run');
    if (!supports) {
      continue;
    }
    const nodeId = typeof node.nodeId === 'string' ? node.nodeId.trim() : '';
    if (!nodeId) {
      continue;
    }
    const displayName = typeof node.displayName === 'string' && node.displayName.trim() ? node.displayName.trim() : nodeId;
    list.push({
      id: nodeId,
      label: displayName === nodeId ? nodeId : `${displayName} \xB7 ${nodeId}`
    });
  }
  list.sort((a, b) => a.label.localeCompare(b.label));
  return list;
}
function resolveExecApprovalsNodes(nodes) {
  const list = [];
  for (const node of nodes) {
    const commands = Array.isArray(node.commands) ? node.commands : [];
    const supports = commands.some(
      (cmd) => String(cmd) === 'system.execApprovals.get' || String(cmd) === 'system.execApprovals.set'
    );
    if (!supports) {
      continue;
    }
    const nodeId = typeof node.nodeId === 'string' ? node.nodeId.trim() : '';
    if (!nodeId) {
      continue;
    }
    const displayName = typeof node.displayName === 'string' && node.displayName.trim() ? node.displayName.trim() : nodeId;
    list.push({
      id: nodeId,
      label: displayName === nodeId ? nodeId : `${displayName} \xB7 ${nodeId}`
    });
  }
  list.sort((a, b) => a.label.localeCompare(b.label));
  return list;
}
function resolveAgentBindings(config) {
  const fallbackAgent = {
    id: 'main',
    name: void 0,
    index: 0,
    isDefault: true,
    binding: null
  };
  if (!config || typeof config !== 'object') {
    return { defaultBinding: null, agents: [fallbackAgent] };
  }
  const tools = config.tools ?? {};
  const exec = tools.exec ?? {};
  const defaultBinding = typeof exec.node === 'string' && exec.node.trim() ? exec.node.trim() : null;
  const agentsNode = config.agents ?? {};
  const list = Array.isArray(agentsNode.list) ? agentsNode.list : [];
  if (list.length === 0) {
    return { defaultBinding, agents: [fallbackAgent] };
  }
  const agents = [];
  list.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const record = entry;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (!id) {
      return;
    }
    const name = typeof record.name === 'string' ? record.name.trim() : void 0;
    const isDefault = record.default === true;
    const toolsEntry = record.tools ?? {};
    const execEntry = toolsEntry.exec ?? {};
    const binding = typeof execEntry.node === 'string' && execEntry.node.trim() ? execEntry.node.trim() : null;
    agents.push({
      id,
      name: name || void 0,
      index,
      isDefault,
      binding
    });
  });
  if (agents.length === 0) {
    agents.push(fallbackAgent);
  }
  return { defaultBinding, agents };
}
function renderNode(node) {
  const connected = Boolean(node.connected);
  const paired = Boolean(node.paired);
  const title = typeof node.displayName === 'string' && node.displayName.trim() || (typeof node.nodeId === 'string' ? node.nodeId : 'unknown');
  const caps = Array.isArray(node.caps) ? node.caps : [];
  const commands = Array.isArray(node.commands) ? node.commands : [];
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${title}</div>
        <div class="list-sub">
          ${typeof node.nodeId === 'string' ? node.nodeId : ''}
          ${typeof node.remoteIp === 'string' ? ` \xB7 ${node.remoteIp}` : ''}
          ${typeof node.version === 'string' ? ` \xB7 ${node.version}` : ''}
        </div>
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${paired ? 'paired' : 'unpaired'}</span>
          <span class="chip ${connected ? 'chip-ok' : 'chip-warn'}">
            ${connected ? 'connected' : 'offline'}
          </span>
          ${caps.slice(0, 12).map((c) => html`<span class="chip">${String(c)}</span>`)}
          ${commands.slice(0, 8).map((c) => html`<span class="chip">${String(c)}</span>`)}
        </div>
      </div>
    </div>
  `;
}
export {
  renderNodes
};
