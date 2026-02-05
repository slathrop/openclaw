function normalizeFeishuTarget(raw) {
  let normalized = raw.replace(/^(feishu|lark):/i, '').trim();
  normalized = normalized.replace(/^(group|chat|user|dm):/i, '').trim();
  return normalized;
}
export {
  normalizeFeishuTarget
};
