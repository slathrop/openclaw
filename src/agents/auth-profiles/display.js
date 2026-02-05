/**
 * Display label resolution for auth profiles.
 * @param params
 * @module agents/auth-profiles/display
 */
function resolveAuthProfileDisplayLabel(params) {
  const { cfg, store, profileId } = params;
  const profile = store.profiles[profileId];
  const configEmail = cfg?.auth?.profiles?.[profileId]?.email?.trim();
  const email = configEmail || (profile && 'email' in profile ? profile.email?.trim() : void 0);
  if (email) {
    return `${profileId} (${email})`;
  }
  return profileId;
}
export {
  resolveAuthProfileDisplayLabel
};
