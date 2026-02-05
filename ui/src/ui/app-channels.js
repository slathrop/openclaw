import {
  loadChannels,
  logoutWhatsApp,
  startWhatsAppLogin,
  waitWhatsAppLogin
} from './controllers/channels.js';
import { loadConfig, saveConfig } from './controllers/config.js';
import { createNostrProfileFormState } from './views/channels.nostr-profile-form.js';
async function handleWhatsAppStart(host, force) {
  await startWhatsAppLogin(host, force);
  await loadChannels(host, true);
}
async function handleWhatsAppWait(host) {
  await waitWhatsAppLogin(host);
  await loadChannels(host, true);
}
async function handleWhatsAppLogout(host) {
  await logoutWhatsApp(host);
  await loadChannels(host, true);
}
async function handleChannelConfigSave(host) {
  await saveConfig(host);
  await loadConfig(host);
  await loadChannels(host, true);
}
async function handleChannelConfigReload(host) {
  await loadConfig(host);
  await loadChannels(host, true);
}
function parseValidationErrors(details) {
  if (!Array.isArray(details)) {
    return {};
  }
  const errors = {};
  for (const entry of details) {
    if (typeof entry !== 'string') {
      continue;
    }
    const [rawField, ...rest] = entry.split(':');
    if (!rawField || rest.length === 0) {
      continue;
    }
    const field = rawField.trim();
    const message = rest.join(':').trim();
    if (field && message) {
      errors[field] = message;
    }
  }
  return errors;
}
function resolveNostrAccountId(host) {
  const accounts = host.channelsSnapshot?.channelAccounts?.nostr ?? [];
  return accounts[0]?.accountId ?? host.nostrProfileAccountId ?? 'default';
}
function buildNostrProfileUrl(accountId, suffix = '') {
  return `/api/channels/nostr/${encodeURIComponent(accountId)}/profile${suffix}`;
}
function handleNostrProfileEdit(host, accountId, profile) {
  host.nostrProfileAccountId = accountId;
  host.nostrProfileFormState = createNostrProfileFormState(profile ?? void 0);
}
function handleNostrProfileCancel(host) {
  host.nostrProfileFormState = null;
  host.nostrProfileAccountId = null;
}
function handleNostrProfileFieldChange(host, field, value) {
  const state = host.nostrProfileFormState;
  if (!state) {
    return;
  }
  host.nostrProfileFormState = {
    ...state,
    values: {
      ...state.values,
      [field]: value
    },
    fieldErrors: {
      ...state.fieldErrors,
      [field]: ''
    }
  };
}
function handleNostrProfileToggleAdvanced(host) {
  const state = host.nostrProfileFormState;
  if (!state) {
    return;
  }
  host.nostrProfileFormState = {
    ...state,
    showAdvanced: !state.showAdvanced
  };
}
async function handleNostrProfileSave(host) {
  const state = host.nostrProfileFormState;
  if (!state || state.saving) {
    return;
  }
  const accountId = resolveNostrAccountId(host);
  host.nostrProfileFormState = {
    ...state,
    saving: true,
    error: null,
    success: null,
    fieldErrors: {}
  };
  try {
    const response = await fetch(buildNostrProfileUrl(accountId), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(state.values)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false || !data) {
      const errorMessage = data?.error ?? `Profile update failed (${response.status})`;
      host.nostrProfileFormState = {
        ...state,
        saving: false,
        error: errorMessage,
        success: null,
        fieldErrors: parseValidationErrors(data?.details)
      };
      return;
    }
    if (!data.persisted) {
      host.nostrProfileFormState = {
        ...state,
        saving: false,
        error: 'Profile publish failed on all relays.',
        success: null
      };
      return;
    }
    host.nostrProfileFormState = {
      ...state,
      saving: false,
      error: null,
      success: 'Profile published to relays.',
      fieldErrors: {},
      original: { ...state.values }
    };
    await loadChannels(host, true);
  } catch (err) {
    host.nostrProfileFormState = {
      ...state,
      saving: false,
      error: `Profile update failed: ${String(err)}`,
      success: null
    };
  }
}
async function handleNostrProfileImport(host) {
  const state = host.nostrProfileFormState;
  if (!state || state.importing) {
    return;
  }
  const accountId = resolveNostrAccountId(host);
  host.nostrProfileFormState = {
    ...state,
    importing: true,
    error: null,
    success: null
  };
  try {
    const response = await fetch(buildNostrProfileUrl(accountId, '/import'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ autoMerge: true })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false || !data) {
      const errorMessage = data?.error ?? `Profile import failed (${response.status})`;
      host.nostrProfileFormState = {
        ...state,
        importing: false,
        error: errorMessage,
        success: null
      };
      return;
    }
    const merged = data.merged ?? data.imported ?? null;
    const nextValues = merged ? { ...state.values, ...merged } : state.values;
    const showAdvanced = Boolean(
      nextValues.banner || nextValues.website || nextValues.nip05 || nextValues.lud16
    );
    host.nostrProfileFormState = {
      ...state,
      importing: false,
      values: nextValues,
      error: null,
      success: data.saved ? 'Profile imported from relays. Review and publish.' : 'Profile imported. Review and publish.',
      showAdvanced
    };
    if (data.saved) {
      await loadChannels(host, true);
    }
  } catch (err) {
    host.nostrProfileFormState = {
      ...state,
      importing: false,
      error: `Profile import failed: ${String(err)}`,
      success: null
    };
  }
}
export {
  handleChannelConfigReload,
  handleChannelConfigSave,
  handleNostrProfileCancel,
  handleNostrProfileEdit,
  handleNostrProfileFieldChange,
  handleNostrProfileImport,
  handleNostrProfileSave,
  handleNostrProfileToggleAdvanced,
  handleWhatsAppLogout,
  handleWhatsAppStart,
  handleWhatsAppWait
};
