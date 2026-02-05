const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import {
  confirm as clackConfirm,
  intro as clackIntro,
  outro as clackOutro,
  select as clackSelect,
  text as clackText
} from '@clack/prompts';
import { stylePromptHint, stylePromptMessage, stylePromptTitle } from '../terminal/prompt-style.js';
const CONFIGURE_WIZARD_SECTIONS = [
  'workspace',
  'model',
  'web',
  'gateway',
  'daemon',
  'channels',
  'skills',
  'health'
];
const CONFIGURE_SECTION_OPTIONS = [
  { value: 'workspace', label: 'Workspace', hint: 'Set workspace + sessions' },
  { value: 'model', label: 'Model', hint: 'Pick provider + credentials' },
  { value: 'web', label: 'Web tools', hint: 'Configure Brave search + fetch' },
  { value: 'gateway', label: 'Gateway', hint: 'Port, bind, auth, tailscale' },
  {
    value: 'daemon',
    label: 'Daemon',
    hint: 'Install/manage the background service'
  },
  {
    value: 'channels',
    label: 'Channels',
    hint: 'Link WhatsApp/Telegram/etc and defaults'
  },
  { value: 'skills', label: 'Skills', hint: 'Install/enable workspace skills' },
  {
    value: 'health',
    label: 'Health check',
    hint: 'Run gateway + channel checks'
  }
];
const intro = /* @__PURE__ */ __name((message) => clackIntro(stylePromptTitle(message) ?? message), 'intro');
const outro = /* @__PURE__ */ __name((message) => clackOutro(stylePromptTitle(message) ?? message), 'outro');
const text = /* @__PURE__ */ __name((params) => clackText({
  ...params,
  message: stylePromptMessage(params.message)
}), 'text');
const confirm = /* @__PURE__ */ __name((params) => clackConfirm({
  ...params,
  message: stylePromptMessage(params.message)
}), 'confirm');
const select = /* @__PURE__ */ __name((params) => clackSelect({
  ...params,
  message: stylePromptMessage(params.message),
  options: params.options.map(
    (opt) => opt.hint === void 0 ? opt : { ...opt, hint: stylePromptHint(opt.hint) }
  )
}), 'select');
export {
  CONFIGURE_SECTION_OPTIONS,
  CONFIGURE_WIZARD_SECTIONS,
  confirm,
  intro,
  outro,
  select,
  text
};
