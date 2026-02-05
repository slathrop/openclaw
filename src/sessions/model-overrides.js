/**
 * Session model override management.
 *
 * Applies provider/model selection overrides to session entries,
 * including auth profile routing. Tracks whether any field was
 * actually modified for change detection.
 * @typedef {object} ModelOverrideSelection
 * @property {string} provider
 * @property {string} model
 * @property {boolean} [isDefault]
 */

/**
 * @param {object} params
 * @param {object} params.entry
 * @param {ModelOverrideSelection} params.selection
 * @param {string} [params.profileOverride]
 * @param {"auto" | "user"} [params.profileOverrideSource]
 * @returns {{ updated: boolean }}
 */
export const applyModelOverrideToSessionEntry = (params) => {
  const { entry, selection, profileOverride } = params;
  const profileOverrideSource = params.profileOverrideSource ?? 'user';
  let updated = false;

  if (selection.isDefault) {
    if (entry.providerOverride) {
      delete entry.providerOverride;
      updated = true;
    }
    if (entry.modelOverride) {
      delete entry.modelOverride;
      updated = true;
    }
  } else {
    if (entry.providerOverride !== selection.provider) {
      entry.providerOverride = selection.provider;
      updated = true;
    }
    if (entry.modelOverride !== selection.model) {
      entry.modelOverride = selection.model;
      updated = true;
    }
  }

  if (profileOverride) {
    if (entry.authProfileOverride !== profileOverride) {
      entry.authProfileOverride = profileOverride;
      updated = true;
    }
    if (entry.authProfileOverrideSource !== profileOverrideSource) {
      entry.authProfileOverrideSource = profileOverrideSource;
      updated = true;
    }
    if (entry.authProfileOverrideCompactionCount !== undefined) {
      delete entry.authProfileOverrideCompactionCount;
      updated = true;
    }
  } else {
    if (entry.authProfileOverride) {
      delete entry.authProfileOverride;
      updated = true;
    }
    if (entry.authProfileOverrideSource) {
      delete entry.authProfileOverrideSource;
      updated = true;
    }
    if (entry.authProfileOverrideCompactionCount !== undefined) {
      delete entry.authProfileOverrideCompactionCount;
      updated = true;
    }
  }

  if (updated) {
    entry.updatedAt = Date.now();
  }

  return { updated };
};
