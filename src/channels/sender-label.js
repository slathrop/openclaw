function normalize(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : void 0;
}
function resolveSenderLabel(params) {
  const name = normalize(params.name);
  const username = normalize(params.username);
  const tag = normalize(params.tag);
  const e164 = normalize(params.e164);
  const id = normalize(params.id);
  const display = name ?? username ?? tag ?? '';
  const idPart = e164 ?? id ?? '';
  if (display && idPart && display !== idPart) {
    return `${display} (${idPart})`;
  }
  return display || idPart || null;
}
function listSenderLabelCandidates(params) {
  const candidates = /* @__PURE__ */ new Set();
  const name = normalize(params.name);
  const username = normalize(params.username);
  const tag = normalize(params.tag);
  const e164 = normalize(params.e164);
  const id = normalize(params.id);
  if (name) {
    candidates.add(name);
  }
  if (username) {
    candidates.add(username);
  }
  if (tag) {
    candidates.add(tag);
  }
  if (e164) {
    candidates.add(e164);
  }
  if (id) {
    candidates.add(id);
  }
  const resolved = resolveSenderLabel(params);
  if (resolved) {
    candidates.add(resolved);
  }
  return Array.from(candidates);
}
export {
  listSenderLabelCandidates,
  resolveSenderLabel
};
