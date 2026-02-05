import { defaultRuntime } from '../../../runtime.js';
import {
  buildCollectPrompt,
  buildQueueSummaryPrompt,
  hasCrossChannelItems,
  waitForQueueDebounce
} from '../../../utils/queue-helpers.js';
import { isRoutableChannel } from '../route-reply.js';
import { FOLLOWUP_QUEUES } from './state.js';
function scheduleFollowupDrain(key, runFollowup) {
  const queue = FOLLOWUP_QUEUES.get(key);
  if (!queue || queue.draining) {
    return;
  }
  queue.draining = true;
  void (async () => {
    try {
      let forceIndividualCollect = false;
      while (queue.items.length > 0 || queue.droppedCount > 0) {
        await waitForQueueDebounce(queue);
        if (queue.mode === 'collect') {
          if (forceIndividualCollect) {
            const next2 = queue.items.shift();
            if (!next2) {
              break;
            }
            await runFollowup(next2);
            continue;
          }
          const isCrossChannel = hasCrossChannelItems(queue.items, (item) => {
            const channel = item.originatingChannel;
            const to = item.originatingTo;
            const accountId = item.originatingAccountId;
            const threadId = item.originatingThreadId;
            if (!channel && !to && !accountId && typeof threadId !== 'number') {
              return {};
            }
            if (!isRoutableChannel(channel) || !to) {
              return { cross: true };
            }
            const threadKey = typeof threadId === 'number' ? String(threadId) : '';
            return {
              key: [channel, to, accountId || '', threadKey].join('|')
            };
          });
          if (isCrossChannel) {
            forceIndividualCollect = true;
            const next2 = queue.items.shift();
            if (!next2) {
              break;
            }
            await runFollowup(next2);
            continue;
          }
          const items = queue.items.splice(0, queue.items.length);
          const summary = buildQueueSummaryPrompt({ state: queue, noun: 'message' });
          const run = items.at(-1)?.run ?? queue.lastRun;
          if (!run) {
            break;
          }
          const originatingChannel = items.find((i) => i.originatingChannel)?.originatingChannel;
          const originatingTo = items.find((i) => i.originatingTo)?.originatingTo;
          const originatingAccountId = items.find(
            (i) => i.originatingAccountId
          )?.originatingAccountId;
          const originatingThreadId = items.find(
            (i) => typeof i.originatingThreadId === 'number'
          )?.originatingThreadId;
          const prompt = buildCollectPrompt({
            title: '[Queued messages while agent was busy]',
            items,
            summary,
            renderItem: (item, idx) => `---
Queued #${idx + 1}
${item.prompt}`.trim()
          });
          await runFollowup({
            prompt,
            run,
            enqueuedAt: Date.now(),
            originatingChannel,
            originatingTo,
            originatingAccountId,
            originatingThreadId
          });
          continue;
        }
        const summaryPrompt = buildQueueSummaryPrompt({ state: queue, noun: 'message' });
        if (summaryPrompt) {
          const run = queue.lastRun;
          if (!run) {
            break;
          }
          await runFollowup({
            prompt: summaryPrompt,
            run,
            enqueuedAt: Date.now()
          });
          continue;
        }
        const next = queue.items.shift();
        if (!next) {
          break;
        }
        await runFollowup(next);
      }
    } catch (err) {
      defaultRuntime.error?.(`followup queue drain failed for ${key}: ${String(err)}`);
    } finally {
      queue.draining = false;
      if (queue.items.length === 0 && queue.droppedCount === 0) {
        FOLLOWUP_QUEUES.delete(key);
      } else {
        scheduleFollowupDrain(key, runFollowup);
      }
    }
  })();
}
export {
  scheduleFollowupDrain
};
