import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { GatewayClient } from '../src/gateway/client.js';
import { loadOrCreateDeviceIdentity } from '../src/infra/device-identity.js';
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from '../src/utils/message-channel.js';
const GATEWAY_START_TIMEOUT_MS = 45e3;
const E2E_TIMEOUT_MS = 12e4;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getFreePort = async () => {
  const srv = net.createServer();
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const addr = srv.address();
  if (!addr || typeof addr === 'string') {
    srv.close();
    throw new Error('failed to bind ephemeral port');
  }
  await new Promise((resolve) => srv.close(() => resolve()));
  return addr.port;
};
const waitForPortOpen = async (proc, chunksOut, chunksErr, port, timeoutMs) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (proc.exitCode !== null) {
      const stdout2 = chunksOut.join('');
      const stderr2 = chunksErr.join('');
      throw new Error(
        `gateway exited before listening (code=${String(proc.exitCode)} signal=${String(proc.signalCode)})
--- stdout ---
${stdout2}
--- stderr ---
${stderr2}`
      );
    }
    try {
      await new Promise((resolve, reject) => {
        const socket = net.connect({ host: '127.0.0.1', port });
        socket.once('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.once('error', (err) => {
          socket.destroy();
          reject(err);
        });
      });
      return;
    } catch {
      // Retry on parse failure
    }
    await sleep(25);
  }
  const stdout = chunksOut.join('');
  const stderr = chunksErr.join('');
  throw new Error(
    `timeout waiting for gateway to listen on port ${port}
--- stdout ---
${stdout}
--- stderr ---
${stderr}`
  );
};
const spawnGatewayInstance = async (name) => {
  const port = await getFreePort();
  const hookToken = `token-${name}-${randomUUID()}`;
  const gatewayToken = `gateway-${name}-${randomUUID()}`;
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), `openclaw-e2e-${name}-`));
  const configDir = path.join(homeDir, '.openclaw');
  await fs.mkdir(configDir, { recursive: true });
  const configPath = path.join(configDir, 'openclaw.json');
  const stateDir = path.join(configDir, 'state');
  const config = {
    gateway: { port, auth: { mode: 'token', token: gatewayToken } },
    hooks: { enabled: true, token: hookToken, path: '/hooks' }
  };
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
  const stdout = [];
  const stderr = [];
  let child = null;
  try {
    child = spawn(
      'node',
      [
        'dist/index.js',
        'gateway',
        '--port',
        String(port),
        '--bind',
        'loopback',
        '--allow-unconfigured'
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          HOME: homeDir,
          OPENCLAW_CONFIG_PATH: configPath,
          OPENCLAW_STATE_DIR: stateDir,
          OPENCLAW_GATEWAY_TOKEN: '',
          OPENCLAW_GATEWAY_PASSWORD: '',
          OPENCLAW_SKIP_CHANNELS: '1',
          OPENCLAW_SKIP_BROWSER_CONTROL_SERVER: '1',
          OPENCLAW_SKIP_CANVAS_HOST: '1'
        },
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (d) => stdout.push(String(d)));
    child.stderr?.on('data', (d) => stderr.push(String(d)));
    await waitForPortOpen(child, stdout, stderr, port, GATEWAY_START_TIMEOUT_MS);
    return {
      name,
      port,
      hookToken,
      gatewayToken,
      homeDir,
      stateDir,
      configPath,
      child,
      stdout,
      stderr
    };
  } catch (err) {
    if (child && child.exitCode === null && !child.killed) {
      try {
        child.kill('SIGKILL');
      } catch {
        // Intentionally ignored - best effort cleanup
      }
    }
    await fs.rm(homeDir, { recursive: true, force: true });
    throw err;
  }
};
const stopGatewayInstance = async (inst) => {
  if (inst.child.exitCode === null && !inst.child.killed) {
    try {
      inst.child.kill('SIGTERM');
    } catch {
      // Intentionally ignored - best effort cleanup
    }
  }
  const exited = await Promise.race([
    new Promise((resolve) => {
      if (inst.child.exitCode !== null) {
        return resolve(true);
      }
      inst.child.once('exit', () => resolve(true));
    }),
    sleep(5e3).then(() => false)
  ]);
  if (!exited && inst.child.exitCode === null && !inst.child.killed) {
    try {
      inst.child.kill('SIGKILL');
    } catch {
      // Intentionally ignored - best effort cleanup
    }
  }
  await fs.rm(inst.homeDir, { recursive: true, force: true });
};
const runCliJson = async (args, env) => {
  const stdout = [];
  const stderr = [];
  const child = spawn('node', ['dist/index.js', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (d) => stdout.push(String(d)));
  child.stderr?.on('data', (d) => stderr.push(String(d)));
  const result = await new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
  const out = stdout.join('').trim();
  if (result.code !== 0) {
    throw new Error(
      `cli failed (code=${String(result.code)} signal=${String(result.signal)})
--- stdout ---
${out}
--- stderr ---
${stderr.join('')}`
    );
  }
  try {
    return out ? JSON.parse(out) : null;
  } catch (err) {
    throw new Error(
      `cli returned non-json output: ${String(err)}
--- stdout ---
${out}
--- stderr ---
${stderr.join('')}`,
      { cause: err }
    );
  }
};
const postJson = async (url, body) => {
  const payload = JSON.stringify(body);
  const parsed = new URL(url);
  return await new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        method: 'POST',
        hostname: parsed.hostname,
        port: Number(parsed.port),
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let json = null;
          if (data.trim()) {
            try {
              json = JSON.parse(data);
            } catch {
              json = data;
            }
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
};
const connectNode = async (inst, label) => {
  const identityPath = path.join(inst.homeDir, `${label}-device.json`);
  const deviceIdentity = loadOrCreateDeviceIdentity(identityPath);
  const nodeId = deviceIdentity.deviceId;
  let settled = false;
  let resolveReady = null;
  let rejectReady = null;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const client = new GatewayClient({
    url: `ws://127.0.0.1:${inst.port}`,
    token: inst.gatewayToken,
    clientName: GATEWAY_CLIENT_NAMES.NODE_HOST,
    clientDisplayName: label,
    clientVersion: '1.0.0',
    platform: 'ios',
    mode: GATEWAY_CLIENT_MODES.NODE,
    role: 'node',
    scopes: [],
    caps: ['system'],
    commands: ['system.run'],
    deviceIdentity,
    onHelloOk: () => {
      if (settled) {
        return;
      }
      settled = true;
      resolveReady?.();
    },
    onConnectError: (err) => {
      if (settled) {
        return;
      }
      settled = true;
      rejectReady?.(err);
    },
    onClose: (code, reason) => {
      if (settled) {
        return;
      }
      settled = true;
      rejectReady?.(new Error(`gateway closed (${code}): ${reason}`));
    }
  });
  client.start();
  try {
    await Promise.race([
      ready,
      sleep(1e4).then(() => {
        throw new Error(`timeout waiting for ${label} to connect`);
      })
    ]);
  } catch (err) {
    client.stop();
    throw err;
  }
  return { client, nodeId };
};
const waitForNodeStatus = async (inst, nodeId, timeoutMs = 1e4) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = await runCliJson(
      ['nodes', 'status', '--json', '--url', `ws://127.0.0.1:${inst.port}`],
      {
        OPENCLAW_GATEWAY_TOKEN: inst.gatewayToken,
        OPENCLAW_GATEWAY_PASSWORD: ''
      }
    );
    const match = list.nodes?.find((n) => n.nodeId === nodeId);
    if (match?.connected && match?.paired) {
      return;
    }
    await sleep(50);
  }
  throw new Error(`timeout waiting for node status for ${nodeId}`);
};
describe('gateway multi-instance e2e', () => {
  const instances = [];
  const nodeClients = [];
  afterAll(async () => {
    for (const client of nodeClients) {
      client.stop();
    }
    for (const inst of instances) {
      await stopGatewayInstance(inst);
    }
  });
  it(
    'spins up two gateways and exercises WS + HTTP + node pairing',
    { timeout: E2E_TIMEOUT_MS },
    async () => {
      const gwA = await spawnGatewayInstance('a');
      instances.push(gwA);
      const gwB = await spawnGatewayInstance('b');
      instances.push(gwB);
      const [healthA, healthB] = await Promise.all([
        runCliJson(['health', '--json', '--timeout', '10000'], {
          OPENCLAW_GATEWAY_PORT: String(gwA.port),
          OPENCLAW_GATEWAY_TOKEN: gwA.gatewayToken,
          OPENCLAW_GATEWAY_PASSWORD: ''
        }),
        runCliJson(['health', '--json', '--timeout', '10000'], {
          OPENCLAW_GATEWAY_PORT: String(gwB.port),
          OPENCLAW_GATEWAY_TOKEN: gwB.gatewayToken,
          OPENCLAW_GATEWAY_PASSWORD: ''
        })
      ]);
      expect(healthA.ok).toBe(true);
      expect(healthB.ok).toBe(true);
      const [hookResA, hookResB] = await Promise.all([
        postJson(`http://127.0.0.1:${gwA.port}/hooks/wake?token=${gwA.hookToken}`, {
          text: 'wake a',
          mode: 'now'
        }),
        postJson(`http://127.0.0.1:${gwB.port}/hooks/wake?token=${gwB.hookToken}`, {
          text: 'wake b',
          mode: 'now'
        })
      ]);
      expect(hookResA.status).toBe(200);
      expect(hookResA.json?.ok).toBe(true);
      expect(hookResB.status).toBe(200);
      expect(hookResB.json?.ok).toBe(true);
      const nodeA = await connectNode(gwA, 'node-a');
      const nodeB = await connectNode(gwB, 'node-b');
      nodeClients.push(nodeA.client, nodeB.client);
      await Promise.all([
        waitForNodeStatus(gwA, nodeA.nodeId),
        waitForNodeStatus(gwB, nodeB.nodeId)
      ]);
    }
  );
});
