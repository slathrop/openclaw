const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { resolveIsNixMode } from '../../config/paths.js';
import { resolveGatewayService } from '../../daemon/service.js';
import { renderSystemdUnavailableHints } from '../../daemon/systemd-hints.js';
import { isSystemdUserServiceAvailable } from '../../daemon/systemd.js';
import { isWSL } from '../../infra/wsl.js';
import { defaultRuntime } from '../../runtime.js';
import { buildDaemonServiceSnapshot, createNullWriter, emitDaemonActionJson } from './response.js';
import { renderGatewayServiceStartHints } from './shared.js';
async function runDaemonUninstall(opts = {}) {
  const json = Boolean(opts.json);
  const stdout = json ? createNullWriter() : process.stdout;
  const emit = /* @__PURE__ */ __name((payload) => {
    if (!json) {
      return;
    }
    emitDaemonActionJson({ action: 'uninstall', ...payload });
  }, 'emit');
  const fail = /* @__PURE__ */ __name((message) => {
    if (json) {
      emit({ ok: false, error: message });
    } else {
      defaultRuntime.error(message);
    }
    defaultRuntime.exit(1);
  }, 'fail');
  if (resolveIsNixMode(process.env)) {
    fail('Nix mode detected; service uninstall is disabled.');
    return;
  }
  const service = resolveGatewayService();
  let loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch {
    loaded = false;
  }
  if (loaded) {
    try {
      await service.stop({ env: process.env, stdout });
    } catch {
      // Best-effort stop before uninstall; ignore failures
    }
  }
  try {
    await service.uninstall({ env: process.env, stdout });
  } catch (err) {
    fail(`Gateway uninstall failed: ${String(err)}`);
    return;
  }
  loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch {
    loaded = false;
  }
  if (loaded) {
    fail('Gateway service still loaded after uninstall.');
    return;
  }
  emit({
    ok: true,
    result: 'uninstalled',
    service: buildDaemonServiceSnapshot(service, loaded)
  });
}
__name(runDaemonUninstall, 'runDaemonUninstall');
async function runDaemonStart(opts = {}) {
  const json = Boolean(opts.json);
  const stdout = json ? createNullWriter() : process.stdout;
  const emit = /* @__PURE__ */ __name((payload) => {
    if (!json) {
      return;
    }
    emitDaemonActionJson({ action: 'start', ...payload });
  }, 'emit');
  const fail = /* @__PURE__ */ __name((message, hints) => {
    if (json) {
      emit({ ok: false, error: message, hints });
    } else {
      defaultRuntime.error(message);
    }
    defaultRuntime.exit(1);
  }, 'fail');
  const service = resolveGatewayService();
  let loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch (err) {
    fail(`Gateway service check failed: ${String(err)}`);
    return;
  }
  if (!loaded) {
    let hints = renderGatewayServiceStartHints();
    if (process.platform === 'linux') {
      const systemdAvailable = await isSystemdUserServiceAvailable().catch(() => false);
      if (!systemdAvailable) {
        hints = [...hints, ...renderSystemdUnavailableHints({ wsl: await isWSL() })];
      }
    }
    emit({
      ok: true,
      result: 'not-loaded',
      message: `Gateway service ${service.notLoadedText}.`,
      hints,
      service: buildDaemonServiceSnapshot(service, loaded)
    });
    if (!json) {
      defaultRuntime.log(`Gateway service ${service.notLoadedText}.`);
      for (const hint of hints) {
        defaultRuntime.log(`Start with: ${hint}`);
      }
    }
    return;
  }
  try {
    await service.restart({ env: process.env, stdout });
  } catch (err) {
    const hints = renderGatewayServiceStartHints();
    fail(`Gateway start failed: ${String(err)}`, hints);
    return;
  }
  let started = true;
  try {
    started = await service.isLoaded({ env: process.env });
  } catch {
    started = true;
  }
  emit({
    ok: true,
    result: 'started',
    service: buildDaemonServiceSnapshot(service, started)
  });
}
__name(runDaemonStart, 'runDaemonStart');
async function runDaemonStop(opts = {}) {
  const json = Boolean(opts.json);
  const stdout = json ? createNullWriter() : process.stdout;
  const emit = /* @__PURE__ */ __name((payload) => {
    if (!json) {
      return;
    }
    emitDaemonActionJson({ action: 'stop', ...payload });
  }, 'emit');
  const fail = /* @__PURE__ */ __name((message) => {
    if (json) {
      emit({ ok: false, error: message });
    } else {
      defaultRuntime.error(message);
    }
    defaultRuntime.exit(1);
  }, 'fail');
  const service = resolveGatewayService();
  let loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch (err) {
    fail(`Gateway service check failed: ${String(err)}`);
    return;
  }
  if (!loaded) {
    emit({
      ok: true,
      result: 'not-loaded',
      message: `Gateway service ${service.notLoadedText}.`,
      service: buildDaemonServiceSnapshot(service, loaded)
    });
    if (!json) {
      defaultRuntime.log(`Gateway service ${service.notLoadedText}.`);
    }
    return;
  }
  try {
    await service.stop({ env: process.env, stdout });
  } catch (err) {
    fail(`Gateway stop failed: ${String(err)}`);
    return;
  }
  let stopped = false;
  try {
    stopped = await service.isLoaded({ env: process.env });
  } catch {
    stopped = false;
  }
  emit({
    ok: true,
    result: 'stopped',
    service: buildDaemonServiceSnapshot(service, stopped)
  });
}
__name(runDaemonStop, 'runDaemonStop');
async function runDaemonRestart(opts = {}) {
  const json = Boolean(opts.json);
  const stdout = json ? createNullWriter() : process.stdout;
  const emit = /* @__PURE__ */ __name((payload) => {
    if (!json) {
      return;
    }
    emitDaemonActionJson({ action: 'restart', ...payload });
  }, 'emit');
  const fail = /* @__PURE__ */ __name((message, hints) => {
    if (json) {
      emit({ ok: false, error: message, hints });
    } else {
      defaultRuntime.error(message);
    }
    defaultRuntime.exit(1);
  }, 'fail');
  const service = resolveGatewayService();
  let loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch (err) {
    fail(`Gateway service check failed: ${String(err)}`);
    return false;
  }
  if (!loaded) {
    let hints = renderGatewayServiceStartHints();
    if (process.platform === 'linux') {
      const systemdAvailable = await isSystemdUserServiceAvailable().catch(() => false);
      if (!systemdAvailable) {
        hints = [...hints, ...renderSystemdUnavailableHints({ wsl: await isWSL() })];
      }
    }
    emit({
      ok: true,
      result: 'not-loaded',
      message: `Gateway service ${service.notLoadedText}.`,
      hints,
      service: buildDaemonServiceSnapshot(service, loaded)
    });
    if (!json) {
      defaultRuntime.log(`Gateway service ${service.notLoadedText}.`);
      for (const hint of hints) {
        defaultRuntime.log(`Start with: ${hint}`);
      }
    }
    return false;
  }
  try {
    await service.restart({ env: process.env, stdout });
    let restarted = true;
    try {
      restarted = await service.isLoaded({ env: process.env });
    } catch {
      restarted = true;
    }
    emit({
      ok: true,
      result: 'restarted',
      service: buildDaemonServiceSnapshot(service, restarted)
    });
    return true;
  } catch (err) {
    const hints = renderGatewayServiceStartHints();
    fail(`Gateway restart failed: ${String(err)}`, hints);
    return false;
  }
}
__name(runDaemonRestart, 'runDaemonRestart');
export {
  runDaemonRestart,
  runDaemonStart,
  runDaemonStop,
  runDaemonUninstall
};
