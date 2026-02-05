import WebSocket from 'ws';
class OpenAIRealtimeSTTProvider {
  name = 'openai-realtime';
  apiKey;
  model;
  silenceDurationMs;
  vadThreshold;
  constructor(config) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key required for Realtime STT');
    }
    this._apiKey = config.apiKey;
    this._model = config.model || 'gpt-4o-transcribe';
    this._silenceDurationMs = config.silenceDurationMs || 800;
    this._vadThreshold = config.vadThreshold || 0.5;
  }
  /**
   * Create a new realtime transcription session.
   */
  createSession() {
    return new OpenAIRealtimeSTTSession(
      this._apiKey,
      this._model,
      this._silenceDurationMs,
      this._vadThreshold
    );
  }
}
class OpenAIRealtimeSTTSession {
  constructor(apiKey, model, silenceDurationMs, vadThreshold) {
    this._apiKey = apiKey;
    this._model = model;
    this._silenceDurationMs = silenceDurationMs;
    this._vadThreshold = vadThreshold;
  }
  static MAX_RECONNECT_ATTEMPTS = 5;
  static RECONNECT_DELAY_MS = 1e3;
  ws = null;
  connected = false;
  closed = false;
  reconnectAttempts = 0;
  pendingTranscript = '';
  onTranscriptCallback = null;
  onPartialCallback = null;
  onSpeechStartCallback = null;
  async connect() {
    this._closed = false;
    this._reconnectAttempts = 0;
    return this.doConnect();
  }
  async doConnect() {
    return new Promise((resolve, reject) => {
      const url = 'wss://api.openai.com/v1/realtime?intent=transcription';
      this._ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this._apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });
      this._ws.on('open', () => {
        console.log('[RealtimeSTT] WebSocket connected');
        this._connected = true;
        this._reconnectAttempts = 0;
        this._sendEvent({
          type: 'transcription_session.update',
          session: {
            input_audio_format: 'g711_ulaw',
            input_audio_transcription: {
              model: this._model
            },
            turn_detection: {
              type: 'server_vad',
              threshold: this._vadThreshold,
              prefix_padding_ms: 300,
              silence_duration_ms: this._silenceDurationMs
            }
          }
        });
        resolve();
      });
      this._ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          this._handleEvent(event);
        } catch (e) {
          console.error('[RealtimeSTT] Failed to parse event:', e);
        }
      });
      this._ws.on('error', (error) => {
        console.error('[RealtimeSTT] WebSocket error:', error);
        if (!this._connected) {
          reject(error);
        }
      });
      this._ws.on('close', (code, reason) => {
        console.log(
          `[RealtimeSTT] WebSocket closed (code: ${code}, reason: ${reason?.toString() || 'none'})`
        );
        this._connected = false;
        if (!this._closed) {
          void this.attemptReconnect();
        }
      });
      setTimeout(() => {
        if (!this._connected) {
          reject(new Error('Realtime STT connection timeout'));
        }
      }, 1e4);
    });
  }
  async attemptReconnect() {
    if (this._closed) {
      return;
    }
    if (this._reconnectAttempts >= OpenAIRealtimeSTTSession.MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `[RealtimeSTT] Max reconnect attempts (${OpenAIRealtimeSTTSession.MAX_RECONNECT_ATTEMPTS}) reached`
      );
      return;
    }
    this._reconnectAttempts++;
    const delay = OpenAIRealtimeSTTSession.RECONNECT_DELAY_MS * 2 ** (this._reconnectAttempts - 1);
    console.log(
      `[RealtimeSTT] Reconnecting ${this._reconnectAttempts}/${OpenAIRealtimeSTTSession.MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (this._closed) {
      return;
    }
    try {
      await this.doConnect();
      console.log('[RealtimeSTT] Reconnected successfully');
    } catch (error) {
      console.error('[RealtimeSTT] Reconnect failed:', error);
    }
  }
  handleEvent(event) {
    switch (event.type) {
      case 'transcription_session.created':
      case 'transcription_session.updated':
      case 'input_audio_buffer.speech_stopped':
      case 'input_audio_buffer.committed':
        console.log(`[RealtimeSTT] ${event.type}`);
        break;
      case 'conversation.item.input_audio_transcription.delta':
        if (event.delta) {
          this._pendingTranscript += event.delta;
          this._onPartialCallback?.(this._pendingTranscript);
        }
        break;
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          console.log(`[RealtimeSTT] Transcript: ${event.transcript}`);
          this._onTranscriptCallback?.(event.transcript);
        }
        this._pendingTranscript = '';
        break;
      case 'input_audio_buffer.speech_started':
        console.log('[RealtimeSTT] Speech started');
        this._pendingTranscript = '';
        this._onSpeechStartCallback?.();
        break;
      case 'error':
        console.error('[RealtimeSTT] Error:', event.error);
        break;
    }
  }
  sendEvent(event) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(event));
    }
  }
  sendAudio(muLawData) {
    if (!this._connected) {
      return;
    }
    this._sendEvent({
      type: 'input_audio_buffer.append',
      audio: muLawData.toString('base64')
    });
  }
  onPartial(callback) {
    this._onPartialCallback = callback;
  }
  onTranscript(callback) {
    this._onTranscriptCallback = callback;
  }
  onSpeechStart(callback) {
    this._onSpeechStartCallback = callback;
  }
  async waitForTranscript(timeoutMs = 3e4) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._onTranscriptCallback = null;
        reject(new Error('Transcript timeout'));
      }, timeoutMs);
      this._onTranscriptCallback = (transcript) => {
        clearTimeout(timeout);
        this._onTranscriptCallback = null;
        resolve(transcript);
      };
    });
  }
  close() {
    this._closed = true;
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._connected = false;
  }
  isConnected() {
    return this._connected;
  }
}
export {
  OpenAIRealtimeSTTProvider
};
