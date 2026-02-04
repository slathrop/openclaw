/**
 * Session cost and usage tracking.
 *
 * Scans session transcript JSONL files to aggregate token usage
 * and cost estimates across sessions and time periods.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {normalizeUsage} from '../agents/usage.js';
import {
  resolveSessionFilePath,
  resolveSessionTranscriptsDirForAgent
} from '../config/sessions/paths.js';
import {estimateUsageCost, resolveModelCostConfig} from '../utils/usage-format.js';

/**
 * @typedef {object} CostUsageTotals
 * @property {number} input
 * @property {number} output
 * @property {number} cacheRead
 * @property {number} cacheWrite
 * @property {number} totalTokens
 * @property {number} totalCost
 * @property {number} missingCostEntries
 */

/**
 * @typedef {CostUsageTotals & { date: string }} CostUsageDailyEntry
 */

/**
 * @typedef {object} CostUsageSummary
 * @property {number} updatedAt
 * @property {number} days
 * @property {CostUsageDailyEntry[]} daily
 * @property {CostUsageTotals} totals
 */

/**
 * @typedef {CostUsageTotals & { sessionId?: string, sessionFile?: string, lastActivity?: number }} SessionCostSummary
 */

const emptyTotals = () => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  totalCost: 0,
  missingCostEntries: 0
});

/**
 * Returns the value if it's a finite number, undefined otherwise.
 * @param {unknown} value
 * @returns {number | undefined}
 */
const toFiniteNumber = (value) => {
  if (typeof value !== 'number') {
    return undefined;
  }
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value;
};

/**
 * Extracts cost.total from a raw usage object.
 * @param {object} [usageRaw]
 * @returns {number | undefined}
 */
const extractCostTotal = (usageRaw) => {
  if (!usageRaw || typeof usageRaw !== 'object') {
    return undefined;
  }
  const record = usageRaw;
  const cost = record.cost;
  const total = toFiniteNumber(cost?.total);
  if (total === undefined) {
    return undefined;
  }
  if (total < 0) {
    return undefined;
  }
  return total;
};

/**
 * Parses a timestamp from a JSONL entry.
 * @param {Record<string, unknown>} entry
 * @returns {Date | undefined}
 */
const parseTimestamp = (entry) => {
  const raw = entry.timestamp;
  if (typeof raw === 'string') {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }
  const message = entry.message;
  const messageTimestamp = toFiniteNumber(message?.timestamp);
  if (messageTimestamp !== undefined) {
    const parsed = new Date(messageTimestamp);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }
  return undefined;
};

/**
 * Parses a usage entry from a JSONL record.
 * @param {Record<string, unknown>} entry
 * @returns {{ usage: object, costTotal?: number, provider?: string, model?: string, timestamp?: Date } | null}
 */
const parseUsageEntry = (entry) => {
  const message = entry.message;
  const role = message?.role;
  if (role !== 'assistant') {
    return null;
  }

  const usageRaw = message?.usage ?? entry.usage;
  const usage = normalizeUsage(usageRaw);
  if (!usage) {
    return null;
  }

  const provider =
    (typeof message?.provider === 'string' ? message?.provider : undefined) ??
    (typeof entry.provider === 'string' ? entry.provider : undefined);
  const model =
    (typeof message?.model === 'string' ? message?.model : undefined) ??
    (typeof entry.model === 'string' ? entry.model : undefined);

  return {
    usage,
    costTotal: extractCostTotal(usageRaw),
    provider,
    model,
    timestamp: parseTimestamp(entry)
  };
};

/**
 * Formats a date as a YYYY-MM-DD string in the local timezone.
 * @param {Date} date
 * @returns {string}
 */
const formatDayKey = (date) =>
  date.toLocaleDateString(
    'en-CA',
    {timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone}
  );

/**
 * Adds usage data to a totals accumulator.
 * @param {CostUsageTotals} totals
 * @param {object} usage
 */
const applyUsageTotals = (totals, usage) => {
  totals.input += usage.input ?? 0;
  totals.output += usage.output ?? 0;
  totals.cacheRead += usage.cacheRead ?? 0;
  totals.cacheWrite += usage.cacheWrite ?? 0;
  const totalTokens =
    usage.total ??
    (usage.input ?? 0) + (usage.output ?? 0) +
    (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
  totals.totalTokens += totalTokens;
};

/**
 * Adds a cost total to the accumulator, tracking missing entries.
 * @param {CostUsageTotals} totals
 * @param {number | undefined} costTotal
 */
const applyCostTotal = (totals, costTotal) => {
  if (costTotal === undefined) {
    totals.missingCostEntries += 1;
    return;
  }
  totals.totalCost += costTotal;
};

/**
 * Scans a JSONL file for usage entries and invokes onEntry for each.
 * @param {{ filePath: string, config?: object, onEntry: (entry: { usage: object, costTotal?: number, provider?: string, model?: string, timestamp?: Date }) => void }} params
 * @returns {Promise<void>}
 */
async function scanUsageFile(params) {
  const fileStream = fs.createReadStream(params.filePath, {encoding: 'utf-8'});
  const rl = readline.createInterface({input: fileStream, crlfDelay: Infinity});

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed);
      const entry = parseUsageEntry(parsed);
      if (!entry) {
        continue;
      }

      if (entry.costTotal === undefined) {
        const cost = resolveModelCostConfig({
          provider: entry.provider,
          model: entry.model,
          config: params.config
        });
        entry.costTotal = estimateUsageCost({usage: entry.usage, cost});
      }

      params.onEntry(entry);
    } catch {
      // Ignore malformed lines
    }
  }
}

/**
 * Loads a cost/usage summary across session transcripts.
 * @param {{ days?: number, config?: object, agentId?: string }} [params]
 * @returns {Promise<CostUsageSummary>}
 */
export async function loadCostUsageSummary(params) {
  const days = Math.max(1, Math.floor(params?.days ?? 30));
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - (days - 1));
  const sinceTime = since.getTime();

  const dailyMap = new Map();
  const totals = emptyTotals();

  const sessionsDir = resolveSessionTranscriptsDirForAgent(params?.agentId);
  const entries = await fs.promises.readdir(sessionsDir, {withFileTypes: true}).catch(() => []);
  const files = (
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
        .map(async (entry) => {
          const filePath = path.join(sessionsDir, entry.name);
          const stats = await fs.promises.stat(filePath).catch(() => null);
          if (!stats) {
            return null;
          }
          if (stats.mtimeMs < sinceTime) {
            return null;
          }
          return filePath;
        })
    )
  ).filter((filePath) => Boolean(filePath));

  for (const filePath of files) {
    await scanUsageFile({
      filePath,
      config: params?.config,
      onEntry: (entry) => {
        const ts = entry.timestamp?.getTime();
        if (!ts || ts < sinceTime) {
          return;
        }
        const dayKey = formatDayKey(entry.timestamp ?? now);
        const bucket = dailyMap.get(dayKey) ?? emptyTotals();
        applyUsageTotals(bucket, entry.usage);
        applyCostTotal(bucket, entry.costTotal);
        dailyMap.set(dayKey, bucket);

        applyUsageTotals(totals, entry.usage);
        applyCostTotal(totals, entry.costTotal);
      }
    });
  }

  const daily = Array.from(dailyMap.entries())
    .map(([date, bucket]) => Object.assign({date}, bucket))
    .toSorted((a, b) => a.date.localeCompare(b.date));

  return {
    updatedAt: Date.now(),
    days,
    daily,
    totals
  };
}

/**
 * Loads a cost summary for a single session.
 * @param {{ sessionId?: string, sessionEntry?: object, sessionFile?: string, config?: object }} params
 * @returns {Promise<SessionCostSummary | null>}
 */
export async function loadSessionCostSummary(params) {
  const sessionFile =
    params.sessionFile ??
    (params.sessionId ?
      resolveSessionFilePath(params.sessionId, params.sessionEntry) :
      undefined);
  if (!sessionFile || !fs.existsSync(sessionFile)) {
    return null;
  }

  const totals = emptyTotals();
  let lastActivity;

  await scanUsageFile({
    filePath: sessionFile,
    config: params.config,
    onEntry: (entry) => {
      applyUsageTotals(totals, entry.usage);
      applyCostTotal(totals, entry.costTotal);
      const ts = entry.timestamp?.getTime();
      if (ts && (!lastActivity || ts > lastActivity)) {
        lastActivity = ts;
      }
    }
  });

  return {
    sessionId: params.sessionId,
    sessionFile,
    lastActivity,
    ...totals
  };
}
