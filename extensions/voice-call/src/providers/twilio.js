import crypto from 'node:crypto';
import { chunkAudio } from '../telephony-audio.js';
import { escapeXml, mapVoiceToPolly } from '../voice-mapping.js';
import { twilioApiRequest } from './twilio/api.js';
import { verifyTwilioProviderWebhook } from './twilio/webhook.js';
class TwilioProvider {
  name = 'twilio';
  accountSid;
  authToken;
  baseUrl;
  callWebhookUrls = /* @__PURE__ */ new Map();
  options;
  /** Current public webhook URL (set when tunnel starts or from config) */
  currentPublicUrl = null;
  /** Optional telephony TTS provider for streaming TTS */
  ttsProvider = null;
  /** Optional media stream handler for sending audio */
  mediaStreamHandler = null;
  /** Map of call SID to stream SID for media streams */
  callStreamMap = /* @__PURE__ */ new Map();
  /** Per-call tokens for media stream authentication */
  streamAuthTokens = /* @__PURE__ */ new Map();
  /** Storage for TwiML content (for notify mode with URL-based TwiML) */
  twimlStorage = /* @__PURE__ */ new Map();
  /** Track notify-mode calls to avoid streaming on follow-up callbacks */
  notifyCalls = /* @__PURE__ */ new Set();
  /**
   * Delete stored TwiML for a given `callId`.
   *
   * We keep TwiML in-memory only long enough to satisfy the initial Twilio
   * webhook request (notify mode). Subsequent webhooks should not reuse it.
   */
  deleteStoredTwiml(callId) {
    this._twimlStorage.delete(callId);
    this._notifyCalls.delete(callId);
  }
  /**
   * Delete stored TwiML for a call, addressed by Twilio's provider call SID.
   *
   * This is used when we only have `providerCallId` (e.g. hangup).
   */
  deleteStoredTwimlForProviderCall(providerCallId) {
    const webhookUrl = this._callWebhookUrls.get(providerCallId);
    if (!webhookUrl) {
      return;
    }
    const callIdMatch = webhookUrl.match(/callId=([^&]+)/);
    if (!callIdMatch) {
      return;
    }
    this._deleteStoredTwiml(callIdMatch[1]);
    this._streamAuthTokens.delete(providerCallId);
  }
  constructor(config, options = {}) {
    if (!config.accountSid) {
      throw new Error('Twilio Account SID is required');
    }
    if (!config.authToken) {
      throw new Error('Twilio Auth Token is required');
    }
    this._accountSid = config.accountSid;
    this._authToken = config.authToken;
    this._baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this._accountSid}`;
    this._options = options;
    if (options.publicUrl) {
      this._currentPublicUrl = options.publicUrl;
    }
  }
  setPublicUrl(url) {
    this._currentPublicUrl = url;
  }
  getPublicUrl() {
    return this._currentPublicUrl;
  }
  setTTSProvider(provider) {
    this._ttsProvider = provider;
  }
  setMediaStreamHandler(handler) {
    this._mediaStreamHandler = handler;
  }
  registerCallStream(callSid, streamSid) {
    this._callStreamMap.set(callSid, streamSid);
  }
  unregisterCallStream(callSid) {
    this._callStreamMap.delete(callSid);
  }
  isValidStreamToken(callSid, token) {
    const expected = this._streamAuthTokens.get(callSid);
    if (!expected || !token) {
      return false;
    }
    if (expected.length !== token.length) {
      const dummy = Buffer.from(expected);
      crypto.timingSafeEqual(dummy, dummy);
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  }
  /**
   * Clear TTS queue for a call (barge-in).
   * Used when user starts speaking to interrupt current TTS playback.
   */
  clearTtsQueue(callSid) {
    const streamSid = this._callStreamMap.get(callSid);
    if (streamSid && this._mediaStreamHandler) {
      this._mediaStreamHandler.clearTtsQueue(streamSid);
    }
  }
  /**
   * Make an authenticated request to the Twilio API.
   */
  async apiRequest(endpoint, params, options) {
    return await twilioApiRequest({
      baseUrl: this._baseUrl,
      accountSid: this._accountSid,
      authToken: this._authToken,
      endpoint,
      body: params,
      allowNotFound: options?.allowNotFound
    });
  }
  /**
   * Verify Twilio webhook signature using HMAC-SHA1.
   *
   * Handles reverse proxy scenarios (Tailscale, nginx, ngrok) by reconstructing
   * the public URL from forwarding headers.
   *
   * @see https://www.twilio.com/docs/usage/webhooks/webhooks-security
   */
  verifyWebhook(ctx) {
    return verifyTwilioProviderWebhook({
      ctx,
      authToken: this._authToken,
      currentPublicUrl: this._currentPublicUrl,
      options: this._options
    });
  }
  /**
   * Parse Twilio webhook event into normalized format.
   */
  parseWebhookEvent(ctx) {
    try {
      const params = new URLSearchParams(ctx.rawBody);
      const callIdFromQuery = typeof ctx.query?.callId === 'string' && ctx.query.callId.trim() ? ctx.query.callId.trim() : void 0;
      const event = this._normalizeEvent(params, callIdFromQuery);
      const twiml = this._generateTwimlResponse(ctx);
      return {
        events: event ? [event] : [],
        providerResponseBody: twiml,
        providerResponseHeaders: { 'Content-Type': 'application/xml' },
        statusCode: 200
      };
    } catch {
      return { events: [], statusCode: 400 };
    }
  }
  /**
   * Parse Twilio direction to normalized format.
   */
  static parseDirection(direction) {
    if (direction === 'inbound') {
      return 'inbound';
    }
    if (direction === 'outbound-api' || direction === 'outbound-dial') {
      return 'outbound';
    }
    return void 0;
  }
  /**
   * Convert Twilio webhook params to normalized event format.
   */
  normalizeEvent(params, callIdOverride) {
    const callSid = params.get('CallSid') || '';
    const baseEvent = {
      id: crypto.randomUUID(),
      callId: callIdOverride || callSid,
      providerCallId: callSid,
      timestamp: Date.now(),
      direction: TwilioProvider.parseDirection(params.get('Direction')),
      from: params.get('From') || void 0,
      to: params.get('To') || void 0
    };
    const speechResult = params.get('SpeechResult');
    if (speechResult) {
      return {
        ...baseEvent,
        type: 'call.speech',
        transcript: speechResult,
        isFinal: true,
        confidence: parseFloat(params.get('Confidence') || '0.9')
      };
    }
    const digits = params.get('Digits');
    if (digits) {
      return { ...baseEvent, type: 'call.dtmf', digits };
    }
    const callStatus = params.get('CallStatus');
    switch (callStatus) {
      case 'initiated':
        return { ...baseEvent, type: 'call.initiated' };
      case 'ringing':
        return { ...baseEvent, type: 'call.ringing' };
      case 'in-progress':
        return { ...baseEvent, type: 'call.answered' };
      case 'completed':
      case 'busy':
      case 'no-answer':
      case 'failed':
        this._streamAuthTokens.delete(callSid);
        if (callIdOverride) {
          this._deleteStoredTwiml(callIdOverride);
        }
        return { ...baseEvent, type: 'call.ended', reason: callStatus };
      case 'canceled':
        this._streamAuthTokens.delete(callSid);
        if (callIdOverride) {
          this._deleteStoredTwiml(callIdOverride);
        }
        return { ...baseEvent, type: 'call.ended', reason: 'hangup-bot' };
      default:
        return null;
    }
  }
  static EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  static PAUSE_TWIML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="30"/>
</Response>`;
  /**
   * Generate TwiML response for webhook.
   * When a call is answered, connects to media stream for bidirectional audio.
   */
  generateTwimlResponse(ctx) {
    if (!ctx) {
      return TwilioProvider.EMPTY_TWIML;
    }
    const params = new URLSearchParams(ctx.rawBody);
    const type = typeof ctx.query?.type === 'string' ? ctx.query.type.trim() : void 0;
    const isStatusCallback = type === 'status';
    const callStatus = params.get('CallStatus');
    const direction = params.get('Direction');
    const isOutbound = direction?.startsWith('outbound') ?? false;
    const callSid = params.get('CallSid') || void 0;
    const callIdFromQuery = typeof ctx.query?.callId === 'string' && ctx.query.callId.trim() ? ctx.query.callId.trim() : void 0;
    if (callIdFromQuery && !isStatusCallback) {
      const storedTwiml = this._twimlStorage.get(callIdFromQuery);
      if (storedTwiml) {
        this._deleteStoredTwiml(callIdFromQuery);
        return storedTwiml;
      }
      if (this._notifyCalls.has(callIdFromQuery)) {
        return TwilioProvider.EMPTY_TWIML;
      }
      if (isOutbound) {
        const streamUrl2 = callSid ? this._getStreamUrlForCall(callSid) : null;
        return streamUrl2 ? this.getStreamConnectXml(streamUrl2) : TwilioProvider.PAUSE_TWIML;
      }
    }
    if (isStatusCallback) {
      return TwilioProvider.EMPTY_TWIML;
    }
    if (direction === 'inbound') {
      const streamUrl2 = callSid ? this._getStreamUrlForCall(callSid) : null;
      return streamUrl2 ? this.getStreamConnectXml(streamUrl2) : TwilioProvider.PAUSE_TWIML;
    }
    if (callStatus !== 'in-progress') {
      return TwilioProvider.EMPTY_TWIML;
    }
    const streamUrl = callSid ? this._getStreamUrlForCall(callSid) : null;
    return streamUrl ? this.getStreamConnectXml(streamUrl) : TwilioProvider.PAUSE_TWIML;
  }
  /**
   * Get the WebSocket URL for media streaming.
   * Derives from the public URL origin + stream path.
   */
  getStreamUrl() {
    if (!this._currentPublicUrl || !this._options.streamPath) {
      return null;
    }
    const url = new URL(this._currentPublicUrl);
    const origin = url.origin;
    const wsOrigin = origin.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
    const path = this._options.streamPath.startsWith('/') ? this._options.streamPath : `/${this._options.streamPath}`;
    return `${wsOrigin}${path}`;
  }
  getStreamAuthToken(callSid) {
    const existing = this._streamAuthTokens.get(callSid);
    if (existing) {
      return existing;
    }
    const token = crypto.randomBytes(16).toString('base64url');
    this._streamAuthTokens.set(callSid, token);
    return token;
  }
  getStreamUrlForCall(callSid) {
    const baseUrl = this._getStreamUrl();
    if (!baseUrl) {
      return null;
    }
    const token = this._getStreamAuthToken(callSid);
    const url = new URL(baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }
  /**
   * Generate TwiML to connect a call to a WebSocket media stream.
   * This enables bidirectional audio streaming for real-time STT/TTS.
   *
   * @param streamUrl - WebSocket URL (wss://...) for the media stream
   */
  getStreamConnectXml(streamUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(streamUrl)}" />
  </Connect>
</Response>`;
  }
  /**
   * Initiate an outbound call via Twilio API.
   * If inlineTwiml is provided, uses that directly (for notify mode).
   * Otherwise, uses webhook URL for dynamic TwiML.
   */
  async initiateCall(input) {
    const url = new URL(input.webhookUrl);
    url.searchParams.set('callId', input.callId);
    const statusUrl = new URL(input.webhookUrl);
    statusUrl.searchParams.set('callId', input.callId);
    statusUrl.searchParams.set('type', 'status');
    if (input.inlineTwiml) {
      this._twimlStorage.set(input.callId, input.inlineTwiml);
      this._notifyCalls.add(input.callId);
    }
    const params = {
      To: input.to,
      From: input.from,
      Url: url.toString(),
      // TwiML serving endpoint
      StatusCallback: statusUrl.toString(),
      // Separate status callback endpoint
      StatusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      Timeout: '30'
    };
    const result = await this.apiRequest('/Calls.json', params);
    this._callWebhookUrls.set(result.sid, url.toString());
    return {
      providerCallId: result.sid,
      status: result.status === 'queued' ? 'queued' : 'initiated'
    };
  }
  /**
   * Hang up a call via Twilio API.
   */
  async hangupCall(input) {
    this._deleteStoredTwimlForProviderCall(input.providerCallId);
    this._callWebhookUrls.delete(input.providerCallId);
    this._streamAuthTokens.delete(input.providerCallId);
    await this.apiRequest(
      `/Calls/${input.providerCallId}.json`,
      { Status: 'completed' },
      { allowNotFound: true }
    );
  }
  /**
   * Play TTS audio via Twilio.
   *
   * Two modes:
   * 1. Core TTS + Media Streams: If TTS provider and media stream are available,
   *    generates audio via core TTS and streams it through WebSocket (preferred).
   * 2. TwiML <Say>: Falls back to Twilio's native TTS with Polly voices.
   *    Note: This may not work on all Twilio accounts.
   */
  async playTts(input) {
    const streamSid = this._callStreamMap.get(input.providerCallId);
    if (this._ttsProvider && this._mediaStreamHandler && streamSid) {
      try {
        await this.playTtsViaStream(input.text, streamSid);
        return;
      } catch (err) {
        console.warn(
          '[voice-call] Telephony TTS failed, falling back to Twilio <Say>:',
          err instanceof Error ? err.message : err
        );
      }
    }
    const webhookUrl = this._callWebhookUrls.get(input.providerCallId);
    if (!webhookUrl) {
      throw new Error('Missing webhook URL for this call (provider state not initialized)');
    }
    console.warn(
      '[voice-call] Using TwiML <Say> fallback - telephony TTS not configured or media stream not active'
    );
    const pollyVoice = mapVoiceToPolly(input.voice);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${pollyVoice}" language="${input.locale || 'en-US'}">${escapeXml(input.text)}</Say>
  <Gather input="speech" speechTimeout="auto" action="${escapeXml(webhookUrl)}" method="POST">
    <Say>.</Say>
  </Gather>
</Response>`;
    await this.apiRequest(`/Calls/${input.providerCallId}.json`, {
      Twiml: twiml
    });
  }
  /**
   * Play TTS via core TTS and Twilio Media Streams.
   * Generates audio with core TTS, converts to mu-law, and streams via WebSocket.
   * Uses a queue to serialize playback and prevent overlapping audio.
   */
  async playTtsViaStream(text, streamSid) {
    if (!this._ttsProvider || !this._mediaStreamHandler) {
      throw new Error('TTS provider and media stream handler required');
    }
    const CHUNK_SIZE = 160;
    const CHUNK_DELAY_MS = 20;
    const handler = this._mediaStreamHandler;
    const ttsProvider = this._ttsProvider;
    await handler.queueTts(streamSid, async (signal) => {
      const muLawAudio = await ttsProvider.synthesizeForTelephony(text);
      for (const chunk of chunkAudio(muLawAudio, CHUNK_SIZE)) {
        if (signal.aborted) {
          break;
        }
        handler.sendAudio(streamSid, chunk);
        await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
        if (signal.aborted) {
          break;
        }
      }
      if (!signal.aborted) {
        handler.sendMark(streamSid, `tts-${Date.now()}`);
      }
    });
  }
  /**
   * Start listening for speech via Twilio <Gather>.
   */
  async startListening(input) {
    const webhookUrl = this._callWebhookUrls.get(input.providerCallId);
    if (!webhookUrl) {
      throw new Error('Missing webhook URL for this call (provider state not initialized)');
    }
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" speechTimeout="auto" language="${input.language || 'en-US'}" action="${escapeXml(webhookUrl)}" method="POST">
  </Gather>
</Response>`;
    await this.apiRequest(`/Calls/${input.providerCallId}.json`, {
      Twiml: twiml
    });
  }
  /**
   * Stop listening - for Twilio this is a no-op as <Gather> auto-ends.
   */
  async stopListening(_input) {
  }
}
export {
  TwilioProvider
};
