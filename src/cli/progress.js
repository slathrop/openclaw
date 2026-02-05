const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { spinner } from '@clack/prompts';
import { createOscProgressController, supportsOscProgress } from 'osc-progress';
import {
  clearActiveProgressLine,
  registerActiveProgressLine,
  unregisterActiveProgressLine
} from '../terminal/progress-line.js';
import { theme } from '../terminal/theme.js';
const DEFAULT_DELAY_MS = 0;
let activeProgress = 0;
const noopReporter = {
  setLabel: /* @__PURE__ */ __name(() => {
  }, 'setLabel'),
  setPercent: /* @__PURE__ */ __name(() => {
  }, 'setPercent'),
  tick: /* @__PURE__ */ __name(() => {
  }, 'tick'),
  done: /* @__PURE__ */ __name(() => {
  }, 'done')
};
function createCliProgress(options) {
  if (options.enabled === false) {
    return noopReporter;
  }
  if (activeProgress > 0) {
    return noopReporter;
  }
  const stream = options.stream ?? process.stderr;
  const isTty = stream.isTTY;
  const allowLog = !isTty && options.fallback === 'log';
  if (!isTty && !allowLog) {
    return noopReporter;
  }
  const delayMs = typeof options.delayMs === 'number' ? options.delayMs : DEFAULT_DELAY_MS;
  const canOsc = isTty && supportsOscProgress(process.env, isTty);
  const allowSpinner = isTty && (options.fallback === void 0 || options.fallback === 'spinner');
  const allowLine = isTty && options.fallback === 'line';
  let started = false;
  let label = options.label;
  const total = options.total ?? null;
  let completed = 0;
  let percent = 0;
  let indeterminate = options.indeterminate ?? (options.total === void 0 || options.total === null);
  activeProgress += 1;
  if (isTty) {
    registerActiveProgressLine(stream);
  }
  const controller = canOsc ? createOscProgressController({
    env: process.env,
    isTty: stream.isTTY,
    write: /* @__PURE__ */ __name((chunk) => stream.write(chunk), 'write')
  }) : null;
  const spin = allowSpinner ? spinner() : null;
  const renderLine = allowLine ? () => {
    if (!started) {
      return;
    }
    const suffix = indeterminate ? '' : ` ${percent}%`;
    clearActiveProgressLine();
    stream.write(`${theme.accent(label)}${suffix}`);
  } : null;
  const renderLog = allowLog ? /* @__PURE__ */ (() => {
    let lastLine = '';
    let lastAt = 0;
    const throttleMs = 250;
    return () => {
      if (!started) {
        return;
      }
      const suffix = indeterminate ? '' : ` ${percent}%`;
      const nextLine = `${label}${suffix}`;
      const now = Date.now();
      if (nextLine === lastLine && now - lastAt < throttleMs) {
        return;
      }
      lastLine = nextLine;
      lastAt = now;
      stream.write(`${nextLine}
`);
    };
  })() : null;
  let timer = null;
  const applyState = /* @__PURE__ */ __name(() => {
    if (!started) {
      return;
    }
    if (controller) {
      if (indeterminate) {
        controller.setIndeterminate(label);
      } else {
        controller.setPercent(label, percent);
      }
    }
    if (spin) {
      spin.message(theme.accent(label));
    }
    if (renderLine) {
      renderLine();
    }
    if (renderLog) {
      renderLog();
    }
  }, 'applyState');
  const start = /* @__PURE__ */ __name(() => {
    if (started) {
      return;
    }
    started = true;
    if (spin) {
      spin.start(theme.accent(label));
    }
    applyState();
  }, 'start');
  if (delayMs === 0) {
    start();
  } else {
    timer = setTimeout(start, delayMs);
  }
  const setLabel = /* @__PURE__ */ __name((next) => {
    label = next;
    applyState();
  }, 'setLabel');
  const setPercent = /* @__PURE__ */ __name((nextPercent) => {
    percent = Math.max(0, Math.min(100, Math.round(nextPercent)));
    indeterminate = false;
    applyState();
  }, 'setPercent');
  const tick = /* @__PURE__ */ __name((delta = 1) => {
    if (!total) {
      return;
    }
    completed = Math.min(total, completed + delta);
    const nextPercent = total > 0 ? Math.round(completed / total * 100) : 0;
    setPercent(nextPercent);
  }, 'tick');
  const done = /* @__PURE__ */ __name(() => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!started) {
      activeProgress = Math.max(0, activeProgress - 1);
      return;
    }
    if (controller) {
      controller.clear();
    }
    if (spin) {
      spin.stop();
    }
    clearActiveProgressLine();
    if (isTty) {
      unregisterActiveProgressLine(stream);
    }
    activeProgress = Math.max(0, activeProgress - 1);
  }, 'done');
  return { setLabel, setPercent, tick, done };
}
__name(createCliProgress, 'createCliProgress');
async function withProgress(options, work) {
  const progress = createCliProgress(options);
  try {
    return await work(progress);
  } finally {
    progress.done();
  }
}
__name(withProgress, 'withProgress');
async function withProgressTotals(options, work) {
  return await withProgress(options, async (progress) => {
    const update = /* @__PURE__ */ __name(({ completed, total, label }) => {
      if (label) {
        progress.setLabel(label);
      }
      if (!Number.isFinite(total) || total <= 0) {
        return;
      }
      progress.setPercent(completed / total * 100);
    }, 'update');
    return await work(update, progress);
  });
}
__name(withProgressTotals, 'withProgressTotals');
export {
  createCliProgress,
  withProgress,
  withProgressTotals
};
