import { beforeEach, describe, expect, it, vi } from 'vitest';
const configMocks = vi.hoisted(() => ({
  readConfigFileSnapshot: vi.fn(),
  writeConfigFile: vi.fn().mockResolvedValue(void 0)
}));
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    readConfigFileSnapshot: configMocks.readConfigFileSnapshot,
    writeConfigFile: configMocks.writeConfigFile
  };
});
import { agentsAddCommand } from './agents.js';
const runtime = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn()
};
const baseSnapshot = {
  path: '/tmp/openclaw.json',
  exists: true,
  raw: '{}',
  parsed: {},
  valid: true,
  config: {},
  issues: [],
  legacyIssues: []
};
describe('agents add command', () => {
  beforeEach(() => {
    configMocks.readConfigFileSnapshot.mockReset();
    configMocks.writeConfigFile.mockClear();
    runtime.log.mockClear();
    runtime.error.mockClear();
    runtime.exit.mockClear();
  });
  it('requires --workspace when flags are present', async () => {
    configMocks.readConfigFileSnapshot.mockResolvedValue({ ...baseSnapshot });
    await agentsAddCommand({ name: 'Work' }, runtime, { hasFlags: true });
    expect(runtime.error).toHaveBeenCalledWith(expect.stringContaining('--workspace'));
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(configMocks.writeConfigFile).not.toHaveBeenCalled();
  });
  it('requires --workspace in non-interactive mode', async () => {
    configMocks.readConfigFileSnapshot.mockResolvedValue({ ...baseSnapshot });
    await agentsAddCommand({ name: 'Work', nonInteractive: true }, runtime, {
      hasFlags: false
    });
    expect(runtime.error).toHaveBeenCalledWith(expect.stringContaining('--workspace'));
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(configMocks.writeConfigFile).not.toHaveBeenCalled();
  });
});
