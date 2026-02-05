import { WebSocket, WebSocketServer } from 'ws';
class MediaStreamHandler {
  wss = null;
  sessions = /* @__PURE__ */ new Map();
  config;
  /** TTS playback queues per stream (serialize audio to prevent overlap) */
  ttsQueues = /* @__PURE__ */ new Map();
  /** Whether TTS is currently playing per stream */
  ttsPlaying = /* @__PURE__ */ new Map();
  /** Active TTS playback controllers per stream */
  ttsActiveControllers = /* @__PURE__ */ new Map();
  constructor(config) {
    this._config = config;
  }
  /**
   * Handle WebSocket upgrade for media stream connections.
   */
  handleUpgrade(request, socket, head) {
    if (!this._wss) {
      this._wss = new WebSocketServer({ noServer: true });
      this._wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    }
    this._wss.handleUpgrade(request, socket, head, (ws) => {
      this._wss?.emit('connection', ws, request);
    });
  }
  /**
   * Handle new WebSocket connection from Twilio.
   */
  async handleConnection(ws, _request) {
    let session = null;
    const streamToken = this._getStreamToken(_request);
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        switch (message.event) {
          case 'connected':
            console.log('[MediaStream] Twilio connected');
            break;
          case 'start':
            session = await this.handleStart(ws, message, streamToken);
            break;
          case 'media':
            if (session && message.media?.payload) {
              const audioBuffer = Buffer.from(message.media.payload, 'base64');
              session.sttSession.sendAudio(audioBuffer);
            }
            break;
          case 'stop':
            if (session) {
              this._handleStop(session);
              session = null;
            }
            break;
        }
      } catch (error) {
        console.error('[MediaStream] Error processing message:', error);
      }
    });
    ws.on('close', () => {
      if (session) {
        this._handleStop(session);
      }
    });
    ws.on('error', (error) => {
      console.error('[MediaStream] WebSocket error:', error);
    });
  }
  /**
   * Handle stream start event.
   */
  async handleStart(ws, message, streamToken) {
    const streamSid = message.streamSid || '';
    const callSid = message.start?.callSid || '';
    console.log(`[MediaStream] Stream started: ${streamSid} (call: ${callSid})`);
    if (!callSid) {
      console.warn('[MediaStream] Missing callSid; closing stream');
      ws.close(1008, 'Missing callSid');
      return null;
    }
    if (this._config.shouldAcceptStream && !this._config.shouldAcceptStream({ callId: callSid, streamSid, token: streamToken })) {
      console.warn(`[MediaStream] Rejecting stream for unknown call: ${callSid}`);
      ws.close(1008, 'Unknown call');
      return null;
    }
    const sttSession = this._config.sttProvider.createSession();
    sttSession.onPartial((partial) => {
      this._config.onPartialTranscript?.(callSid, partial);
    });
    sttSession.onTranscript((transcript) => {
      this._config.onTranscript?.(callSid, transcript);
    });
    sttSession.onSpeechStart(() => {
      this._config.onSpeechStart?.(callSid);
    });
    const session = {
      callId: callSid,
      streamSid,
      ws,
      sttSession
    };
    this._sessions.set(streamSid, session);
    this._config.onConnect?.(callSid, streamSid);
    sttSession.connect().catch((err) => {
      console.warn('[MediaStream] STT connection failed (TTS still works):', err.message);
    });
    return session;
  }
  /**
   * Handle stream stop event.
   */
  handleStop(session) {
    console.log(`[MediaStream] Stream stopped: ${session.streamSid}`);
    this._clearTtsState(session.streamSid);
    session.sttSession.close();
    this._sessions.delete(session.streamSid);
    this._config.onDisconnect?.(session.callId);
  }
  getStreamToken(request) {
    if (!request.url || !request.headers.host) {
      return void 0;
    }
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      return url.searchParams.get('token') ?? void 0;
    } catch {
      return void 0;
    }
  }
  /**
   * Get an active session with an open WebSocket, or undefined if unavailable.
   */
  getOpenSession(streamSid) {
    const session = this._sessions.get(streamSid);
    return session?.ws.readyState === WebSocket.OPEN ? session : void 0;
  }
  /**
   * Send a message to a stream's WebSocket if available.
   */
  sendToStream(streamSid, message) {
    const session = this._getOpenSession(streamSid);
    session?.ws.send(JSON.stringify(message));
  }
  /**
   * Send audio to a specific stream (for TTS playback).
   * Audio should be mu-law encoded at 8kHz mono.
   */
  sendAudio(streamSid, muLawAudio) {
    this._sendToStream(streamSid, {
      event: 'media',
      streamSid,
      media: { payload: muLawAudio.toString('base64') }
    });
  }
  /**
   * Send a mark event to track audio playback position.
   */
  sendMark(streamSid, name) {
    this._sendToStream(streamSid, {
      event: 'mark',
      streamSid,
      mark: { name }
    });
  }
  /**
   * Clear audio buffer (interrupt playback).
   */
  clearAudio(streamSid) {
    this._sendToStream(streamSid, { event: 'clear', streamSid });
  }
  /**
   * Queue a TTS operation for sequential playback.
   * Only one TTS operation plays at a time per stream to prevent overlap.
   */
  async queueTts(streamSid, playFn) {
    const queue = this._getTtsQueue(streamSid);
    let resolveEntry;
    let rejectEntry;
    const promise = new Promise((resolve, reject) => {
      resolveEntry = resolve;
      rejectEntry = reject;
    });
    queue.push({
      playFn,
      controller: new AbortController(),
      resolve: resolveEntry,
      reject: rejectEntry
    });
    if (!this._ttsPlaying.get(streamSid)) {
      void this.processQueue(streamSid);
    }
    return promise;
  }
  /**
   * Clear TTS queue and interrupt current playback (barge-in).
   */
  clearTtsQueue(streamSid) {
    const queue = this._getTtsQueue(streamSid);
    queue.length = 0;
    this._ttsActiveControllers.get(streamSid)?.abort();
    this.clearAudio(streamSid);
  }
  /**
   * Get active session by call ID.
   */
  getSessionByCallId(callId) {
    return [...this._sessions.values()].find((session) => session.callId === callId);
  }
  /**
   * Close all sessions.
   */
  closeAll() {
    for (const session of this._sessions.values()) {
      this._clearTtsState(session.streamSid);
      session.sttSession.close();
      session.ws.close();
    }
    this._sessions.clear();
  }
  getTtsQueue(streamSid) {
    const existing = this._ttsQueues.get(streamSid);
    if (existing) {
      return existing;
    }
    const queue = [];
    this._ttsQueues.set(streamSid, queue);
    return queue;
  }
  /**
   * Process the TTS queue for a stream.
   * Uses iterative approach to avoid stack accumulation from recursion.
   */
  async processQueue(streamSid) {
    this._ttsPlaying.set(streamSid, true);
    while (true) {
      const queue = this._ttsQueues.get(streamSid);
      if (!queue || queue.length === 0) {
        this._ttsPlaying.set(streamSid, false);
        this._ttsActiveControllers.delete(streamSid);
        return;
      }
      const entry = queue.shift();
      this._ttsActiveControllers.set(streamSid, entry.controller);
      try {
        await entry.playFn(entry.controller.signal);
        entry.resolve();
      } catch (error) {
        if (entry.controller.signal.aborted) {
          entry.resolve();
        } else {
          console.error('[MediaStream] TTS playback error:', error);
          entry.reject(error);
        }
      } finally {
        if (this._ttsActiveControllers.get(streamSid) === entry.controller) {
          this._ttsActiveControllers.delete(streamSid);
        }
      }
    }
  }
  clearTtsState(streamSid) {
    const queue = this._ttsQueues.get(streamSid);
    if (queue) {
      queue.length = 0;
    }
    this._ttsActiveControllers.get(streamSid)?.abort();
    this._ttsActiveControllers.delete(streamSid);
    this._ttsPlaying.delete(streamSid);
    this._ttsQueues.delete(streamSid);
  }
}
export {
  MediaStreamHandler
};
