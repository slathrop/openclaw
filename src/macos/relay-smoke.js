function parseRelaySmokeTest(args, env) {
  const smokeIdx = args.indexOf('--smoke');
  if (smokeIdx !== -1) {
    const value = args[smokeIdx + 1];
    if (!value || value.startsWith('-')) {
      throw new Error('Missing value for --smoke (expected: qr)');
    }
    if (value === 'qr') {
      return 'qr';
    }
    throw new Error(`Unknown smoke test: ${value}`);
  }
  if (args.includes('--smoke-qr')) {
    return 'qr';
  }
  if (args.length === 0 && (env.OPENCLAW_SMOKE_QR === '1' || env.OPENCLAW_SMOKE === 'qr')) {
    return 'qr';
  }
  return null;
}
async function runRelaySmokeTest(test) {
  switch (test) {
    case 'qr': {
      const { renderQrPngBase64 } = await import('../web/qr-image.js');
      await renderQrPngBase64('smoke-test');
      return;
    }
  }
}
export {
  parseRelaySmokeTest,
  runRelaySmokeTest
};
