/**
 * Config section merge utilities for partial config updates.
 *
 * Provides shallow section merging with optional unset-on-undefined
 * semantics, plus a WhatsApp-specific convenience wrapper.
 */

/**
 * Merges a partial patch into a config section, optionally deleting keys set to undefined.
 * @param {Record<string, unknown> | undefined} base
 * @param {Record<string, unknown>} patch
 * @param {{ unsetOnUndefined?: string[] }} [options]
 * @returns {Record<string, unknown>}
 */
export function mergeConfigSection(
  base,
  patch,
  options = {}
) {
  const next = { ...(base ?? undefined) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      if (options.unsetOnUndefined?.includes(key)) {
        delete next[key];
      }
      continue;
    }
    next[key] = value;
  }
  return next;
}

/**
 * Merges a partial WhatsApp config patch into the full config.
 * @param {import("./config.js").OpenClawConfig} cfg
 * @param {Record<string, unknown>} patch
 * @param {{ unsetOnUndefined?: string[] }} [options]
 * @returns {import("./config.js").OpenClawConfig}
 */
export function mergeWhatsAppConfig(
  cfg,
  patch,
  options
) {
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      whatsapp: mergeConfigSection(cfg.channels?.whatsapp, patch, options)
    }
  };
}
