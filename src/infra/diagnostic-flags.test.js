import {describe, expect, it} from 'vitest';
import {isDiagnosticFlagEnabled, resolveDiagnosticFlags} from './diagnostic-flags.js';

describe('diagnostic flags', () => {
  it('merges config + env flags', () => {
    const cfg = {
      diagnostics: {flags: ['telegram.http', 'cache.*']}
    };
    const env = {
      OPENCLAW_DIAGNOSTICS: 'foo,bar'
    };

    const flags = resolveDiagnosticFlags(cfg, env);
    expect(flags).toEqual(expect.arrayContaining(['telegram.http', 'cache.*', 'foo', 'bar']));
    expect(isDiagnosticFlagEnabled('telegram.http', cfg, env)).toBe(true);
    expect(isDiagnosticFlagEnabled('cache.hit', cfg, env)).toBe(true);
    expect(isDiagnosticFlagEnabled('foo', cfg, env)).toBe(true);
  });

  it('treats env true as wildcard', () => {
    const env = {OPENCLAW_DIAGNOSTICS: '1'};
    expect(isDiagnosticFlagEnabled('anything.here', undefined, env)).toBe(true);
  });

  it('treats env false as disabled', () => {
    const env = {OPENCLAW_DIAGNOSTICS: '0'};
    expect(isDiagnosticFlagEnabled('telegram.http', undefined, env)).toBe(false);
  });
});
