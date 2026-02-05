const CDP_PORT_RANGE_START = 18800;
const CDP_PORT_RANGE_END = 18899;
const PROFILE_NAME_REGEX = /^[a-z0-9][a-z0-9-]*$/;
function isValidProfileName(name) {
  if (!name || name.length > 64) {
    return false;
  }
  return PROFILE_NAME_REGEX.test(name);
}
function allocateCdpPort(usedPorts, range) {
  const start = range?.start ?? CDP_PORT_RANGE_START;
  const end = range?.end ?? CDP_PORT_RANGE_END;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0) {
    return null;
  }
  if (start > end) {
    return null;
  }
  for (let port = start; port <= end; port++) {
    if (!usedPorts.has(port)) {
      return port;
    }
  }
  return null;
}
function getUsedPorts(profiles) {
  if (!profiles) {
    return /* @__PURE__ */ new Set();
  }
  const used = /* @__PURE__ */ new Set();
  for (const profile of Object.values(profiles)) {
    if (typeof profile.cdpPort === 'number') {
      used.add(profile.cdpPort);
      continue;
    }
    const rawUrl = profile.cdpUrl?.trim();
    if (!rawUrl) {
      continue;
    }
    try {
      const parsed = new URL(rawUrl);
      const port = parsed.port && Number.parseInt(parsed.port, 10) > 0 ? Number.parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80;
      if (!Number.isNaN(port) && port > 0 && port <= 65535) {
        used.add(port);
      }
    } catch {
      // Intentionally ignored
    }
  }
  return used;
}
const PROFILE_COLORS = [
  '#FF4500',
  // Orange-red (openclaw default)
  '#0066CC',
  // Blue
  '#00AA00',
  // Green
  '#9933FF',
  // Purple
  '#FF6699',
  // Pink
  '#00CCCC',
  // Cyan
  '#FF9900',
  // Orange
  '#6666FF',
  // Indigo
  '#CC3366',
  // Magenta
  '#339966'
  // Teal
];
function allocateColor(usedColors) {
  for (const color of PROFILE_COLORS) {
    if (!usedColors.has(color.toUpperCase())) {
      return color;
    }
  }
  const index = usedColors.size % PROFILE_COLORS.length;
  return PROFILE_COLORS[index] ?? PROFILE_COLORS[0];
}
function getUsedColors(profiles) {
  if (!profiles) {
    return /* @__PURE__ */ new Set();
  }
  return new Set(Object.values(profiles).map((p) => p.color.toUpperCase()));
}
export {
  CDP_PORT_RANGE_END,
  CDP_PORT_RANGE_START,
  PROFILE_COLORS,
  PROFILE_NAME_REGEX,
  allocateCdpPort,
  allocateColor,
  getUsedColors,
  getUsedPorts,
  isValidProfileName
};
