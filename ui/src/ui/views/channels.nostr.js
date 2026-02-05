import { html, nothing } from 'lit';
import { formatAgo } from '../format.js';
import { renderChannelConfigSection } from './channels.config.js';
import {
  renderNostrProfileForm
} from './channels.nostr-profile-form.js';
function truncatePubkey(pubkey) {
  if (!pubkey) {
    return 'n/a';
  }
  if (pubkey.length <= 20) {
    return pubkey;
  }
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
}
function renderNostrCard(params) {
  const {
    props,
    nostr,
    nostrAccounts,
    accountCountLabel,
    profileFormState,
    profileFormCallbacks,
    onEditProfile
  } = params;
  const primaryAccount = nostrAccounts[0];
  const summaryConfigured = nostr?.configured ?? primaryAccount?.configured ?? false;
  const summaryRunning = nostr?.running ?? primaryAccount?.running ?? false;
  const summaryPublicKey = nostr?.publicKey ?? primaryAccount?.publicKey;
  const summaryLastStartAt = nostr?.lastStartAt ?? primaryAccount?.lastStartAt ?? null;
  const summaryLastError = nostr?.lastError ?? primaryAccount?.lastError ?? null;
  const hasMultipleAccounts = nostrAccounts.length > 1;
  const showingForm = profileFormState !== null && profileFormState !== void 0;
  const renderAccountCard = (account) => {
    const publicKey = account.publicKey;
    const profile = account.profile;
    const displayName = profile?.displayName ?? profile?.name ?? account.name ?? account.accountId;
    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">${displayName}</div>
          <div class="account-card-id">${account.accountId}</div>
        </div>
        <div class="status-list account-card-status">
          <div>
            <span class="label">Running</span>
            <span>${account.running ? 'Yes' : 'No'}</span>
          </div>
          <div>
            <span class="label">Configured</span>
            <span>${account.configured ? 'Yes' : 'No'}</span>
          </div>
          <div>
            <span class="label">Public Key</span>
            <span class="monospace" title="${publicKey ?? ''}">${truncatePubkey(publicKey)}</span>
          </div>
          <div>
            <span class="label">Last inbound</span>
            <span>${account.lastInboundAt ? formatAgo(account.lastInboundAt) : 'n/a'}</span>
          </div>
          ${account.lastError ? html`
                <div class="account-card-error">${account.lastError}</div>
              ` : nothing}
        </div>
      </div>
    `;
  };
  const renderProfileSection = () => {
    if (showingForm && profileFormCallbacks) {
      return renderNostrProfileForm({
        state: profileFormState,
        callbacks: profileFormCallbacks,
        accountId: nostrAccounts[0]?.accountId ?? 'default'
      });
    }
    const profile = primaryAccount?.profile ?? nostr?.profile;
    const { name, displayName, about, picture, nip05 } = profile ?? {};
    const hasAnyProfileData = name || displayName || about || picture || nip05;
    return html`
      <div style="margin-top: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-weight: 500;">Profile</div>
          ${summaryConfigured ? html`
                <button
                  class="btn btn-sm"
                  @click=${onEditProfile}
                  style="font-size: 12px; padding: 4px 8px;"
                >
                  Edit Profile
                </button>
              ` : nothing}
        </div>
        ${hasAnyProfileData ? html`
              <div class="status-list">
                ${picture ? html`
                      <div style="margin-bottom: 8px;">
                        <img
                          src=${picture}
                          alt="Profile picture"
                          style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);"
                          @error=${(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    ` : nothing}
                ${name ? html`<div><span class="label">Name</span><span>${name}</span></div>` : nothing}
                ${displayName ? html`<div><span class="label">Display Name</span><span>${displayName}</span></div>` : nothing}
                ${about ? html`<div><span class="label">About</span><span style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${about}</span></div>` : nothing}
                ${nip05 ? html`<div><span class="label">NIP-05</span><span>${nip05}</span></div>` : nothing}
              </div>
            ` : html`
                <div style="color: var(--text-muted); font-size: 13px">
                  No profile set. Click "Edit Profile" to add your name, bio, and avatar.
                </div>
              `}
      </div>
    `;
  };
  return html`
    <div class="card">
      <div class="card-title">Nostr</div>
      <div class="card-sub">Decentralized DMs via Nostr relays (NIP-04).</div>
      ${accountCountLabel}

      ${hasMultipleAccounts ? html`
            <div class="account-card-list">
              ${nostrAccounts.map((account) => renderAccountCard(account))}
            </div>
          ` : html`
            <div class="status-list" style="margin-top: 16px;">
              <div>
                <span class="label">Configured</span>
                <span>${summaryConfigured ? 'Yes' : 'No'}</span>
              </div>
              <div>
                <span class="label">Running</span>
                <span>${summaryRunning ? 'Yes' : 'No'}</span>
              </div>
              <div>
                <span class="label">Public Key</span>
                <span class="monospace" title="${summaryPublicKey ?? ''}"
                  >${truncatePubkey(summaryPublicKey)}</span
                >
              </div>
              <div>
                <span class="label">Last start</span>
                <span>${summaryLastStartAt ? formatAgo(summaryLastStartAt) : 'n/a'}</span>
              </div>
            </div>
          `}

      ${summaryLastError ? html`<div class="callout danger" style="margin-top: 12px;">${summaryLastError}</div>` : nothing}

      ${renderProfileSection()}

      ${renderChannelConfigSection({ channelId: 'nostr', props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(false)}>Refresh</button>
      </div>
    </div>
  `;
}
export {
  renderNostrCard
};
