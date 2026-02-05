function normalizeChatType(raw) {
  const value = raw?.trim().toLowerCase();
  if (!value) {
    return void 0;
  }
  if (value === 'direct' || value === 'dm') {
    return 'direct';
  }
  if (value === 'group') {
    return 'group';
  }
  if (value === 'channel') {
    return 'channel';
  }
  return void 0;
}
export {
  normalizeChatType
};
