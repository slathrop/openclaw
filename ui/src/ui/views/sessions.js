import { html, nothing } from 'lit';
import { formatAgo } from '../format.js';
import { pathForTab } from '../navigation.js';
import { formatSessionTokens } from '../presenter.js';
const THINK_LEVELS = ['', 'off', 'minimal', 'low', 'medium', 'high'];
const BINARY_THINK_LEVELS = ['', 'off', 'on'];
const VERBOSE_LEVELS = [
  { value: '', label: 'inherit' },
  { value: 'off', label: 'off (explicit)' },
  { value: 'on', label: 'on' }
];
const REASONING_LEVELS = ['', 'off', 'on', 'stream'];
function normalizeProviderId(provider) {
  if (!provider) {
    return '';
  }
  const normalized = provider.trim().toLowerCase();
  if (normalized === 'z.ai' || normalized === 'z-ai') {
    return 'zai';
  }
  return normalized;
}
function isBinaryThinkingProvider(provider) {
  return normalizeProviderId(provider) === 'zai';
}
function resolveThinkLevelOptions(provider) {
  return isBinaryThinkingProvider(provider) ? BINARY_THINK_LEVELS : THINK_LEVELS;
}
function resolveThinkLevelDisplay(value, isBinary) {
  if (!isBinary) {
    return value;
  }
  if (!value || value === 'off') {
    return value;
  }
  return 'on';
}
function resolveThinkLevelPatchValue(value, isBinary) {
  if (!value) {
    return null;
  }
  if (!isBinary) {
    return value;
  }
  if (value === 'on') {
    return 'low';
  }
  return value;
}
function renderSessions(props) {
  const rows = props.result?.sessions ?? [];
  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Sessions</div>
          <div class="card-sub">Active session keys and per-session overrides.</div>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? 'Loading\u2026' : 'Refresh'}
        </button>
      </div>

      <div class="filters" style="margin-top: 14px;">
        <label class="field">
          <span>Active within (minutes)</span>
          <input
            .value=${props.activeMinutes}
            @input=${(e) => props.onFiltersChange({
              activeMinutes: e.target.value,
              limit: props.limit,
              includeGlobal: props.includeGlobal,
              includeUnknown: props.includeUnknown
            })}
          />
        </label>
        <label class="field">
          <span>Limit</span>
          <input
            .value=${props.limit}
            @input=${(e) => props.onFiltersChange({
              activeMinutes: props.activeMinutes,
              limit: e.target.value,
              includeGlobal: props.includeGlobal,
              includeUnknown: props.includeUnknown
            })}
          />
        </label>
        <label class="field checkbox">
          <span>Include global</span>
          <input
            type="checkbox"
            .checked=${props.includeGlobal}
            @change=${(e) => props.onFiltersChange({
              activeMinutes: props.activeMinutes,
              limit: props.limit,
              includeGlobal: e.target.checked,
              includeUnknown: props.includeUnknown
            })}
          />
        </label>
        <label class="field checkbox">
          <span>Include unknown</span>
          <input
            type="checkbox"
            .checked=${props.includeUnknown}
            @change=${(e) => props.onFiltersChange({
              activeMinutes: props.activeMinutes,
              limit: props.limit,
              includeGlobal: props.includeGlobal,
              includeUnknown: e.target.checked
            })}
          />
        </label>
      </div>

      ${props.error ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>` : nothing}

      <div class="muted" style="margin-top: 12px;">
        ${props.result ? `Store: ${props.result.path}` : ''}
      </div>

      <div class="table" style="margin-top: 16px;">
        <div class="table-head">
          <div>Key</div>
          <div>Label</div>
          <div>Kind</div>
          <div>Updated</div>
          <div>Tokens</div>
          <div>Thinking</div>
          <div>Verbose</div>
          <div>Reasoning</div>
          <div>Actions</div>
        </div>
        ${rows.length === 0 ? html`
                <div class="muted">No sessions found.</div>
              ` : rows.map(
          (row) => renderRow(row, props.basePath, props.onPatch, props.onDelete, props.loading)
        )}
      </div>
    </section>
  `;
}
function renderRow(row, basePath, onPatch, onDelete, disabled) {
  const updated = row.updatedAt ? formatAgo(row.updatedAt) : 'n/a';
  const rawThinking = row.thinkingLevel ?? '';
  const isBinaryThinking = isBinaryThinkingProvider(row.modelProvider);
  const thinking = resolveThinkLevelDisplay(rawThinking, isBinaryThinking);
  const thinkLevels = resolveThinkLevelOptions(row.modelProvider);
  const verbose = row.verboseLevel ?? '';
  const reasoning = row.reasoningLevel ?? '';
  const displayName = row.displayName ?? row.key;
  const canLink = row.kind !== 'global';
  const chatUrl = canLink ? `${pathForTab('chat', basePath)}?session=${encodeURIComponent(row.key)}` : null;
  return html`
    <div class="table-row">
      <div class="mono">${canLink ? html`<a href=${chatUrl} class="session-link">${displayName}</a>` : displayName}</div>
      <div>
        <input
          .value=${row.label ?? ''}
          ?disabled=${disabled}
          placeholder="(optional)"
          @change=${(e) => {
            const value = e.target.value.trim();
            onPatch(row.key, { label: value || null });
          }}
        />
      </div>
      <div>${row.kind}</div>
      <div>${updated}</div>
      <div>${formatSessionTokens(row)}</div>
      <div>
        <select
          .value=${thinking}
          ?disabled=${disabled}
          @change=${(e) => {
            const value = e.target.value;
            onPatch(row.key, {
              thinkingLevel: resolveThinkLevelPatchValue(value, isBinaryThinking)
            });
          }}
        >
          ${thinkLevels.map((level) => html`<option value=${level}>${level || 'inherit'}</option>`)}
        </select>
      </div>
      <div>
        <select
          .value=${verbose}
          ?disabled=${disabled}
          @change=${(e) => {
            const value = e.target.value;
            onPatch(row.key, { verboseLevel: value || null });
          }}
        >
          ${VERBOSE_LEVELS.map(
            (level) => html`<option value=${level.value}>${level.label}</option>`
          )}
        </select>
      </div>
      <div>
        <select
          .value=${reasoning}
          ?disabled=${disabled}
          @change=${(e) => {
            const value = e.target.value;
            onPatch(row.key, { reasoningLevel: value || null });
          }}
        >
          ${REASONING_LEVELS.map(
            (level) => html`<option value=${level}>${level || 'inherit'}</option>`
          )}
        </select>
      </div>
      <div>
        <button class="btn danger" ?disabled=${disabled} @click=${() => onDelete(row.key)}>
          Delete
        </button>
      </div>
    </div>
  `;
}
export {
  renderSessions
};
