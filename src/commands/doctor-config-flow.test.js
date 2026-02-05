const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { withTempHome } from '../../test/helpers/temp-home.js';
import { loadAndMaybeMigrateDoctorConfig } from './doctor-config-flow.js';
describe('doctor config flow', () => {
  it('preserves invalid config for doctor repairs', async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, '.openclaw');
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, 'openclaw.json'),
        JSON.stringify(
          {
            gateway: { auth: { mode: 'token', token: 123 } },
            agents: { list: [{ id: 'pi' }] }
          },
          null,
          2
        ),
        'utf-8'
      );
      const result = await loadAndMaybeMigrateDoctorConfig({
        options: { nonInteractive: true },
        confirm: /* @__PURE__ */ __name(async () => false, 'confirm')
      });
      expect(result.cfg.gateway).toEqual({
        auth: { mode: 'token', token: 123 }
      });
    });
  });
  it('drops unknown keys on repair', async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, '.openclaw');
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, 'openclaw.json'),
        JSON.stringify(
          {
            bridge: { bind: 'auto' },
            gateway: { auth: { mode: 'token', token: 'ok', extra: true } },
            agents: { list: [{ id: 'pi' }] }
          },
          null,
          2
        ),
        'utf-8'
      );
      const result = await loadAndMaybeMigrateDoctorConfig({
        options: { nonInteractive: true, repair: true },
        confirm: /* @__PURE__ */ __name(async () => false, 'confirm')
      });
      const cfg = result.cfg;
      expect(cfg.bridge).toBeUndefined();
      expect(cfg.gateway?.auth).toEqual({
        mode: 'token',
        token: 'ok'
      });
    });
  });
});
