import { sanitizeAgentId } from '../routing/session-key.js';
import { parseAbsoluteTimeMs } from './parse.js';
import { migrateLegacyCronPayload } from './payload-migration.js';
const DEFAULT_OPTIONS = {
  applyDefaults: false
};
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function coerceSchedule(schedule) {
  const next = { ...schedule };
  const kind = typeof schedule.kind === 'string' ? schedule.kind : void 0;
  const atMsRaw = schedule.atMs;
  const atRaw = schedule.at;
  const atString = typeof atRaw === 'string' ? atRaw.trim() : '';
  const parsedAtMs = typeof atMsRaw === 'number' ? atMsRaw : typeof atMsRaw === 'string' ? parseAbsoluteTimeMs(atMsRaw) : atString ? parseAbsoluteTimeMs(atString) : null;
  if (!kind) {
    if (typeof schedule.atMs === 'number' || typeof schedule.at === 'string' || typeof schedule.atMs === 'string') {
      next.kind = 'at';
    } else if (typeof schedule.everyMs === 'number') {
      next.kind = 'every';
    } else if (typeof schedule.expr === 'string') {
      next.kind = 'cron';
    }
  }
  if (atString) {
    next.at = parsedAtMs ? new Date(parsedAtMs).toISOString() : atString;
  } else if (parsedAtMs !== null) {
    next.at = new Date(parsedAtMs).toISOString();
  }
  if ('atMs' in next) {
    delete next.atMs;
  }
  return next;
}
function coercePayload(payload) {
  const next = { ...payload };
  migrateLegacyCronPayload(next);
  return next;
}
function coerceDelivery(delivery) {
  const next = { ...delivery };
  if (typeof delivery.mode === 'string') {
    const mode = delivery.mode.trim().toLowerCase();
    next.mode = mode === 'deliver' ? 'announce' : mode;
  }
  if (typeof delivery.channel === 'string') {
    const trimmed = delivery.channel.trim().toLowerCase();
    if (trimmed) {
      next.channel = trimmed;
    } else {
      delete next.channel;
    }
  }
  if (typeof delivery.to === 'string') {
    const trimmed = delivery.to.trim();
    if (trimmed) {
      next.to = trimmed;
    } else {
      delete next.to;
    }
  }
  return next;
}
function hasLegacyDeliveryHints(payload) {
  if (typeof payload.deliver === 'boolean') {
    return true;
  }
  if (typeof payload.bestEffortDeliver === 'boolean') {
    return true;
  }
  if (typeof payload.to === 'string' && payload.to.trim()) {
    return true;
  }
  return false;
}
function buildDeliveryFromLegacyPayload(payload) {
  const deliver = payload.deliver;
  const mode = deliver === false ? 'none' : 'announce';
  const channelRaw = typeof payload.channel === 'string' ? payload.channel.trim().toLowerCase() : '';
  const toRaw = typeof payload.to === 'string' ? payload.to.trim() : '';
  const next = { mode };
  if (channelRaw) {
    next.channel = channelRaw;
  }
  if (toRaw) {
    next.to = toRaw;
  }
  if (typeof payload.bestEffortDeliver === 'boolean') {
    next.bestEffort = payload.bestEffortDeliver;
  }
  return next;
}
function stripLegacyDeliveryFields(payload) {
  if ('deliver' in payload) {
    delete payload.deliver;
  }
  if ('channel' in payload) {
    delete payload.channel;
  }
  if ('to' in payload) {
    delete payload.to;
  }
  if ('bestEffortDeliver' in payload) {
    delete payload.bestEffortDeliver;
  }
}
function unwrapJob(raw) {
  if (isRecord(raw.data)) {
    return raw.data;
  }
  if (isRecord(raw.job)) {
    return raw.job;
  }
  return raw;
}
function normalizeCronJobInput(raw, options = DEFAULT_OPTIONS) {
  if (!isRecord(raw)) {
    return null;
  }
  const base = unwrapJob(raw);
  const next = { ...base };
  if ('agentId' in base) {
    const agentId = base.agentId;
    if (agentId === null) {
      next.agentId = null;
    } else if (typeof agentId === 'string') {
      const trimmed = agentId.trim();
      if (trimmed) {
        next.agentId = sanitizeAgentId(trimmed);
      } else {
        delete next.agentId;
      }
    }
  }
  if ('enabled' in base) {
    const enabled = base.enabled;
    if (typeof enabled === 'boolean') {
      next.enabled = enabled;
    } else if (typeof enabled === 'string') {
      const trimmed = enabled.trim().toLowerCase();
      if (trimmed === 'true') {
        next.enabled = true;
      }
      if (trimmed === 'false') {
        next.enabled = false;
      }
    }
  }
  if (isRecord(base.schedule)) {
    next.schedule = coerceSchedule(base.schedule);
  }
  if (isRecord(base.payload)) {
    next.payload = coercePayload(base.payload);
  }
  if (isRecord(base.delivery)) {
    next.delivery = coerceDelivery(base.delivery);
  }
  if (isRecord(base.isolation)) {
    delete next.isolation;
  }
  if (options.applyDefaults) {
    if (!next.wakeMode) {
      next.wakeMode = 'next-heartbeat';
    }
    if (typeof next.enabled !== 'boolean') {
      next.enabled = true;
    }
    if (!next.sessionTarget && isRecord(next.payload)) {
      const kind = typeof next.payload.kind === 'string' ? next.payload.kind : '';
      if (kind === 'systemEvent') {
        next.sessionTarget = 'main';
      }
      if (kind === 'agentTurn') {
        next.sessionTarget = 'isolated';
      }
    }
    if ('schedule' in next && isRecord(next.schedule) && next.schedule.kind === 'at' && !('deleteAfterRun' in next)) {
      next.deleteAfterRun = true;
    }
    const payload = isRecord(next.payload) ? next.payload : null;
    const payloadKind = payload && typeof payload.kind === 'string' ? payload.kind : '';
    const sessionTarget = typeof next.sessionTarget === 'string' ? next.sessionTarget : '';
    const isIsolatedAgentTurn = sessionTarget === 'isolated' || sessionTarget === '' && payloadKind === 'agentTurn';
    const hasDelivery = 'delivery' in next && next.delivery !== void 0;
    const hasLegacyDelivery = payload ? hasLegacyDeliveryHints(payload) : false;
    if (!hasDelivery && isIsolatedAgentTurn && payloadKind === 'agentTurn') {
      if (payload && hasLegacyDelivery) {
        next.delivery = buildDeliveryFromLegacyPayload(payload);
        stripLegacyDeliveryFields(payload);
      } else {
        next.delivery = { mode: 'announce' };
      }
    }
  }
  return next;
}
function normalizeCronJobCreate(raw, options) {
  return normalizeCronJobInput(raw, {
    applyDefaults: true,
    ...options
  });
}
function normalizeCronJobPatch(raw, options) {
  return normalizeCronJobInput(raw, {
    applyDefaults: false,
    ...options
  });
}
export {
  normalizeCronJobCreate,
  normalizeCronJobInput,
  normalizeCronJobPatch
};
