import { html, nothing } from 'lit';
import { formatMs } from '../format.js';
import {
  formatCronPayload,
  formatCronSchedule,
  formatCronState,
  formatNextRun
} from '../presenter.js';
function buildChannelOptions(props) {
  const options = ['last', ...props.channels.filter(Boolean)];
  const current = props.form.deliveryChannel?.trim();
  if (current && !options.includes(current)) {
    options.push(current);
  }
  const seen = /* @__PURE__ */ new Set();
  return options.filter((value) => {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}
function resolveChannelLabel(props, channel) {
  if (channel === 'last') {
    return 'last';
  }
  const meta = props.channelMeta?.find((entry) => entry.id === channel);
  if (meta?.label) {
    return meta.label;
  }
  return props.channelLabels?.[channel] ?? channel;
}
function renderCron(props) {
  const channelOptions = buildChannelOptions(props);
  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">Scheduler</div>
        <div class="card-sub">Gateway-owned cron scheduler status.</div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Enabled</div>
            <div class="stat-value">
              ${props.status ? props.status.enabled ? 'Yes' : 'No' : 'n/a'}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Jobs</div>
            <div class="stat-value">${props.status?.jobs ?? 'n/a'}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Next wake</div>
            <div class="stat-value">${formatNextRun(props.status?.nextWakeAtMs ?? null)}</div>
          </div>
        </div>
        <div class="row" style="margin-top: 12px;">
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? 'Refreshing\u2026' : 'Refresh'}
          </button>
          ${props.error ? html`<span class="muted">${props.error}</span>` : nothing}
        </div>
      </div>

      <div class="card">
        <div class="card-title">New Job</div>
        <div class="card-sub">Create a scheduled wakeup or agent run.</div>
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>Name</span>
            <input
              .value=${props.form.name}
              @input=${(e) => props.onFormChange({ name: e.target.value })}
            />
          </label>
          <label class="field">
            <span>Description</span>
            <input
              .value=${props.form.description}
              @input=${(e) => props.onFormChange({ description: e.target.value })}
            />
          </label>
          <label class="field">
            <span>Agent ID</span>
            <input
              .value=${props.form.agentId}
              @input=${(e) => props.onFormChange({ agentId: e.target.value })}
              placeholder="default"
            />
          </label>
          <label class="field checkbox">
            <span>Enabled</span>
            <input
              type="checkbox"
              .checked=${props.form.enabled}
              @change=${(e) => props.onFormChange({ enabled: e.target.checked })}
            />
          </label>
          <label class="field">
            <span>Schedule</span>
            <select
              .value=${props.form.scheduleKind}
              @change=${(e) => props.onFormChange({
                scheduleKind: e.target.value
              })}
            >
              <option value="every">Every</option>
              <option value="at">At</option>
              <option value="cron">Cron</option>
            </select>
          </label>
        </div>
        ${renderScheduleFields(props)}
        <div class="form-grid" style="margin-top: 12px;">
          <label class="field">
            <span>Session</span>
            <select
              .value=${props.form.sessionTarget}
              @change=${(e) => props.onFormChange({
                sessionTarget: e.target.value
              })}
            >
              <option value="main">Main</option>
              <option value="isolated">Isolated</option>
            </select>
          </label>
          <label class="field">
            <span>Wake mode</span>
            <select
              .value=${props.form.wakeMode}
              @change=${(e) => props.onFormChange({
                wakeMode: e.target.value
              })}
            >
              <option value="next-heartbeat">Next heartbeat</option>
              <option value="now">Now</option>
            </select>
          </label>
          <label class="field">
            <span>Payload</span>
            <select
              .value=${props.form.payloadKind}
              @change=${(e) => props.onFormChange({
                payloadKind: e.target.value
              })}
            >
              <option value="systemEvent">System event</option>
              <option value="agentTurn">Agent turn</option>
            </select>
          </label>
        </div>
        <label class="field" style="margin-top: 12px;">
          <span>${props.form.payloadKind === 'systemEvent' ? 'System text' : 'Agent message'}</span>
          <textarea
            .value=${props.form.payloadText}
            @input=${(e) => props.onFormChange({
              payloadText: e.target.value
            })}
            rows="4"
          ></textarea>
        </label>
        ${props.form.payloadKind === 'agentTurn' ? html`
                <div class="form-grid" style="margin-top: 12px;">
                  <label class="field">
                    <span>Delivery</span>
                    <select
                      .value=${props.form.deliveryMode}
                      @change=${(e) => props.onFormChange({
                        deliveryMode: e.target.value
                      })}
                    >
                      <option value="announce">Announce summary (default)</option>
                      <option value="none">None (internal)</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Timeout (seconds)</span>
                    <input
                      .value=${props.form.timeoutSeconds}
                      @input=${(e) => props.onFormChange({
                        timeoutSeconds: e.target.value
                      })}
                    />
                  </label>
                  ${props.form.deliveryMode === 'announce' ? html`
                          <label class="field">
                            <span>Channel</span>
                            <select
                              .value=${props.form.deliveryChannel || 'last'}
                              @change=${(e) => props.onFormChange({
                                deliveryChannel: e.target.value
                              })}
                            >
                              ${channelOptions.map(
                                (channel) => html`<option value=${channel}>
                                    ${resolveChannelLabel(props, channel)}
                                  </option>`
                              )}
                            </select>
                          </label>
                          <label class="field">
                            <span>To</span>
                            <input
                              .value=${props.form.deliveryTo}
                              @input=${(e) => props.onFormChange({
                                deliveryTo: e.target.value
                              })}
                              placeholder="+1555… or chat id"
                            />
                          </label>
                        ` : nothing}
                </div>
              ` : nothing}
        <div class="row" style="margin-top: 14px;">
          <button class="btn primary" ?disabled=${props.busy} @click=${props.onAdd}>
            ${props.busy ? 'Saving\u2026' : 'Add job'}
          </button>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Jobs</div>
      <div class="card-sub">All scheduled jobs stored in the gateway.</div>
      ${props.jobs.length === 0 ? html`
              <div class="muted" style="margin-top: 12px">No jobs yet.</div>
            ` : html`
            <div class="list" style="margin-top: 12px;">
              ${props.jobs.map((job) => renderJob(job, props))}
            </div>
          `}
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Run history</div>
      <div class="card-sub">Latest runs for ${props.runsJobId ?? '(select a job)'}.</div>
      ${props.runsJobId === null || props.runsJobId === undefined ? html`
              <div class="muted" style="margin-top: 12px">Select a job to inspect run history.</div>
            ` : props.runs.length === 0 ? html`
                <div class="muted" style="margin-top: 12px">No runs yet.</div>
              ` : html`
              <div class="list" style="margin-top: 12px;">
                ${props.runs.map((entry) => renderRun(entry))}
              </div>
            `}
    </section>
  `;
}
function renderScheduleFields(props) {
  const form = props.form;
  if (form.scheduleKind === 'at') {
    return html`
      <label class="field" style="margin-top: 12px;">
        <span>Run at</span>
        <input
          type="datetime-local"
          .value=${form.scheduleAt}
          @input=${(e) => props.onFormChange({
            scheduleAt: e.target.value
          })}
        />
      </label>
    `;
  }
  if (form.scheduleKind === 'every') {
    return html`
      <div class="form-grid" style="margin-top: 12px;">
        <label class="field">
          <span>Every</span>
          <input
            .value=${form.everyAmount}
            @input=${(e) => props.onFormChange({
              everyAmount: e.target.value
            })}
          />
        </label>
        <label class="field">
          <span>Unit</span>
          <select
            .value=${form.everyUnit}
            @change=${(e) => props.onFormChange({
              everyUnit: e.target.value
            })}
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </label>
      </div>
    `;
  }
  return html`
    <div class="form-grid" style="margin-top: 12px;">
      <label class="field">
        <span>Expression</span>
        <input
          .value=${form.cronExpr}
          @input=${(e) => props.onFormChange({ cronExpr: e.target.value })}
        />
      </label>
      <label class="field">
        <span>Timezone (optional)</span>
        <input
          .value=${form.cronTz}
          @input=${(e) => props.onFormChange({ cronTz: e.target.value })}
        />
      </label>
    </div>
  `;
}
function renderJob(job, props) {
  const isSelected = props.runsJobId === job.id;
  const itemClass = `list-item list-item-clickable${isSelected ? ' list-item-selected' : ''}`;
  return html`
    <div class=${itemClass} @click=${() => props.onLoadRuns(job.id)}>
      <div class="list-main">
        <div class="list-title">${job.name}</div>
        <div class="list-sub">${formatCronSchedule(job)}</div>
        <div class="muted">${formatCronPayload(job)}</div>
        ${job.agentId ? html`<div class="muted">Agent: ${job.agentId}</div>` : nothing}
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${job.enabled ? 'enabled' : 'disabled'}</span>
          <span class="chip">${job.sessionTarget}</span>
          <span class="chip">${job.wakeMode}</span>
        </div>
      </div>
      <div class="list-meta">
        <div>${formatCronState(job)}</div>
        <div class="row" style="justify-content: flex-end; margin-top: 8px;">
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event) => {
              event.stopPropagation();
              props.onToggle(job, !job.enabled);
            }}
          >
            ${job.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event) => {
              event.stopPropagation();
              props.onRun(job);
            }}
          >
            Run
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event) => {
              event.stopPropagation();
              props.onLoadRuns(job.id);
            }}
          >
            Runs
          </button>
          <button
            class="btn danger"
            ?disabled=${props.busy}
            @click=${(event) => {
              event.stopPropagation();
              props.onRemove(job);
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  `;
}
function renderRun(entry) {
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${entry.status}</div>
        <div class="list-sub">${entry.summary ?? ''}</div>
      </div>
      <div class="list-meta">
        <div>${formatMs(entry.ts)}</div>
        <div class="muted">${entry.durationMs ?? 0}ms</div>
        ${entry.error ? html`<div class="muted">${entry.error}</div>` : nothing}
      </div>
    </div>
  `;
}
export {
  renderCron
};
