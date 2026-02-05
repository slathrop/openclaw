import { describe, expect, it } from 'vitest';
import { sanitizeGoogleTurnOrdering } from './pi-embedded-helpers.js';
import { DEFAULT_AGENTS_FILENAME } from './workspace.js';
// eslint-disable-next-line no-unused-vars
const _makeFile = (overrides) => ({
  name: DEFAULT_AGENTS_FILENAME,
  path: '/tmp/AGENTS.md',
  content: '',
  missing: false,
  ...overrides
});
describe('sanitizeGoogleTurnOrdering', () => {
  it('prepends a synthetic user turn when history starts with assistant', () => {
    const input = [
      {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'call_1', name: 'exec', arguments: {} }]
      }
    ];
    const out = sanitizeGoogleTurnOrdering(input);
    expect(out[0]?.role).toBe('user');
    expect(out[1]?.role).toBe('assistant');
  });
  it('is a no-op when history starts with user', () => {
    const input = [{ role: 'user', content: 'hi' }];
    const out = sanitizeGoogleTurnOrdering(input);
    expect(out).toBe(input);
  });
});
