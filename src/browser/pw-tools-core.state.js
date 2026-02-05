import { devices as playwrightDevices } from 'playwright-core';
import { ensurePageState, getPageForTargetId } from './pw-session.js';

// SECURITY: This module handles security-sensitive operations.
// Changes should be reviewed carefully for security implications.

async function withCdpSession(page, fn) {
  const session = await page.context().newCDPSession(page);
  try {
    return await fn(session);
  } finally {
    await session.detach().catch(() => {
    });
  }
}
async function setOfflineViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.context().setOffline(Boolean(opts.offline));
}
async function setExtraHTTPHeadersViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.context().setExtraHTTPHeaders(opts.headers);
}
async function setHttpCredentialsViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  if (opts.clear) {
    await page.context().setHTTPCredentials(null);
    return;
  }
  const username = String(opts.username ?? '');
  const password = String(opts.password ?? '');
  if (!username) {
    throw new Error('username is required (or set clear=true)');
  }
  await page.context().setHTTPCredentials({ username, password });
}
async function setGeolocationViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const context = page.context();
  if (opts.clear) {
    await context.setGeolocation(null);
    await context.clearPermissions().catch(() => {
    });
    return;
  }
  if (typeof opts.latitude !== 'number' || typeof opts.longitude !== 'number') {
    throw new Error('latitude and longitude are required (or set clear=true)');
  }
  await context.setGeolocation({
    latitude: opts.latitude,
    longitude: opts.longitude,
    accuracy: typeof opts.accuracy === 'number' ? opts.accuracy : void 0
  });
  const origin = opts.origin?.trim() || (() => {
    try {
      return new URL(page.url()).origin;
    } catch {
      return '';
    }
  })();
  if (origin) {
    await context.grantPermissions(['geolocation'], { origin }).catch(() => {
    });
  }
}
async function emulateMediaViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.emulateMedia({ colorScheme: opts.colorScheme });
}
async function setLocaleViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const locale = String(opts.locale ?? '').trim();
  if (!locale) {
    throw new Error('locale is required');
  }
  await withCdpSession(page, async (session) => {
    try {
      await session.send('Emulation.setLocaleOverride', { locale });
    } catch (err) {
      if (String(err).includes('Another locale override is already in effect')) {
        return;
      }
      throw err;
    }
  });
}
async function setTimezoneViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const timezoneId = String(opts.timezoneId ?? '').trim();
  if (!timezoneId) {
    throw new Error('timezoneId is required');
  }
  await withCdpSession(page, async (session) => {
    try {
      await session.send('Emulation.setTimezoneOverride', { timezoneId });
    } catch (err) {
      const msg = String(err);
      if (msg.includes('Timezone override is already in effect')) {
        return;
      }
      if (msg.includes('Invalid timezone')) {
        throw new Error(`Invalid timezone ID: ${timezoneId}`, { cause: err });
      }
      throw err;
    }
  });
}
async function setDeviceViaPlaywright(opts) {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const name = String(opts.name ?? '').trim();
  if (!name) {
    throw new Error('device name is required');
  }
  const descriptor = playwrightDevices[name];
  if (!descriptor) {
    throw new Error(`Unknown device "${name}".`);
  }
  if (descriptor.viewport) {
    await page.setViewportSize({
      width: descriptor.viewport.width,
      height: descriptor.viewport.height
    });
  }
  await withCdpSession(page, async (session) => {
    if (descriptor.userAgent || descriptor.locale) {
      await session.send('Emulation.setUserAgentOverride', {
        userAgent: descriptor.userAgent ?? '',
        acceptLanguage: descriptor.locale ?? void 0
      });
    }
    if (descriptor.viewport) {
      await session.send('Emulation.setDeviceMetricsOverride', {
        mobile: Boolean(descriptor.isMobile),
        width: descriptor.viewport.width,
        height: descriptor.viewport.height,
        deviceScaleFactor: descriptor.deviceScaleFactor ?? 1,
        screenWidth: descriptor.viewport.width,
        screenHeight: descriptor.viewport.height
      });
    }
    if (descriptor.hasTouch) {
      await session.send('Emulation.setTouchEmulationEnabled', {
        enabled: true
      });
    }
  });
}
export {
  emulateMediaViaPlaywright,
  setDeviceViaPlaywright,
  setExtraHTTPHeadersViaPlaywright,
  setGeolocationViaPlaywright,
  setHttpCredentialsViaPlaywright,
  setLocaleViaPlaywright,
  setOfflineViaPlaywright,
  setTimezoneViaPlaywright
};
