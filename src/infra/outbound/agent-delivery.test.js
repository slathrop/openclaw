/**
 * Tests for agent-delivery.
 * @module
 */

import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  resolveOutboundTarget: vi.fn(() => ({ ok: true, to: '+1999' }))
}));
vi.mock('./targets.js', async () => {
  const actual = await vi.importActual('./targets.js');
  return {
    ...actual,
    resolveOutboundTarget: mocks.resolveOutboundTarget
  };
});
import { resolveAgentDeliveryPlan, resolveAgentOutboundTarget } from './agent-delivery.js';
describe('agent delivery helpers', () => {
  it('builds a delivery plan from session delivery context', () => {
    const plan = resolveAgentDeliveryPlan({
      sessionEntry: {
        deliveryContext: { channel: 'whatsapp', to: '+1555', accountId: 'work' }
      },
      requestedChannel: 'last',
      explicitTo: void 0,
      accountId: void 0,
      wantsDelivery: true
    });
    expect(plan.resolvedChannel).toBe('whatsapp');
    expect(plan.resolvedTo).toBe('+1555');
    expect(plan.resolvedAccountId).toBe('work');
    expect(plan.deliveryTargetMode).toBe('implicit');
  });
  it('resolves fallback targets when no explicit destination is provided', () => {
    const plan = resolveAgentDeliveryPlan({
      sessionEntry: {
        deliveryContext: { channel: 'whatsapp' }
      },
      requestedChannel: 'last',
      explicitTo: void 0,
      accountId: void 0,
      wantsDelivery: true
    });
    const resolved = resolveAgentOutboundTarget({
      cfg: {},
      plan,
      targetMode: 'implicit'
    });
    expect(mocks.resolveOutboundTarget).toHaveBeenCalledTimes(1);
    expect(resolved.resolvedTarget?.ok).toBe(true);
    expect(resolved.resolvedTo).toBe('+1999');
  });
  it('skips outbound target resolution when explicit target validation is disabled', () => {
    const plan = resolveAgentDeliveryPlan({
      sessionEntry: {
        deliveryContext: { channel: 'whatsapp', to: '+1555' }
      },
      requestedChannel: 'last',
      explicitTo: '+1555',
      accountId: void 0,
      wantsDelivery: true
    });
    mocks.resolveOutboundTarget.mockClear();
    const resolved = resolveAgentOutboundTarget({
      cfg: {},
      plan,
      targetMode: 'explicit',
      validateExplicitTarget: false
    });
    expect(mocks.resolveOutboundTarget).not.toHaveBeenCalled();
    expect(resolved.resolvedTo).toBe('+1555');
  });
});
