/**
 * Shared utilities and helpers for agent tool implementations.
 * @module agents/tools/common
 */
import fs from 'node:fs/promises';
import { detectMime } from '../../media/mime.js';
import { sanitizeToolResultImages } from '../tool-images.js';
function createActionGate(actions) {
  return (key, defaultValue = true) => {
    const value = actions?.[key];
    if (value === void 0) {
      return defaultValue;
    }
    return value !== false;
  };
}
function readStringParam(params, key, options = {}) {
  const { required = false, trim = true, label = key, allowEmpty = false } = options;
  const raw = params[key];
  if (typeof raw !== 'string') {
    if (required) {
      throw new Error(`${label} required`);
    }
    return void 0;
  }
  const value = trim ? raw.trim() : raw;
  if (!value && !allowEmpty) {
    if (required) {
      throw new Error(`${label} required`);
    }
    return void 0;
  }
  return value;
}
function readStringOrNumberParam(params, key, options = {}) {
  const { required = false, label = key } = options;
  const raw = params[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  if (typeof raw === 'string') {
    const value = raw.trim();
    if (value) {
      return value;
    }
  }
  if (required) {
    throw new Error(`${label} required`);
  }
  return void 0;
}
function readNumberParam(params, key, options = {}) {
  const { required = false, label = key, integer = false } = options;
  const raw = params[key];
  let value;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    value = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed) {
      const parsed = Number.parseFloat(trimmed);
      if (Number.isFinite(parsed)) {
        value = parsed;
      }
    }
  }
  if (value === void 0) {
    if (required) {
      throw new Error(`${label} required`);
    }
    return void 0;
  }
  return integer ? Math.trunc(value) : value;
}
function readStringArrayParam(params, key, options = {}) {
  const { required = false, label = key } = options;
  const raw = params[key];
  if (Array.isArray(raw)) {
    const values = raw.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean);
    if (values.length === 0) {
      if (required) {
        throw new Error(`${label} required`);
      }
      return void 0;
    }
    return values;
  }
  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!value) {
      if (required) {
        throw new Error(`${label} required`);
      }
      return void 0;
    }
    return [value];
  }
  if (required) {
    throw new Error(`${label} required`);
  }
  return void 0;
}
function readReactionParams(params, options) {
  const emojiKey = options.emojiKey ?? 'emoji';
  const removeKey = options.removeKey ?? 'remove';
  const remove = typeof params[removeKey] === 'boolean' ? params[removeKey] : false;
  const emoji = readStringParam(params, emojiKey, {
    required: true,
    allowEmpty: true
  });
  if (remove && !emoji) {
    throw new Error(options.removeErrorMessage);
  }
  return { emoji, remove, isEmpty: !emoji };
}
function jsonResult(payload) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }
    ],
    details: payload
  };
}
async function imageResult(params) {
  const content = [
    {
      type: 'text',
      text: params.extraText ?? `MEDIA:${params.path}`
    },
    {
      type: 'image',
      data: params.base64,
      mimeType: params.mimeType
    }
  ];
  const result = {
    content,
    details: { path: params.path, ...params.details }
  };
  return await sanitizeToolResultImages(result, params.label);
}
async function imageResultFromFile(params) {
  const buf = await fs.readFile(params.path);
  const mimeType = await detectMime({ buffer: buf.slice(0, 256) }) ?? 'image/png';
  return await imageResult({
    label: params.label,
    path: params.path,
    base64: buf.toString('base64'),
    mimeType,
    extraText: params.extraText,
    details: params.details
  });
}
export {
  createActionGate,
  imageResult,
  imageResultFromFile,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringArrayParam,
  readStringOrNumberParam,
  readStringParam
};
