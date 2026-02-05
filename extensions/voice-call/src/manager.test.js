import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { VoiceCallConfigSchema } from './config.js';
import { CallManager } from './manager.js';
class FakeProvider {
  name = 'plivo';
  playTtsCalls = [];
  hangupCalls = [];
  verifyWebhook(_ctx) {
    return { ok: true };
  }
  parseWebhookEvent(_ctx) {
    return { events: [], statusCode: 200 };
  }
  async initiateCall(_input) {
    return { providerCallId: 'request-uuid', status: 'initiated' };
  }
  async hangupCall(input) {
    this.hangupCalls.push(input);
  }
  async playTts(input) {
    this.playTtsCalls.push(input);
  }
  async startListening(_input) {
  }
  async stopListening(_input) {
  }
}
describe('CallManager', () => {
  it('upgrades providerCallId mapping when provider ID changes', async () => {
    const config = VoiceCallConfigSchema.parse({
      enabled: true,
      provider: 'plivo',
      fromNumber: '+15550000000'
    });
    const storePath = path.join(os.tmpdir(), `openclaw-voice-call-test-${Date.now()}`);
    const manager = new CallManager(config, storePath);
    manager.initialize(new FakeProvider(), 'https://example.com/voice/webhook');
    const { callId, success, error } = await manager.initiateCall('+15550000001');
    expect(success).toBe(true);
    expect(error).toBeUndefined();
    expect(manager.getCall(callId)?.providerCallId).toBe('request-uuid');
    expect(manager.getCallByProviderCallId('request-uuid')?.callId).toBe(callId);
    manager.processEvent({
      id: 'evt-1',
      type: 'call.answered',
      callId,
      providerCallId: 'call-uuid',
      timestamp: Date.now()
    });
    expect(manager.getCall(callId)?.providerCallId).toBe('call-uuid');
    expect(manager.getCallByProviderCallId('call-uuid')?.callId).toBe(callId);
    expect(manager.getCallByProviderCallId('request-uuid')).toBeUndefined();
  });
  it('speaks initial message on answered for notify mode (non-Twilio)', async () => {
    const config = VoiceCallConfigSchema.parse({
      enabled: true,
      provider: 'plivo',
      fromNumber: '+15550000000'
    });
    const storePath = path.join(os.tmpdir(), `openclaw-voice-call-test-${Date.now()}`);
    const provider = new FakeProvider();
    const manager = new CallManager(config, storePath);
    manager.initialize(provider, 'https://example.com/voice/webhook');
    const { callId, success } = await manager.initiateCall('+15550000002', void 0, {
      message: 'Hello there',
      mode: 'notify'
    });
    expect(success).toBe(true);
    manager.processEvent({
      id: 'evt-2',
      type: 'call.answered',
      callId,
      providerCallId: 'call-uuid',
      timestamp: Date.now()
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(provider.playTtsCalls).toHaveLength(1);
    expect(provider.playTtsCalls[0]?.text).toBe('Hello there');
  });
  it('rejects inbound calls with missing caller ID when allowlist enabled', () => {
    const config = VoiceCallConfigSchema.parse({
      enabled: true,
      provider: 'plivo',
      fromNumber: '+15550000000',
      inboundPolicy: 'allowlist',
      allowFrom: ['+15550001234']
    });
    const storePath = path.join(os.tmpdir(), `openclaw-voice-call-test-${Date.now()}`);
    const provider = new FakeProvider();
    const manager = new CallManager(config, storePath);
    manager.initialize(provider, 'https://example.com/voice/webhook');
    manager.processEvent({
      id: 'evt-allowlist-missing',
      type: 'call.initiated',
      callId: 'call-missing',
      providerCallId: 'provider-missing',
      timestamp: Date.now(),
      direction: 'inbound',
      to: '+15550000000'
    });
    expect(manager.getCallByProviderCallId('provider-missing')).toBeUndefined();
    expect(provider.hangupCalls).toHaveLength(1);
    expect(provider.hangupCalls[0]?.providerCallId).toBe('provider-missing');
  });
  it('rejects inbound calls that only match allowlist suffixes', () => {
    const config = VoiceCallConfigSchema.parse({
      enabled: true,
      provider: 'plivo',
      fromNumber: '+15550000000',
      inboundPolicy: 'allowlist',
      allowFrom: ['+15550001234']
    });
    const storePath = path.join(os.tmpdir(), `openclaw-voice-call-test-${Date.now()}`);
    const provider = new FakeProvider();
    const manager = new CallManager(config, storePath);
    manager.initialize(provider, 'https://example.com/voice/webhook');
    manager.processEvent({
      id: 'evt-allowlist-suffix',
      type: 'call.initiated',
      callId: 'call-suffix',
      providerCallId: 'provider-suffix',
      timestamp: Date.now(),
      direction: 'inbound',
      from: '+99915550001234',
      to: '+15550000000'
    });
    expect(manager.getCallByProviderCallId('provider-suffix')).toBeUndefined();
    expect(provider.hangupCalls).toHaveLength(1);
    expect(provider.hangupCalls[0]?.providerCallId).toBe('provider-suffix');
  });
  it('accepts inbound calls that exactly match the allowlist', () => {
    const config = VoiceCallConfigSchema.parse({
      enabled: true,
      provider: 'plivo',
      fromNumber: '+15550000000',
      inboundPolicy: 'allowlist',
      allowFrom: ['+15550001234']
    });
    const storePath = path.join(os.tmpdir(), `openclaw-voice-call-test-${Date.now()}`);
    const manager = new CallManager(config, storePath);
    manager.initialize(new FakeProvider(), 'https://example.com/voice/webhook');
    manager.processEvent({
      id: 'evt-allowlist-exact',
      type: 'call.initiated',
      callId: 'call-exact',
      providerCallId: 'provider-exact',
      timestamp: Date.now(),
      direction: 'inbound',
      from: '+15550001234',
      to: '+15550000000'
    });
    expect(manager.getCallByProviderCallId('provider-exact')).toBeDefined();
  });
});
