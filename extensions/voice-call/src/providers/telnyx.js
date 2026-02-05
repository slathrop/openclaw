import crypto from 'node:crypto';
class TelnyxProvider {
  name = 'telnyx';
  apiKey;
  connectionId;
  publicKey;
  options;
  baseUrl = 'https://api.telnyx.com/v2';
  constructor(config, options = {}) {
    if (!config.apiKey) {
      throw new Error('Telnyx API key is required');
    }
    if (!config.connectionId) {
      throw new Error('Telnyx connection ID is required');
    }
    this._apiKey = config.apiKey;
    this._connectionId = config.connectionId;
    this._publicKey = config.publicKey;
    this._options = options;
  }
  /**
   * Make an authenticated request to the Telnyx API.
   */
  async apiRequest(endpoint, body, options) {
    const response = await fetch(`${this._baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this._apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      if (options?.allowNotFound && response.status === 404) {
        return void 0;
      }
      const errorText = await response.text();
      throw new Error(`Telnyx API error: ${response.status} ${errorText}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : void 0;
  }
  /**
   * Verify Telnyx webhook signature using Ed25519.
   */
  verifyWebhook(ctx) {
    if (!this._publicKey) {
      if (this._options.allowUnsignedWebhooks) {
        console.warn('[telnyx] Webhook verification skipped (no public key configured)');
        return { ok: true, reason: 'verification skipped (no public key configured)' };
      }
      return {
        ok: false,
        reason: 'Missing telnyx.publicKey (configure to verify webhooks)'
      };
    }
    const signature = ctx.headers['telnyx-signature-ed25519'];
    const timestamp = ctx.headers['telnyx-timestamp'];
    if (!signature || !timestamp) {
      return { ok: false, reason: 'Missing signature or timestamp header' };
    }
    const signatureStr = Array.isArray(signature) ? signature[0] : signature;
    const timestampStr = Array.isArray(timestamp) ? timestamp[0] : timestamp;
    if (!signatureStr || !timestampStr) {
      return { ok: false, reason: 'Empty signature or timestamp' };
    }
    try {
      const signedPayload = `${timestampStr}|${ctx.rawBody}`;
      const signatureBuffer = Buffer.from(signatureStr, 'base64');
      const publicKeyBuffer = Buffer.from(this._publicKey, 'base64');
      const isValid = crypto.verify(
        null,
        // Ed25519 doesn't use a digest
        Buffer.from(signedPayload),
        {
          key: publicKeyBuffer,
          format: 'der',
          type: 'spki'
        },
        signatureBuffer
      );
      if (!isValid) {
        return { ok: false, reason: 'Invalid signature' };
      }
      const eventTime = parseInt(timestampStr, 10) * 1e3;
      const now = Date.now();
      if (Math.abs(now - eventTime) > 5 * 60 * 1e3) {
        return { ok: false, reason: 'Timestamp too old' };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: `Verification error: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
  /**
   * Parse Telnyx webhook event into normalized format.
   */
  parseWebhookEvent(ctx) {
    try {
      const payload = JSON.parse(ctx.rawBody);
      const data = payload.data;
      if (!data || !data.event_type) {
        return { events: [], statusCode: 200 };
      }
      const event = this._normalizeEvent(data);
      return {
        events: event ? [event] : [],
        statusCode: 200
      };
    } catch {
      return { events: [], statusCode: 400 };
    }
  }
  /**
   * Convert Telnyx event to normalized event format.
   */
  normalizeEvent(data) {
    let callId = '';
    if (data.payload?.client_state) {
      try {
        callId = Buffer.from(data.payload.client_state, 'base64').toString('utf8');
      } catch {
        callId = data.payload.client_state;
      }
    }
    if (!callId) {
      callId = data.payload?.call_control_id || '';
    }
    const baseEvent = {
      id: data.id || crypto.randomUUID(),
      callId,
      providerCallId: data.payload?.call_control_id,
      timestamp: Date.now()
    };
    switch (data.event_type) {
      case 'call.initiated':
        return { ...baseEvent, type: 'call.initiated' };
      case 'call.ringing':
        return { ...baseEvent, type: 'call.ringing' };
      case 'call.answered':
        return { ...baseEvent, type: 'call.answered' };
      case 'call.bridged':
        return { ...baseEvent, type: 'call.active' };
      case 'call.speak.started':
        return {
          ...baseEvent,
          type: 'call.speaking',
          text: data.payload?.text || ''
        };
      case 'call.transcription':
        return {
          ...baseEvent,
          type: 'call.speech',
          transcript: data.payload?.transcription || '',
          isFinal: data.payload?.is_final ?? true,
          confidence: data.payload?.confidence
        };
      case 'call.hangup':
        return {
          ...baseEvent,
          type: 'call.ended',
          reason: this._mapHangupCause(data.payload?.hangup_cause)
        };
      case 'call.dtmf.received':
        return {
          ...baseEvent,
          type: 'call.dtmf',
          digits: data.payload?.digit || ''
        };
      default:
        return null;
    }
  }
  /**
   * Map Telnyx hangup cause to normalized end reason.
   * @see https://developers.telnyx.com/docs/api/v2/call-control/Call-Commands#hangup-causes
   */
  mapHangupCause(cause) {
    switch (cause) {
      case 'normal_clearing':
      case 'normal_unspecified':
        return 'completed';
      case 'originator_cancel':
        return 'hangup-bot';
      case 'call_rejected':
      case 'user_busy':
        return 'busy';
      case 'no_answer':
      case 'no_user_response':
        return 'no-answer';
      case 'destination_out_of_order':
      case 'network_out_of_order':
      case 'service_unavailable':
      case 'recovery_on_timer_expire':
        return 'failed';
      case 'machine_detected':
      case 'fax_detected':
        return 'voicemail';
      case 'user_hangup':
      case 'subscriber_absent':
        return 'hangup-user';
      default:
        if (cause) {
          console.warn(`[telnyx] Unknown hangup cause: ${cause}`);
        }
        return 'completed';
    }
  }
  /**
   * Initiate an outbound call via Telnyx API.
   */
  async initiateCall(input) {
    const result = await this.apiRequest('/calls', {
      connection_id: this._connectionId,
      to: input.to,
      from: input.from,
      webhook_url: input.webhookUrl,
      webhook_url_method: 'POST',
      client_state: Buffer.from(input.callId).toString('base64'),
      timeout_secs: 30
    });
    return {
      providerCallId: result.data.call_control_id,
      status: 'initiated'
    };
  }
  /**
   * Hang up a call via Telnyx API.
   */
  async hangupCall(input) {
    await this.apiRequest(
      `/calls/${input.providerCallId}/actions/hangup`,
      { command_id: crypto.randomUUID() },
      { allowNotFound: true }
    );
  }
  /**
   * Play TTS audio via Telnyx speak action.
   */
  async playTts(input) {
    await this.apiRequest(`/calls/${input.providerCallId}/actions/speak`, {
      command_id: crypto.randomUUID(),
      payload: input.text,
      voice: input.voice || 'female',
      language: input.locale || 'en-US'
    });
  }
  /**
   * Start transcription (STT) via Telnyx.
   */
  async startListening(input) {
    await this.apiRequest(`/calls/${input.providerCallId}/actions/transcription_start`, {
      command_id: crypto.randomUUID(),
      language: input.language || 'en'
    });
  }
  /**
   * Stop transcription via Telnyx.
   */
  async stopListening(input) {
    await this.apiRequest(
      `/calls/${input.providerCallId}/actions/transcription_stop`,
      { command_id: crypto.randomUUID() },
      { allowNotFound: true }
    );
  }
}
export {
  TelnyxProvider
};
