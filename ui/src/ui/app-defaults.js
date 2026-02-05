const DEFAULT_LOG_LEVEL_FILTERS = {
  trace: true,
  debug: true,
  info: true,
  warn: true,
  error: true,
  fatal: true
};
const DEFAULT_CRON_FORM = {
  name: '',
  description: '',
  agentId: '',
  enabled: true,
  scheduleKind: 'every',
  scheduleAt: '',
  everyAmount: '30',
  everyUnit: 'minutes',
  cronExpr: '0 7 * * *',
  cronTz: '',
  sessionTarget: 'isolated',
  wakeMode: 'next-heartbeat',
  payloadKind: 'agentTurn',
  payloadText: '',
  deliveryMode: 'announce',
  deliveryChannel: 'last',
  deliveryTo: '',
  timeoutSeconds: ''
};
export {
  DEFAULT_CRON_FORM,
  DEFAULT_LOG_LEVEL_FILTERS
};
