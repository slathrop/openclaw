const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { confirm, select } from '@clack/prompts';
import { stylePromptHint, stylePromptMessage } from '../terminal/prompt-style.js';
import { guardCancel } from './onboard-helpers.js';
function createDoctorPrompter(params) {
  const yes = params.options.yes === true;
  const requestedNonInteractive = params.options.nonInteractive === true;
  const shouldRepair = params.options.repair === true || yes;
  const shouldForce = params.options.force === true;
  const isTty = Boolean(process.stdin.isTTY);
  const nonInteractive = requestedNonInteractive || !isTty && !yes;
  const canPrompt = isTty && !yes && !nonInteractive;
  const confirmDefault = /* @__PURE__ */ __name(async (p) => {
    if (nonInteractive) {
      return false;
    }
    if (shouldRepair) {
      return true;
    }
    if (!canPrompt) {
      return Boolean(p.initialValue ?? false);
    }
    return guardCancel(
      await confirm({
        ...p,
        message: stylePromptMessage(p.message)
      }),
      params.runtime
    );
  }, 'confirmDefault');
  return {
    confirm: confirmDefault,
    confirmRepair: /* @__PURE__ */ __name(async (p) => {
      if (nonInteractive) {
        return false;
      }
      return confirmDefault(p);
    }, 'confirmRepair'),
    confirmAggressive: /* @__PURE__ */ __name(async (p) => {
      if (nonInteractive) {
        return false;
      }
      if (shouldRepair && shouldForce) {
        return true;
      }
      if (shouldRepair && !shouldForce) {
        return false;
      }
      if (!canPrompt) {
        return Boolean(p.initialValue ?? false);
      }
      return guardCancel(
        await confirm({
          ...p,
          message: stylePromptMessage(p.message)
        }),
        params.runtime
      );
    }, 'confirmAggressive'),
    confirmSkipInNonInteractive: /* @__PURE__ */ __name(async (p) => {
      if (nonInteractive) {
        return false;
      }
      if (shouldRepair) {
        return true;
      }
      return confirmDefault(p);
    }, 'confirmSkipInNonInteractive'),
    select: /* @__PURE__ */ __name(async (p, fallback) => {
      if (!canPrompt || shouldRepair) {
        return fallback;
      }
      return guardCancel(
        await select({
          ...p,
          message: stylePromptMessage(p.message),
          options: p.options.map(
            (opt) => opt.hint === void 0 ? opt : { ...opt, hint: stylePromptHint(opt.hint) }
          )
        }),
        params.runtime
      );
    }, 'select'),
    shouldRepair,
    shouldForce
  };
}
__name(createDoctorPrompter, 'createDoctorPrompter');
export {
  createDoctorPrompter
};
