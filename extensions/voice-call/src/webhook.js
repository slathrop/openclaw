import { spawn } from 'node:child_process';
import http from 'node:http';
import { URL } from 'node:url';
import { MediaStreamHandler } from './media-stream.js';
import { OpenAIRealtimeSTTProvider } from './providers/stt-openai-realtime.js';
const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;
class VoiceCallWebhookServer {
  server = null;
  config;
  manager;
  provider;
  coreConfig;
  /** Media stream handler for bidirectional audio (when streaming enabled) */
  mediaStreamHandler = null;
  constructor(config, manager, provider, coreConfig) {
    this._config = config;
    this._manager = manager;
    this._provider = provider;
    this._coreConfig = coreConfig ?? null;
    if (config.streaming?.enabled) {
      this._initializeMediaStreaming();
    }
  }
  /**
   * Get the media stream handler (for wiring to provider).
   */
  getMediaStreamHandler() {
    return this._mediaStreamHandler;
  }
  /**
   * Initialize media streaming with OpenAI Realtime STT.
   */
  initializeMediaStreaming() {
    const apiKey = this._config.streaming?.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[voice-call] Streaming enabled but no OpenAI API key found');
      return;
    }
    const sttProvider = new OpenAIRealtimeSTTProvider({
      apiKey,
      model: this._config.streaming?.sttModel,
      silenceDurationMs: this._config.streaming?.silenceDurationMs,
      vadThreshold: this._config.streaming?.vadThreshold
    });
    const streamConfig = {
      sttProvider,
      shouldAcceptStream: ({ callId, token }) => {
        const call = this._manager.getCallByProviderCallId(callId);
        if (!call) {
          return false;
        }
        if (this._provider.name === 'twilio') {
          const twilio = this._provider;
          if (!twilio.isValidStreamToken(callId, token)) {
            console.warn(`[voice-call] Rejecting media stream: invalid token for ${callId}`);
            return false;
          }
        }
        return true;
      },
      onTranscript: (providerCallId, transcript) => {
        console.log(`[voice-call] Transcript for ${providerCallId}: ${transcript}`);
        if (this._provider.name === 'twilio') {
          this._provider.clearTtsQueue(providerCallId);
        }
        const call = this._manager.getCallByProviderCallId(providerCallId);
        if (!call) {
          console.warn(`[voice-call] No active call found for provider ID: ${providerCallId}`);
          return;
        }
        const event = {
          id: `stream-transcript-${Date.now()}`,
          type: 'call.speech',
          callId: call.callId,
          providerCallId,
          timestamp: Date.now(),
          transcript,
          isFinal: true
        };
        this._manager.processEvent(event);
        const callMode = call.metadata?.mode;
        const shouldRespond = call.direction === 'inbound' || callMode === 'conversation';
        if (shouldRespond) {
          this.handleInboundResponse(call.callId, transcript).catch((err) => {
            console.warn('[voice-call] Failed to auto-respond:', err);
          });
        }
      },
      onSpeechStart: (providerCallId) => {
        if (this._provider.name === 'twilio') {
          this._provider.clearTtsQueue(providerCallId);
        }
      },
      onPartialTranscript: (callId, partial) => {
        console.log(`[voice-call] Partial for ${callId}: ${partial}`);
      },
      onConnect: (callId, streamSid) => {
        console.log(`[voice-call] Media stream connected: ${callId} -> ${streamSid}`);
        if (this._provider.name === 'twilio') {
          this._provider.registerCallStream(callId, streamSid);
        }
        setTimeout(() => {
          this._manager.speakInitialMessage(callId).catch((err) => {
            console.warn('[voice-call] Failed to speak initial message:', err);
          });
        }, 500);
      },
      onDisconnect: (callId) => {
        console.log(`[voice-call] Media stream disconnected: ${callId}`);
        if (this._provider.name === 'twilio') {
          this._provider.unregisterCallStream(callId);
        }
      }
    };
    this._mediaStreamHandler = new MediaStreamHandler(streamConfig);
    console.log('[voice-call] Media streaming initialized');
  }
  /**
   * Start the webhook server.
   */
  async start() {
    const { port, bind, path: webhookPath } = this._config.serve;
    const streamPath = this._config.streaming?.streamPath || '/voice/stream';
    return new Promise((resolve, reject) => {
      this._server = http.createServer((req, res) => {
        this.handleRequest(req, res, webhookPath).catch((err) => {
          console.error('[voice-call] Webhook error:', err);
          res.statusCode = 500;
          res.end('Internal Server Error');
        });
      });
      if (this._mediaStreamHandler) {
        this._server.on('upgrade', (request, socket, head) => {
          const url = new URL(request.url || '/', `http://${request.headers.host}`);
          if (url.pathname === streamPath) {
            console.log('[voice-call] WebSocket upgrade for media stream');
            this._mediaStreamHandler?.handleUpgrade(request, socket, head);
          } else {
            socket.destroy();
          }
        });
      }
      this._server.on('error', reject);
      this._server.listen(port, bind, () => {
        const url = `http://${bind}:${port}${webhookPath}`;
        console.log(`[voice-call] Webhook server listening on ${url}`);
        if (this._mediaStreamHandler) {
          console.log(`[voice-call] Media stream WebSocket on ws://${bind}:${port}${streamPath}`);
        }
        resolve(url);
      });
    });
  }
  /**
   * Stop the webhook server.
   */
  async stop() {
    return new Promise((resolve) => {
      if (this._server) {
        this._server.close(() => {
          this._server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
  /**
   * Handle incoming HTTP request.
   */
  async handleRequest(req, res, webhookPath) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    if (!url.pathname.startsWith(webhookPath)) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end('Method Not Allowed');
      return;
    }
    let body = '';
    try {
      body = await this._readBody(req, MAX_WEBHOOK_BODY_BYTES);
    } catch (err) {
      if (err instanceof Error && err.message === 'PayloadTooLarge') {
        res.statusCode = 413;
        res.end('Payload Too Large');
        return;
      }
      throw err;
    }
    const ctx = {
      headers: req.headers,
      rawBody: body,
      url: `http://${req.headers.host}${req.url}`,
      method: 'POST',
      query: Object.fromEntries(url.searchParams),
      remoteAddress: req.socket.remoteAddress ?? void 0
    };
    const verification = this._provider.verifyWebhook(ctx);
    if (!verification.ok) {
      console.warn(`[voice-call] Webhook verification failed: ${verification.reason}`);
      res.statusCode = 401;
      res.end('Unauthorized');
      return;
    }
    const result = this._provider.parseWebhookEvent(ctx);
    for (const event of result.events) {
      try {
        this._manager.processEvent(event);
      } catch (err) {
        console.error(`[voice-call] Error processing event ${event.type}:`, err);
      }
    }
    res.statusCode = result.statusCode || 200;
    if (result.providerResponseHeaders) {
      for (const [key, value] of Object.entries(result.providerResponseHeaders)) {
        res.setHeader(key, value);
      }
    }
    res.end(result.providerResponseBody || 'OK');
  }
  /**
   * Read request body as string.
   */
  readBody(req, maxBytes) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let totalBytes = 0;
      req.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          req.destroy();
          reject(new Error('PayloadTooLarge'));
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });
  }
  /**
   * Handle auto-response for inbound calls using the agent system.
   * Supports tool calling for richer voice interactions.
   */
  async handleInboundResponse(callId, userMessage) {
    console.log(`[voice-call] Auto-responding to inbound call ${callId}: "${userMessage}"`);
    const call = this._manager.getCall(callId);
    if (!call) {
      console.warn(`[voice-call] Call ${callId} not found for auto-response`);
      return;
    }
    if (!this._coreConfig) {
      console.warn('[voice-call] Core config missing; skipping auto-response');
      return;
    }
    try {
      const { generateVoiceResponse } = await import('./response-generator.js');
      const result = await generateVoiceResponse({
        voiceConfig: this._config,
        coreConfig: this._coreConfig,
        callId,
        from: call.from,
        transcript: call.transcript,
        userMessage
      });
      if (result.error) {
        console.error(`[voice-call] Response generation error: ${result.error}`);
        return;
      }
      if (result.text) {
        console.log(`[voice-call] AI response: "${result.text}"`);
        await this._manager.speak(callId, result.text);
      }
    } catch (err) {
      console.error('[voice-call] Auto-response error:', err);
    }
  }
}
function runTailscaleCommand(args, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const proc = spawn('tailscale', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    proc.stdout.on('data', (data) => {
      stdout += data;
    });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({ code: -1, stdout: '' });
    }, timeoutMs);
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout });
    });
  });
}
async function getTailscaleSelfInfo() {
  const { code, stdout } = await runTailscaleCommand(['status', '--json']);
  if (code !== 0) {
    return null;
  }
  try {
    const status = JSON.parse(stdout);
    return {
      dnsName: status.Self?.DNSName?.replace(/\.$/, '') || null,
      nodeId: status.Self?.ID || null
    };
  } catch {
    return null;
  }
}
async function getTailscaleDnsName() {
  const info = await getTailscaleSelfInfo();
  return info?.dnsName ?? null;
}
async function setupTailscaleExposureRoute(opts) {
  const dnsName = await getTailscaleDnsName();
  if (!dnsName) {
    console.warn('[voice-call] Could not get Tailscale DNS name');
    return null;
  }
  const { code } = await runTailscaleCommand([
    opts.mode,
    '--bg',
    '--yes',
    '--set-path',
    opts.path,
    opts.localUrl
  ]);
  if (code === 0) {
    const publicUrl = `https://${dnsName}${opts.path}`;
    console.log(`[voice-call] Tailscale ${opts.mode} active: ${publicUrl}`);
    return publicUrl;
  }
  console.warn(`[voice-call] Tailscale ${opts.mode} failed`);
  return null;
}
async function cleanupTailscaleExposureRoute(opts) {
  await runTailscaleCommand([opts.mode, 'off', opts.path]);
}
async function setupTailscaleExposure(config) {
  if (config.tailscale.mode === 'off') {
    return null;
  }
  const mode = config.tailscale.mode === 'funnel' ? 'funnel' : 'serve';
  const localUrl = `http://127.0.0.1:${config.serve.port}${config.serve.path}`;
  return setupTailscaleExposureRoute({
    mode,
    path: config.tailscale.path,
    localUrl
  });
}
async function cleanupTailscaleExposure(config) {
  if (config.tailscale.mode === 'off') {
    return;
  }
  const mode = config.tailscale.mode === 'funnel' ? 'funnel' : 'serve';
  await cleanupTailscaleExposureRoute({ mode, path: config.tailscale.path });
}
export {
  VoiceCallWebhookServer,
  cleanupTailscaleExposure,
  cleanupTailscaleExposureRoute,
  getTailscaleDnsName,
  getTailscaleSelfInfo,
  setupTailscaleExposure,
  setupTailscaleExposureRoute
};
