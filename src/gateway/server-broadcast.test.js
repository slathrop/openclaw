import { describe, expect, it, vi } from 'vitest';
import { createGatewayBroadcaster } from './server-broadcast.js';
describe('gateway broadcaster', () => {
  it('filters approval and pairing events by scope', () => {
    const approvalsSocket = {
      bufferedAmount: 0,
      send: vi.fn(),
      close: vi.fn()
    };
    const pairingSocket = {
      bufferedAmount: 0,
      send: vi.fn(),
      close: vi.fn()
    };
    const readSocket = {
      bufferedAmount: 0,
      send: vi.fn(),
      close: vi.fn()
    };
    const clients = /* @__PURE__ */ new Set([
      {
        socket: approvalsSocket,
        connect: { role: 'operator', scopes: ['operator.approvals'] },
        connId: 'c-approvals'
      },
      {
        socket: pairingSocket,
        connect: { role: 'operator', scopes: ['operator.pairing'] },
        connId: 'c-pairing'
      },
      {
        socket: readSocket,
        connect: { role: 'operator', scopes: ['operator.read'] },
        connId: 'c-read'
      }
    ]);
    const { broadcast, broadcastToConnIds } = createGatewayBroadcaster({ clients });
    broadcast('exec.approval.requested', { id: '1' });
    broadcast('device.pair.requested', { requestId: 'r1' });
    expect(approvalsSocket.send).toHaveBeenCalledTimes(1);
    expect(pairingSocket.send).toHaveBeenCalledTimes(1);
    expect(readSocket.send).toHaveBeenCalledTimes(0);
    broadcastToConnIds('tick', { ts: 1 }, /* @__PURE__ */ new Set(['c-read']));
    expect(readSocket.send).toHaveBeenCalledTimes(1);
    expect(approvalsSocket.send).toHaveBeenCalledTimes(1);
    expect(pairingSocket.send).toHaveBeenCalledTimes(1);
  });
});
