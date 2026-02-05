const ACT_KINDS = [
  'click',
  'close',
  'drag',
  'evaluate',
  'fill',
  'hover',
  'scrollIntoView',
  'press',
  'resize',
  'select',
  'type',
  'wait'
];
function isActKind(value) {
  if (typeof value !== 'string') {
    return false;
  }
  return ACT_KINDS.includes(value);
}
const ALLOWED_CLICK_MODIFIERS = /* @__PURE__ */ new Set([
  'Alt',
  'Control',
  'ControlOrMeta',
  'Meta',
  'Shift'
]);
function parseClickButton(raw) {
  if (raw === 'left' || raw === 'right' || raw === 'middle') {
    return raw;
  }
  return void 0;
}
function parseClickModifiers(raw) {
  const invalid = raw.filter((m) => !ALLOWED_CLICK_MODIFIERS.has(m));
  if (invalid.length) {
    return { error: 'modifiers must be Alt|Control|ControlOrMeta|Meta|Shift' };
  }
  return { modifiers: raw.length ? raw : void 0 };
}
export {
  ACT_KINDS,
  isActKind,
  parseClickButton,
  parseClickModifiers
};
