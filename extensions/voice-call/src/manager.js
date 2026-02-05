import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isAllowlistedCaller, normalizePhoneNumber } from './allowlist.js';
import {
  CallRecordSchema,
  TerminalStates
} from './types.js';
import { resolveUserPath } from './utils.js';
import { escapeXml, mapVoiceToPolly } from './voice-mapping.js';
function resolveDefaultStoreBase(config, storePath) {
  const rawOverride = storePath?.trim() || config.store?.trim();
  if (rawOverride) {
    return resolveUserPath(rawOverride);
  }
  const preferred = path.join(os.homedir(), '.openclaw', 'voice-calls');
  const candidates = [preferred].map((dir) => resolveUserPath(dir));
  const existing = candidates.find((dir) => {
    try {
      return fs.existsSync(path.join(dir, 'calls.jsonl')) || fs.existsSync(dir);
    } catch {
      return false;
    }
  }) ?? resolveUserPath(preferred);
  return existing;
}
class CallManager {
  _activeCalls = /* @__PURE__ */ new Map();
  _providerCallIdMap = /* @__PURE__ */ new Map();
  // providerCallId -> internal callId
  _processedEventIds = /* @__PURE__ */ new Set();
  _provider = null;
  _config;
  _storePath;
  _webhookUrl = null;
  _transcriptWaiters = /* @__PURE__ */ new Map();
  /** Max duration timers to auto-hangup calls after configured timeout */
  _maxDurationTimers = /* @__PURE__ */ new Map();
  constructor(config, storePath) {
    this._config = config;
    this._storePath = resolveDefaultStoreBase(config, storePath);
  }
  /**
   * Initialize the call manager with a provider.
   */
  initialize(provider, webhookUrl) {
    this._provider = provider;
    this._webhookUrl = webhookUrl;
    fs.mkdirSync(this._storePath, { recursive: true });
    this._loadActiveCalls();
  }
  /**
   * Get the current provider.
   */
  getProvider() {
    return this._provider;
  }
  /**
   * Initiate an outbound call.
   * @param to - The phone number to call
   * @param sessionKey - Optional session key for context
   * @param options - Optional call options (message, mode)
   */
  async initiateCall(to, sessionKey, options) {
    const opts = typeof options === 'string' ? { message: options } : options ?? {};
    const initialMessage = opts.message;
    const mode = opts.mode ?? this._config.outbound.defaultMode;
    if (!this._provider) {
      return { callId: '', success: false, error: 'Provider not initialized' };
    }
    if (!this._webhookUrl) {
      return {
        callId: '',
        success: false,
        error: 'Webhook URL not configured'
      };
    }
    const activeCalls = this.getActiveCalls();
    if (activeCalls.length >= this._config.maxConcurrentCalls) {
      return {
        callId: '',
        success: false,
        error: `Maximum concurrent calls (${this._config.maxConcurrentCalls}) reached`
      };
    }
    const callId = crypto.randomUUID();
    const from = this._config.fromNumber || (this._provider?.name === 'mock' ? '+15550000000' : void 0);
    if (!from) {
      return { callId: '', success: false, error: 'fromNumber not configured' };
    }
    const callRecord = {
      callId,
      provider: this._provider.name,
      direction: 'outbound',
      state: 'initiated',
      from,
      to,
      sessionKey,
      startedAt: Date.now(),
      transcript: [],
      processedEventIds: [],
      metadata: {
        ...initialMessage && { initialMessage },
        mode
      }
    };
    this._activeCalls.set(callId, callRecord);
    this._persistCallRecord(callRecord);
    try {
      let inlineTwiml;
      if (mode === 'notify' && initialMessage) {
        const pollyVoice = mapVoiceToPolly(this._config.tts?.openai?.voice);
        inlineTwiml = this._generateNotifyTwiml(initialMessage, pollyVoice);
        console.log(`[voice-call] Using inline TwiML for notify mode (voice: ${pollyVoice})`);
      }
      const result = await this._provider.initiateCall({
        callId,
        from,
        to,
        webhookUrl: this._webhookUrl,
        inlineTwiml
      });
      callRecord.providerCallId = result.providerCallId;
      this._providerCallIdMap.set(result.providerCallId, callId);
      this._persistCallRecord(callRecord);
      return { callId, success: true };
    } catch (err) {
      callRecord.state = 'failed';
      callRecord.endedAt = Date.now();
      callRecord.endReason = 'failed';
      this._persistCallRecord(callRecord);
      this._activeCalls.delete(callId);
      if (callRecord.providerCallId) {
        this._providerCallIdMap.delete(callRecord.providerCallId);
      }
      return {
        callId,
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
  /**
   * Speak to user in an active call.
   */
  async speak(callId, text) {
    const call = this._activeCalls.get(callId);
    if (!call) {
      return { success: false, error: 'Call not found' };
    }
    if (!this._provider || !call.providerCallId) {
      return { success: false, error: 'Call not connected' };
    }
    if (TerminalStates.has(call.state)) {
      return { success: false, error: 'Call has ended' };
    }
    try {
      call.state = 'speaking';
      this._persistCallRecord(call);
      this._addTranscriptEntry(call, 'bot', text);
      const voice = this._provider?.name === 'twilio' ? this._config.tts?.openai?.voice : void 0;
      await this._provider.playTts({
        callId,
        providerCallId: call.providerCallId,
        text,
        voice
      });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
  /**
   * Speak the initial message for a call (called when media stream connects).
   * This is used to auto-play the message passed to initiateCall.
   * In notify mode, auto-hangup after the message is delivered.
   */
  async speakInitialMessage(providerCallId) {
    const call = this.getCallByProviderCallId(providerCallId);
    if (!call) {
      console.warn(`[voice-call] speakInitialMessage: no call found for ${providerCallId}`);
      return;
    }
    const initialMessage = call.metadata?.initialMessage;
    const mode = call.metadata?.mode ?? 'conversation';
    if (!initialMessage) {
      console.log(`[voice-call] speakInitialMessage: no initial message for ${call.callId}`);
      return;
    }
    if (call.metadata) {
      delete call.metadata.initialMessage;
      this._persistCallRecord(call);
    }
    console.log(`[voice-call] Speaking initial message for call ${call.callId} (mode: ${mode})`);
    const result = await this.speak(call.callId, initialMessage);
    if (!result.success) {
      console.warn(`[voice-call] Failed to speak initial message: ${result.error}`);
      return;
    }
    if (mode === 'notify') {
      const delaySec = this._config.outbound.notifyHangupDelaySec;
      console.log(`[voice-call] Notify mode: auto-hangup in ${delaySec}s for call ${call.callId}`);
      setTimeout(async () => {
        const currentCall = this.getCall(call.callId);
        if (currentCall && !TerminalStates.has(currentCall.state)) {
          console.log(`[voice-call] Notify mode: hanging up call ${call.callId}`);
          await this.endCall(call.callId);
        }
      }, delaySec * 1e3);
    }
  }
  /**
   * Start max duration timer for a call.
   * Auto-hangup when maxDurationSeconds is reached.
   */
  _startMaxDurationTimer(callId) {
    this._clearMaxDurationTimer(callId);
    const maxDurationMs = this._config.maxDurationSeconds * 1e3;
    console.log(
      `[voice-call] Starting max duration timer (${this._config.maxDurationSeconds}s) for call ${callId}`
    );
    const timer = setTimeout(async () => {
      this._maxDurationTimers.delete(callId);
      const call = this.getCall(callId);
      if (call && !TerminalStates.has(call.state)) {
        console.log(
          `[voice-call] Max duration reached (${this._config.maxDurationSeconds}s), ending call ${callId}`
        );
        call.endReason = 'timeout';
        this._persistCallRecord(call);
        await this.endCall(callId);
      }
    }, maxDurationMs);
    this._maxDurationTimers.set(callId, timer);
  }
  /**
   * Clear max duration timer for a call.
   */
  _clearMaxDurationTimer(callId) {
    const timer = this._maxDurationTimers.get(callId);
    if (timer) {
      clearTimeout(timer);
      this._maxDurationTimers.delete(callId);
    }
  }
  _clearTranscriptWaiter(callId) {
    const waiter = this._transcriptWaiters.get(callId);
    if (!waiter) {
      return;
    }
    clearTimeout(waiter.timeout);
    this._transcriptWaiters.delete(callId);
  }
  _rejectTranscriptWaiter(callId, reason) {
    const waiter = this._transcriptWaiters.get(callId);
    if (!waiter) {
      return;
    }
    this._clearTranscriptWaiter(callId);
    waiter.reject(new Error(reason));
  }
  _resolveTranscriptWaiter(callId, transcript) {
    const waiter = this._transcriptWaiters.get(callId);
    if (!waiter) {
      return;
    }
    this._clearTranscriptWaiter(callId);
    waiter.resolve(transcript);
  }
  _waitForFinalTranscript(callId) {
    this._rejectTranscriptWaiter(callId, 'Transcript waiter replaced');
    const timeoutMs = this._config.transcriptTimeoutMs;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._transcriptWaiters.delete(callId);
        reject(new Error(`Timed out waiting for transcript after ${timeoutMs}ms`));
      }, timeoutMs);
      this._transcriptWaiters.set(callId, { resolve, reject, timeout });
    });
  }
  /**
   * Continue call: speak prompt, then wait for user's final transcript.
   */
  async continueCall(callId, prompt) {
    const call = this._activeCalls.get(callId);
    if (!call) {
      return { success: false, error: 'Call not found' };
    }
    if (!this._provider || !call.providerCallId) {
      return { success: false, error: 'Call not connected' };
    }
    if (TerminalStates.has(call.state)) {
      return { success: false, error: 'Call has ended' };
    }
    try {
      await this.speak(callId, prompt);
      call.state = 'listening';
      this._persistCallRecord(call);
      await this._provider.startListening({
        callId,
        providerCallId: call.providerCallId
      });
      const transcript = await this._waitForFinalTranscript(callId);
      await this._provider.stopListening({
        callId,
        providerCallId: call.providerCallId
      });
      return { success: true, transcript };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    } finally {
      this._clearTranscriptWaiter(callId);
    }
  }
  /**
   * End an active call.
   */
  async endCall(callId) {
    const call = this._activeCalls.get(callId);
    if (!call) {
      return { success: false, error: 'Call not found' };
    }
    if (!this._provider || !call.providerCallId) {
      return { success: false, error: 'Call not connected' };
    }
    if (TerminalStates.has(call.state)) {
      return { success: true };
    }
    try {
      await this._provider.hangupCall({
        callId,
        providerCallId: call.providerCallId,
        reason: 'hangup-bot'
      });
      call.state = 'hangup-bot';
      call.endedAt = Date.now();
      call.endReason = 'hangup-bot';
      this._persistCallRecord(call);
      this._clearMaxDurationTimer(callId);
      this._rejectTranscriptWaiter(callId, 'Call ended: hangup-bot');
      this._activeCalls.delete(callId);
      if (call.providerCallId) {
        this._providerCallIdMap.delete(call.providerCallId);
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
  /**
   * Check if an inbound call should be accepted based on policy.
   */
  _shouldAcceptInbound(from) {
    const { inboundPolicy: policy, allowFrom } = this._config;
    switch (policy) {
      case 'disabled':
        console.log('[voice-call] Inbound call rejected: policy is disabled');
        return false;
      case 'open':
        console.log('[voice-call] Inbound call accepted: policy is open');
        return true;
      case 'allowlist':
      case 'pairing': {
        const normalized = normalizePhoneNumber(from);
        if (!normalized) {
          console.log('[voice-call] Inbound call rejected: missing caller ID');
          return false;
        }
        const allowed = isAllowlistedCaller(normalized, allowFrom);
        const status = allowed ? 'accepted' : 'rejected';
        console.log(
          `[voice-call] Inbound call ${status}: ${from} ${allowed ? 'is in' : 'not in'} allowlist`
        );
        return allowed;
      }
      default:
        return false;
    }
  }
  /**
   * Create a call record for an inbound call.
   */
  _createInboundCall(providerCallId, from, to) {
    const callId = crypto.randomUUID();
    const callRecord = {
      callId,
      providerCallId,
      provider: this._provider?.name || 'twilio',
      direction: 'inbound',
      state: 'ringing',
      from,
      to,
      startedAt: Date.now(),
      transcript: [],
      processedEventIds: [],
      metadata: {
        initialMessage: this._config.inboundGreeting || 'Hello! How can I help you today?'
      }
    };
    this._activeCalls.set(callId, callRecord);
    this._providerCallIdMap.set(providerCallId, callId);
    this._persistCallRecord(callRecord);
    console.log(`[voice-call] Created inbound call record: ${callId} from ${from}`);
    return callRecord;
  }
  /**
   * Look up a call by either internal callId or providerCallId.
   */
  _findCall(callIdOrProviderCallId) {
    const directCall = this._activeCalls.get(callIdOrProviderCallId);
    if (directCall) {
      return directCall;
    }
    return this.getCallByProviderCallId(callIdOrProviderCallId);
  }
  /**
   * Process a webhook event.
   */
  processEvent(event) {
    if (this._processedEventIds.has(event.id)) {
      return;
    }
    this._processedEventIds.add(event.id);
    let call = this._findCall(event.callId);
    if (!call && event.direction === 'inbound' && event.providerCallId) {
      if (!this._shouldAcceptInbound(event.from)) {
        void this.rejectInboundCall(event);
        return;
      }
      call = this._createInboundCall(
        event.providerCallId,
        event.from || 'unknown',
        event.to || this._config.fromNumber || 'unknown'
      );
      event.callId = call.callId;
    }
    if (!call) {
      return;
    }
    if (event.providerCallId && event.providerCallId !== call.providerCallId) {
      const previousProviderCallId = call.providerCallId;
      call.providerCallId = event.providerCallId;
      this._providerCallIdMap.set(event.providerCallId, call.callId);
      if (previousProviderCallId) {
        const mapped = this._providerCallIdMap.get(previousProviderCallId);
        if (mapped === call.callId) {
          this._providerCallIdMap.delete(previousProviderCallId);
        }
      }
    }
    call.processedEventIds.push(event.id);
    switch (event.type) {
      case 'call.initiated':
        this._transitionState(call, 'initiated');
        break;
      case 'call.ringing':
        this._transitionState(call, 'ringing');
        break;
      case 'call.answered':
        call.answeredAt = event.timestamp;
        this._transitionState(call, 'answered');
        this._startMaxDurationTimer(call.callId);
        this._maybeSpeakInitialMessageOnAnswered(call);
        break;
      case 'call.active':
        this._transitionState(call, 'active');
        break;
      case 'call.speaking':
        this._transitionState(call, 'speaking');
        break;
      case 'call.speech':
        if (event.isFinal) {
          this._addTranscriptEntry(call, 'user', event.transcript);
          this._resolveTranscriptWaiter(call.callId, event.transcript);
        }
        this._transitionState(call, 'listening');
        break;
      case 'call.ended':
        call.endedAt = event.timestamp;
        call.endReason = event.reason;
        this._transitionState(call, event.reason);
        this._clearMaxDurationTimer(call.callId);
        this._rejectTranscriptWaiter(call.callId, `Call ended: ${event.reason}`);
        this._activeCalls.delete(call.callId);
        if (call.providerCallId) {
          this._providerCallIdMap.delete(call.providerCallId);
        }
        break;
      case 'call.error':
        if (!event.retryable) {
          call.endedAt = event.timestamp;
          call.endReason = 'error';
          this._transitionState(call, 'error');
          this._clearMaxDurationTimer(call.callId);
          this._rejectTranscriptWaiter(call.callId, `Call error: ${event.error}`);
          this._activeCalls.delete(call.callId);
          if (call.providerCallId) {
            this._providerCallIdMap.delete(call.providerCallId);
          }
        }
        break;
    }
    this._persistCallRecord(call);
  }
  async rejectInboundCall(event) {
    if (!this._provider || !event.providerCallId) {
      return;
    }
    const callId = event.callId || event.providerCallId;
    try {
      await this._provider.hangupCall({
        callId,
        providerCallId: event.providerCallId,
        reason: 'hangup-bot'
      });
    } catch (err) {
      console.warn(
        `[voice-call] Failed to reject inbound call ${event.providerCallId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  _maybeSpeakInitialMessageOnAnswered(call) {
    const initialMessage = typeof call.metadata?.initialMessage === 'string' ? call.metadata.initialMessage.trim() : '';
    if (!initialMessage) {
      return;
    }
    if (!this._provider || !call.providerCallId) {
      return;
    }
    if (this._provider.name === 'twilio') {
      return;
    }
    void this.speakInitialMessage(call.providerCallId);
  }
  /**
   * Get an active call by ID.
   */
  getCall(callId) {
    return this._activeCalls.get(callId);
  }
  /**
   * Get an active call by provider call ID (e.g., Twilio CallSid).
   */
  getCallByProviderCallId(providerCallId) {
    const callId = this._providerCallIdMap.get(providerCallId);
    if (callId) {
      return this._activeCalls.get(callId);
    }
    for (const call of this._activeCalls.values()) {
      if (call.providerCallId === providerCallId) {
        return call;
      }
    }
    return void 0;
  }
  /**
   * Get all active calls.
   */
  getActiveCalls() {
    return Array.from(this._activeCalls.values());
  }
  /**
   * Get call history (from persisted logs).
   */
  async getCallHistory(limit = 50) {
    const logPath = path.join(this._storePath, 'calls.jsonl');
    try {
      await fsp.access(logPath);
    } catch {
      return [];
    }
    const content = await fsp.readFile(logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const calls = [];
    for (const line of lines.slice(-limit)) {
      try {
        const parsed = CallRecordSchema.parse(JSON.parse(line));
        calls.push(parsed);
      } catch { /* intentionally empty */ }
    }
    return calls;
  }
  // States that can cycle during multi-turn conversations
  static ConversationStates = /* @__PURE__ */ new Set(['speaking', 'listening']);
  // Non-terminal state order for monotonic transitions
  static StateOrder = [
    'initiated',
    'ringing',
    'answered',
    'active',
    'speaking',
    'listening'
  ];
  /**
   * Transition call state with monotonic enforcement.
   */
  _transitionState(call, newState) {
    if (call.state === newState || TerminalStates.has(call.state)) {
      return;
    }
    if (TerminalStates.has(newState)) {
      call.state = newState;
      return;
    }
    if (CallManager.ConversationStates.has(call.state) && CallManager.ConversationStates.has(newState)) {
      call.state = newState;
      return;
    }
    const currentIndex = CallManager.StateOrder.indexOf(call.state);
    const newIndex = CallManager.StateOrder.indexOf(newState);
    if (newIndex > currentIndex) {
      call.state = newState;
    }
  }
  /**
   * Add an entry to the call transcript.
   */
  _addTranscriptEntry(call, speaker, text) {
    const entry = {
      timestamp: Date.now(),
      speaker,
      text,
      isFinal: true
    };
    call.transcript.push(entry);
  }
  /**
   * Persist a call record to disk (fire-and-forget async).
   */
  _persistCallRecord(call) {
    const logPath = path.join(this._storePath, 'calls.jsonl');
    const line = `${JSON.stringify(call)}
`;
    fsp.appendFile(logPath, line).catch((err) => {
      console.error('[voice-call] Failed to persist call record:', err);
    });
  }
  /**
   * Load active calls from persistence (for crash recovery).
   * Uses streaming to handle large log files efficiently.
   */
  _loadActiveCalls() {
    const logPath = path.join(this._storePath, 'calls.jsonl');
    if (!fs.existsSync(logPath)) {
      return;
    }
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n');
    const callMap = /* @__PURE__ */ new Map();
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      try {
        const call = CallRecordSchema.parse(JSON.parse(line));
        callMap.set(call.callId, call);
      } catch { /* intentionally empty */ }
    }
    for (const [callId, call] of callMap) {
      if (!TerminalStates.has(call.state)) {
        this._activeCalls.set(callId, call);
        if (call.providerCallId) {
          this._providerCallIdMap.set(call.providerCallId, callId);
        }
        for (const eventId of call.processedEventIds) {
          this._processedEventIds.add(eventId);
        }
      }
    }
  }
  /**
   * Generate TwiML for notify mode (speak message and hang up).
   */
  _generateNotifyTwiml(message, voice) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${escapeXml(message)}</Say>
  <Hangup/>
</Response>`;
  }
}
export {
  CallManager
};
