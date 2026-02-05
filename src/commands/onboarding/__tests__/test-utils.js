const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { vi } from 'vitest';
const makeRuntime = /* @__PURE__ */ __name((overrides = {}) => ({
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn((code) => {
    throw new Error(`exit:${code}`);
  }),
  ...overrides
}), 'makeRuntime');
const makePrompter = /* @__PURE__ */ __name((overrides = {}) => ({
  intro: vi.fn(async () => {
  }),
  outro: vi.fn(async () => {
  }),
  note: vi.fn(async () => {
  }),
  select: vi.fn(async () => 'npm'),
  multiselect: vi.fn(async () => []),
  text: vi.fn(async () => ''),
  confirm: vi.fn(async () => false),
  progress: vi.fn(() => ({ update: vi.fn(), stop: vi.fn() })),
  ...overrides
}), 'makePrompter');
export {
  makePrompter,
  makeRuntime
};
