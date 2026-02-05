import { describe, expect, it } from 'vitest';
import { isToolAllowed } from './tool-policy.js';
describe('sandbox tool policy', () => {
  it('allows all tools with * allow', () => {
    const policy = { allow: ['*'], deny: [] };
    expect(isToolAllowed(policy, 'browser')).toBe(true);
  });
  it('denies all tools with * deny', () => {
    const policy = { allow: [], deny: ['*'] };
    expect(isToolAllowed(policy, 'read')).toBe(false);
  });
  it('supports wildcard patterns', () => {
    const policy = { allow: ['web_*'] };
    expect(isToolAllowed(policy, 'web_fetch')).toBe(true);
    expect(isToolAllowed(policy, 'read')).toBe(false);
  });
});
