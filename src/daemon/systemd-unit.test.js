import { describe, expect, it } from 'vitest';
import { parseSystemdExecStart } from './systemd-unit.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

describe('parseSystemdExecStart', () => {
  it('splits on whitespace outside quotes', () => {
    const execStart = '/usr/bin/openclaw gateway start --foo bar';
    expect(parseSystemdExecStart(execStart)).toEqual([
      '/usr/bin/openclaw',
      'gateway',
      'start',
      '--foo',
      'bar'
    ]);
  });
  it('preserves quoted arguments', () => {
    const execStart = '/usr/bin/openclaw gateway start --name "My Bot"';
    expect(parseSystemdExecStart(execStart)).toEqual([
      '/usr/bin/openclaw',
      'gateway',
      'start',
      '--name',
      'My Bot'
    ]);
  });
  it('parses path arguments', () => {
    const execStart = '/usr/bin/openclaw gateway start --path /tmp/openclaw';
    expect(parseSystemdExecStart(execStart)).toEqual([
      '/usr/bin/openclaw',
      'gateway',
      'start',
      '--path',
      '/tmp/openclaw'
    ]);
  });
});
