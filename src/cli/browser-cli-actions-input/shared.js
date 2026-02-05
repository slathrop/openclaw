const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { danger } from '../../globals.js';
import { defaultRuntime } from '../../runtime.js';
import { callBrowserRequest } from '../browser-cli-shared.js';
function resolveBrowserActionContext(cmd, parentOpts) {
  const parent = parentOpts(cmd);
  const profile = parent?.browserProfile;
  return { parent, profile };
}
__name(resolveBrowserActionContext, 'resolveBrowserActionContext');
async function callBrowserAct(params) {
  return await callBrowserRequest(
    params.parent,
    {
      method: 'POST',
      path: '/act',
      query: params.profile ? { profile: params.profile } : void 0,
      body: params.body
    },
    { timeoutMs: params.timeoutMs ?? 2e4 }
  );
}
__name(callBrowserAct, 'callBrowserAct');
function requireRef(ref) {
  const refValue = typeof ref === 'string' ? ref.trim() : '';
  if (!refValue) {
    defaultRuntime.error(danger('ref is required'));
    defaultRuntime.exit(1);
    return null;
  }
  return refValue;
}
__name(requireRef, 'requireRef');
async function readFile(path) {
  const fs = await import('node:fs/promises');
  return await fs.readFile(path, 'utf8');
}
__name(readFile, 'readFile');
async function readFields(opts) {
  const payload = opts.fieldsFile ? await readFile(opts.fieldsFile) : opts.fields ?? '';
  if (!payload.trim()) {
    throw new Error('fields are required');
  }
  const parsed = JSON.parse(payload);
  if (!Array.isArray(parsed)) {
    throw new Error('fields must be an array');
  }
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`fields[${index}] must be an object`);
    }
    const rec = entry;
    const ref = typeof rec.ref === 'string' ? rec.ref.trim() : '';
    const type = typeof rec.type === 'string' ? rec.type.trim() : '';
    if (!ref || !type) {
      throw new Error(`fields[${index}] must include ref and type`);
    }
    if (typeof rec.value === 'string' || typeof rec.value === 'number' || typeof rec.value === 'boolean') {
      return { ref, type, value: rec.value };
    }
    if (rec.value === void 0 || rec.value === null) {
      return { ref, type };
    }
    throw new Error(`fields[${index}].value must be string, number, boolean, or null`);
  });
}
__name(readFields, 'readFields');
export {
  callBrowserAct,
  readFields,
  requireRef,
  resolveBrowserActionContext
};
