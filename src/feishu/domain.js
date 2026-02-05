const FEISHU_DOMAIN = 'https://open.feishu.cn';
const LARK_DOMAIN = 'https://open.larksuite.com';
function normalizeFeishuDomain(value) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return void 0;
  }
  const lower = trimmed.toLowerCase();
  if (lower === 'feishu' || lower === 'cn' || lower === 'china') {
    return FEISHU_DOMAIN;
  }
  if (lower === 'lark' || lower === 'global' || lower === 'intl' || lower === 'international') {
    return LARK_DOMAIN;
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const withoutTrailing = withScheme.replace(/\/+$/, '');
  return withoutTrailing.replace(/\/open-apis$/i, '');
}
function resolveFeishuDomain(value) {
  return normalizeFeishuDomain(value) ?? FEISHU_DOMAIN;
}
function resolveFeishuApiBase(value) {
  const base = resolveFeishuDomain(value);
  return `${base.replace(/\/+$/, '')}/open-apis`;
}
export {
  FEISHU_DOMAIN,
  LARK_DOMAIN,
  normalizeFeishuDomain,
  resolveFeishuApiBase,
  resolveFeishuDomain
};
