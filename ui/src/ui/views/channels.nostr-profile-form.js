import { html, nothing } from 'lit';
function isFormDirty(state) {
  const { values, original } = state;
  return values.name !== original.name || values.displayName !== original.displayName || values.about !== original.about || values.picture !== original.picture || values.banner !== original.banner || values.website !== original.website || values.nip05 !== original.nip05 || values.lud16 !== original.lud16;
}
function renderNostrProfileForm(params) {
  const { state, callbacks, accountId } = params;
  const isDirty = isFormDirty(state);
  const renderField = (field, label, opts = {}) => {
    const { type = 'text', placeholder, maxLength, help } = opts;
    const value = state.values[field] ?? '';
    const error = state.fieldErrors[field];
    const inputId = `nostr-profile-${field}`;
    if (type === 'textarea') {
      return html`
        <div class="form-field" style="margin-bottom: 12px;">
          <label for="${inputId}" style="display: block; margin-bottom: 4px; font-weight: 500;">
            ${label}
          </label>
          <textarea
            id="${inputId}"
            .value=${value}
            placeholder=${placeholder ?? ''}
            maxlength=${maxLength ?? 2e3}
            rows="3"
            style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; resize: vertical; font-family: inherit;"
            @input=${(e) => {
              const target = e.target;
              callbacks.onFieldChange(field, target.value);
            }}
            ?disabled=${state.saving}
          ></textarea>
          ${help ? html`<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${help}</div>` : nothing}
          ${error ? html`<div style="font-size: 12px; color: var(--danger-color); margin-top: 2px;">${error}</div>` : nothing}
        </div>
      `;
    }
    return html`
      <div class="form-field" style="margin-bottom: 12px;">
        <label for="${inputId}" style="display: block; margin-bottom: 4px; font-weight: 500;">
          ${label}
        </label>
        <input
          id="${inputId}"
          type=${type}
          .value=${value}
          placeholder=${placeholder ?? ''}
          maxlength=${maxLength ?? 256}
          style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;"
          @input=${(e) => {
            const target = e.target;
            callbacks.onFieldChange(field, target.value);
          }}
          ?disabled=${state.saving}
        />
        ${help ? html`<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${help}</div>` : nothing}
        ${error ? html`<div style="font-size: 12px; color: var(--danger-color); margin-top: 2px;">${error}</div>` : nothing}
      </div>
    `;
  };
  const renderPicturePreview = () => {
    const picture = state.values.picture;
    if (!picture) {
      return nothing;
    }
    return html`
      <div style="margin-bottom: 12px;">
        <img
          src=${picture}
          alt="Profile picture preview"
          style="max-width: 80px; max-height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);"
          @error=${(e) => {
            const img = e.target;
            img.style.display = 'none';
          }}
          @load=${(e) => {
            const img = e.target;
            img.style.display = 'block';
          }}
        />
      </div>
    `;
  };
  return html`
    <div class="nostr-profile-form" style="padding: 16px; background: var(--bg-secondary); border-radius: 8px; margin-top: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="font-weight: 600; font-size: 16px;">Edit Profile</div>
        <div style="font-size: 12px; color: var(--text-muted);">Account: ${accountId}</div>
      </div>

      ${state.error ? html`<div class="callout danger" style="margin-bottom: 12px;">${state.error}</div>` : nothing}

      ${state.success ? html`<div class="callout success" style="margin-bottom: 12px;">${state.success}</div>` : nothing}

      ${renderPicturePreview()}

      ${renderField('name', 'Username', {
        placeholder: 'satoshi',
        maxLength: 256,
        help: 'Short username (e.g., satoshi)'
      })}

      ${renderField('displayName', 'Display Name', {
        placeholder: 'Satoshi Nakamoto',
        maxLength: 256,
        help: 'Your full display name'
      })}

      ${renderField('about', 'Bio', {
        type: 'textarea',
        placeholder: 'Tell people about yourself...',
        maxLength: 2e3,
        help: 'A brief bio or description'
      })}

      ${renderField('picture', 'Avatar URL', {
        type: 'url',
        placeholder: 'https://example.com/avatar.jpg',
        help: 'HTTPS URL to your profile picture'
      })}

      ${state.showAdvanced ? html`
            <div style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 12px;">
              <div style="font-weight: 500; margin-bottom: 12px; color: var(--text-muted);">Advanced</div>

              ${renderField('banner', 'Banner URL', {
                type: 'url',
                placeholder: 'https://example.com/banner.jpg',
                help: 'HTTPS URL to a banner image'
              })}

              ${renderField('website', 'Website', {
                type: 'url',
                placeholder: 'https://example.com',
                help: 'Your personal website'
              })}

              ${renderField('nip05', 'NIP-05 Identifier', {
                placeholder: 'you@example.com',
                help: 'Verifiable identifier (e.g., you@domain.com)'
              })}

              ${renderField('lud16', 'Lightning Address', {
                placeholder: 'you@getalby.com',
                help: 'Lightning address for tips (LUD-16)'
              })}
            </div>
          ` : nothing}

      <div style="display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;">
        <button
          class="btn primary"
          @click=${callbacks.onSave}
          ?disabled=${state.saving || !isDirty}
        >
          ${state.saving ? 'Saving...' : 'Save & Publish'}
        </button>

        <button
          class="btn"
          @click=${callbacks.onImport}
          ?disabled=${state.importing || state.saving}
        >
          ${state.importing ? 'Importing...' : 'Import from Relays'}
        </button>

        <button
          class="btn"
          @click=${callbacks.onToggleAdvanced}
        >
          ${state.showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
        </button>

        <button
          class="btn"
          @click=${callbacks.onCancel}
          ?disabled=${state.saving}
        >
          Cancel
        </button>
      </div>

      ${isDirty ? html`
              <div style="font-size: 12px; color: var(--warning-color); margin-top: 8px">
                You have unsaved changes
              </div>
            ` : nothing}
    </div>
  `;
}
function createNostrProfileFormState(profile) {
  const values = {
    name: profile?.name ?? '',
    displayName: profile?.displayName ?? '',
    about: profile?.about ?? '',
    picture: profile?.picture ?? '',
    banner: profile?.banner ?? '',
    website: profile?.website ?? '',
    nip05: profile?.nip05 ?? '',
    lud16: profile?.lud16 ?? ''
  };
  return {
    values,
    original: { ...values },
    saving: false,
    importing: false,
    error: null,
    success: null,
    fieldErrors: {},
    showAdvanced: Boolean(profile?.banner || profile?.website || profile?.nip05 || profile?.lud16)
  };
}
export {
  createNostrProfileFormState,
  renderNostrProfileForm
};
