const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { resolveCommitHash } from '../infra/git-commit.js';
import { visibleWidth } from '../terminal/ansi.js';
import { isRich, theme } from '../terminal/theme.js';
import { pickTagline } from './tagline.js';
let bannerEmitted = false;
const graphemeSegmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(void 0, { granularity: 'grapheme' }) : null;
function splitGraphemes(value) {
  if (!graphemeSegmenter) {
    return Array.from(value);
  }
  try {
    return Array.from(graphemeSegmenter.segment(value), (seg) => seg.segment);
  } catch {
    return Array.from(value);
  }
}
__name(splitGraphemes, 'splitGraphemes');
const hasJsonFlag = /* @__PURE__ */ __name((argv) => argv.some((arg) => arg === '--json' || arg.startsWith('--json=')), 'hasJsonFlag');
const hasVersionFlag = /* @__PURE__ */ __name((argv) => argv.some((arg) => arg === '--version' || arg === '-V' || arg === '-v'), 'hasVersionFlag');
function formatCliBannerLine(version, options = {}) {
  const commit = options.commit ?? resolveCommitHash({ env: options.env });
  const commitLabel = commit ?? 'unknown';
  const tagline = pickTagline(options);
  const rich = options.richTty ?? isRich();
  const title = '\u{1F99E} OpenClaw';
  const prefix = '\u{1F99E} ';
  const columns = options.columns ?? process.stdout.columns ?? 120;
  const plainFullLine = `${title} ${version} (${commitLabel}) \u2014 ${tagline}`;
  const fitsOnOneLine = visibleWidth(plainFullLine) <= columns;
  if (rich) {
    if (fitsOnOneLine) {
      return `${theme.heading(title)} ${theme.info(version)} ${theme.muted(
        `(${commitLabel})`
      )} ${theme.muted('\u2014')} ${theme.accentDim(tagline)}`;
    }
    const line12 = `${theme.heading(title)} ${theme.info(version)} ${theme.muted(
      `(${commitLabel})`
    )}`;
    const line22 = `${' '.repeat(prefix.length)}${theme.accentDim(tagline)}`;
    return `${line12}
${line22}`;
  }
  if (fitsOnOneLine) {
    return plainFullLine;
  }
  const line1 = `${title} ${version} (${commitLabel})`;
  const line2 = `${' '.repeat(prefix.length)}${tagline}`;
  return `${line1}
${line2}`;
}
__name(formatCliBannerLine, 'formatCliBannerLine');
const LOBSTER_ASCII = [
  '\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584',
  '\u2588\u2588\u2591\u2584\u2584\u2584\u2591\u2588\u2588\u2591\u2584\u2584\u2591\u2588\u2588\u2591\u2584\u2584\u2584\u2588\u2588\u2591\u2580\u2588\u2588\u2591\u2588\u2588\u2591\u2584\u2584\u2580\u2588\u2588\u2591\u2588\u2588\u2588\u2588\u2591\u2584\u2584\u2580\u2588\u2588\u2591\u2588\u2588\u2588\u2591\u2588\u2588',
  '\u2588\u2588\u2591\u2588\u2588\u2588\u2591\u2588\u2588\u2591\u2580\u2580\u2591\u2588\u2588\u2591\u2584\u2584\u2584\u2588\u2588\u2591\u2588\u2591\u2588\u2591\u2588\u2588\u2591\u2588\u2588\u2588\u2588\u2588\u2591\u2588\u2588\u2588\u2588\u2591\u2580\u2580\u2591\u2588\u2588\u2591\u2588\u2591\u2588\u2591\u2588\u2588',
  '\u2588\u2588\u2591\u2580\u2580\u2580\u2591\u2588\u2588\u2591\u2588\u2588\u2588\u2588\u2588\u2591\u2580\u2580\u2580\u2588\u2588\u2591\u2588\u2588\u2584\u2591\u2588\u2588\u2591\u2580\u2580\u2584\u2588\u2588\u2591\u2580\u2580\u2591\u2588\u2591\u2588\u2588\u2591\u2588\u2588\u2584\u2580\u2584\u2580\u2584\u2588\u2588',
  '\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580',
  '                  \u{1F99E} OPENCLAW \u{1F99E}                    ',
  ' '
];
function formatCliBannerArt(options = {}) {
  const rich = options.richTty ?? isRich();
  if (!rich) {
    return LOBSTER_ASCII.join('\n');
  }
  const colorChar = /* @__PURE__ */ __name((ch) => {
    if (ch === '\u2588') {
      return theme.accentBright(ch);
    }
    if (ch === '\u2591') {
      return theme.accentDim(ch);
    }
    if (ch === '\u2580') {
      return theme.accent(ch);
    }
    return theme.muted(ch);
  }, 'colorChar');
  const colored = LOBSTER_ASCII.map((line) => {
    if (line.includes('OPENCLAW')) {
      return theme.muted('              ') + theme.accent('\u{1F99E}') + theme.info(' OPENCLAW ') + theme.accent('\u{1F99E}');
    }
    return splitGraphemes(line).map(colorChar).join('');
  });
  return colored.join('\n');
}
__name(formatCliBannerArt, 'formatCliBannerArt');
function emitCliBanner(version, options = {}) {
  if (bannerEmitted) {
    return;
  }
  const argv = options.argv ?? process.argv;
  if (!process.stdout.isTTY) {
    return;
  }
  if (hasJsonFlag(argv)) {
    return;
  }
  if (hasVersionFlag(argv)) {
    return;
  }
  const line = formatCliBannerLine(version, options);
  process.stdout.write(`
${line}

`);
  bannerEmitted = true;
}
__name(emitCliBanner, 'emitCliBanner');
function hasEmittedCliBanner() {
  return bannerEmitted;
}
__name(hasEmittedCliBanner, 'hasEmittedCliBanner');
export {
  emitCliBanner,
  formatCliBannerArt,
  formatCliBannerLine,
  hasEmittedCliBanner
};
