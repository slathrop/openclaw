/**
 * @module auth-profiles
 * Authentication profile storage and resolution for model providers.
 *
 * SECURITY: Manages stored authentication profiles for model providers.
 *
 * SECURITY: Profile credentials read from disk -- file permissions should restrict access.
 */
import { CLAUDE_CLI_PROFILE_ID, CODEX_CLI_PROFILE_ID } from './auth-profiles/constants.js';
import { resolveAuthProfileDisplayLabel } from './auth-profiles/display.js';
import { formatAuthDoctorHint } from './auth-profiles/doctor.js';
import { resolveApiKeyForProfile } from './auth-profiles/oauth.js';
import { resolveAuthProfileOrder } from './auth-profiles/order.js';
import { resolveAuthStorePathForDisplay } from './auth-profiles/paths.js';
import {
  listProfilesForProvider,
  markAuthProfileGood,
  setAuthProfileOrder,
  upsertAuthProfile
} from './auth-profiles/profiles.js';
import {
  repairOAuthProfileIdMismatch,
  suggestOAuthProfileIdForLegacyDefault
} from './auth-profiles/repair.js';
import {
  ensureAuthProfileStore,
  loadAuthProfileStore,
  saveAuthProfileStore
} from './auth-profiles/store.js';
import {
  calculateAuthProfileCooldownMs,
  clearAuthProfileCooldown,
  isProfileInCooldown,
  markAuthProfileCooldown,
  markAuthProfileFailure,
  markAuthProfileUsed,
  resolveProfileUnusableUntilForDisplay
} from './auth-profiles/usage.js';
export {
  CLAUDE_CLI_PROFILE_ID,
  CODEX_CLI_PROFILE_ID,
  calculateAuthProfileCooldownMs,
  clearAuthProfileCooldown,
  ensureAuthProfileStore,
  formatAuthDoctorHint,
  isProfileInCooldown,
  listProfilesForProvider,
  loadAuthProfileStore,
  markAuthProfileCooldown,
  markAuthProfileFailure,
  markAuthProfileGood,
  markAuthProfileUsed,
  repairOAuthProfileIdMismatch,
  resolveApiKeyForProfile,
  resolveAuthProfileDisplayLabel,
  resolveAuthProfileOrder,
  resolveAuthStorePathForDisplay,
  resolveProfileUnusableUntilForDisplay,
  saveAuthProfileStore,
  setAuthProfileOrder,
  suggestOAuthProfileIdForLegacyDefault,
  upsertAuthProfile
};
