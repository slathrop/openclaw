/**
 * @param path
 * @param fallback
 * @module plugins/http-path - Plugin HTTP path normalization.
 */
function normalizePluginHttpPath(path, fallback) {
  const trimmed = path?.trim();
  if (!trimmed) {
    const fallbackTrimmed = fallback?.trim();
    if (!fallbackTrimmed) {
      return null;
    }
    return fallbackTrimmed.startsWith('/') ? fallbackTrimmed : `/${fallbackTrimmed}`;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
export {
  normalizePluginHttpPath
};
