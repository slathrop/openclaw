/**
 * LINE channel monitor (inbound message processing)
 * @typedef {object} MonitorLineProviderOptions
 * @property {string} [accountId]
 * @property {import("../config/config.js").OpenClawConfig} [config]
 * @property {AbortSignal} [abortSignal]
 * @property {number} [port]
 * @property {string} [webhookPath]
 * @property {boolean} [verbose]
 * @property {boolean} [requireMention]
 * @typedef {object} LineProviderMonitor
 * @property {() => void} stop
 * @property {Promise<void>} closed
 */
import { chunkMarkdownText } from '../auto-reply/chunk.js';
import { dispatchReplyWithBufferedBlockDispatcher } from '../auto-reply/reply/provider-dispatcher.js';
import { createReplyPrefixOptions } from '../channels/reply-prefix.js';
import { danger, logVerbose } from '../globals.js';
import { normalizePluginHttpPath } from '../plugins/http-path.js';
import { registerPluginHttpRoute } from '../plugins/http-registry.js';
import { deliverLineAutoReply } from './auto-reply-delivery.js';
import { createLineBot } from './bot.js';
import { processLineMessage } from './markdown-to-line.js';
import { sendLineReplyChunks } from './reply-chunks.js';
import {
  replyMessageLine,
  showLoadingAnimation,
  getUserDisplayName,
  createQuickReplyItems,
  createTextMessageWithQuickReplies,
  pushTextMessageWithQuickReplies,
  pushMessageLine,
  pushMessagesLine,
  createFlexMessage,
  createImageMessage,
  createLocationMessage
} from './send.js';
import { validateLineSignature } from './signature.js';
import { buildTemplateMessageFromPayload } from './template-messages.js';
const runtimeState = /* @__PURE__ */ new Map();
function recordChannelRuntimeState(params) {
  const key = `${params.channel}:${params.accountId}`;
  const existing = runtimeState.get(key) ?? {
    running: false,
    lastStartAt: null,
    lastStopAt: null,
    lastError: null
  };
  runtimeState.set(key, { ...existing, ...params.state });
}
function getLineRuntimeState(accountId) {
  return runtimeState.get(`line:${accountId}`);
}
async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}
function startLineLoadingKeepalive(params) {
  const intervalMs = params.intervalMs ?? 18e3;
  const loadingSeconds = params.loadingSeconds ?? 20;
  let stopped = false;
  const trigger = () => {
    if (stopped) {
      return;
    }
    void showLoadingAnimation(params.userId, {
      accountId: params.accountId,
      loadingSeconds
    }).catch(() => {
    });
  };
  trigger();
  const timer = setInterval(trigger, intervalMs);
  return () => {
    if (stopped) {
      return;
    }
    stopped = true;
    clearInterval(timer);
  };
}
async function monitorLineProvider(opts) {
  const {
    channelAccessToken,
    channelSecret,
    accountId,
    config,
    runtime,
    abortSignal,
    webhookPath
  } = opts;
  const resolvedAccountId = accountId ?? 'default';
  recordChannelRuntimeState({
    channel: 'line',
    accountId: resolvedAccountId,
    state: {
      running: true,
      lastStartAt: Date.now()
    }
  });
  const bot = createLineBot({
    channelAccessToken,
    channelSecret,
    accountId,
    runtime,
    config,
    onMessage: async (ctx) => {
      if (!ctx) {
        return;
      }
      const { ctxPayload, replyToken, route } = ctx;
      recordChannelRuntimeState({
        channel: 'line',
        accountId: resolvedAccountId,
        state: {
          lastInboundAt: Date.now()
        }
      });
      const shouldShowLoading = Boolean(ctx.userId && !ctx.isGroup);
      const displayNamePromise = ctx.userId ? getUserDisplayName(ctx.userId, { accountId: ctx.accountId }) : Promise.resolve(ctxPayload.From);
      const stopLoading = shouldShowLoading ? startLineLoadingKeepalive({ userId: ctx.userId, accountId: ctx.accountId }) : null;
      const displayName = await displayNamePromise;
      logVerbose(`line: received message from ${displayName} (${ctxPayload.From})`);
      try {
        const textLimit = 5e3;
        let replyTokenUsed = false;
        const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
          cfg: config,
          agentId: route.agentId,
          channel: 'line',
          accountId: route.accountId
        });
        const { queuedFinal } = await dispatchReplyWithBufferedBlockDispatcher({
          ctx: ctxPayload,
          cfg: config,
          dispatcherOptions: {
            ...prefixOptions,
            // eslint-disable-next-line no-unused-vars
            deliver: async (payload, _info) => {
              const lineData = payload.channelData?.line ?? {};
              if (ctx.userId && !ctx.isGroup) {
                void showLoadingAnimation(ctx.userId, { accountId: ctx.accountId }).catch(() => {
                });
              }
              const { replyTokenUsed: nextReplyTokenUsed } = await deliverLineAutoReply({
                payload,
                lineData,
                to: ctxPayload.From,
                replyToken,
                replyTokenUsed,
                accountId: ctx.accountId,
                textLimit,
                deps: {
                  buildTemplateMessageFromPayload,
                  processLineMessage,
                  chunkMarkdownText,
                  sendLineReplyChunks,
                  replyMessageLine,
                  pushMessageLine,
                  pushTextMessageWithQuickReplies,
                  createQuickReplyItems,
                  createTextMessageWithQuickReplies,
                  pushMessagesLine,
                  createFlexMessage,
                  createImageMessage,
                  createLocationMessage,
                  onReplyError: (replyErr) => {
                    logVerbose(
                      `line: reply token failed, falling back to push: ${String(replyErr)}`
                    );
                  }
                }
              });
              replyTokenUsed = nextReplyTokenUsed;
              recordChannelRuntimeState({
                channel: 'line',
                accountId: resolvedAccountId,
                state: {
                  lastOutboundAt: Date.now()
                }
              });
            },
            onError: (err, info) => {
              runtime.error?.(danger(`line ${info.kind} reply failed: ${String(err)}`));
            }
          },
          replyOptions: {
            onModelSelected
          }
        });
        if (!queuedFinal) {
          logVerbose(`line: no response generated for message from ${ctxPayload.From}`);
        }
      } catch (err) {
        runtime.error?.(danger(`line: auto-reply failed: ${String(err)}`));
        if (replyToken) {
          try {
            await replyMessageLine(
              replyToken,
              [{ type: 'text', text: 'Sorry, I encountered an error processing your message.' }],
              { accountId: ctx.accountId }
            );
          } catch (replyErr) {
            runtime.error?.(danger(`line: error reply failed: ${String(replyErr)}`));
          }
        }
      } finally {
        stopLoading?.();
      }
    }
  });
  const normalizedPath = normalizePluginHttpPath(webhookPath, '/line/webhook') ?? '/line/webhook';
  const unregisterHttp = registerPluginHttpRoute({
    path: normalizedPath,
    pluginId: 'line',
    accountId: resolvedAccountId,
    log: (msg) => logVerbose(msg),
    handler: async (req, res) => {
      if (req.method === 'GET') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('OK');
        return;
      }
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Allow', 'GET, POST');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }
      try {
        const rawBody = await readRequestBody(req);
        const signature = req.headers['x-line-signature'];
        if (!signature || typeof signature !== 'string') {
          logVerbose('line: webhook missing X-Line-Signature header');
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing X-Line-Signature header' }));
          return;
        }
        if (!validateLineSignature(rawBody, signature, channelSecret)) {
          logVerbose('line: webhook signature validation failed');
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }
        const body = JSON.parse(rawBody);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok' }));
        if (body.events && body.events.length > 0) {
          logVerbose(`line: received ${body.events.length} webhook events`);
          await bot.handleWebhook(body).catch((err) => {
            runtime.error?.(danger(`line webhook handler failed: ${String(err)}`));
          });
        }
      } catch (err) {
        runtime.error?.(danger(`line webhook error: ${String(err)}`));
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
    }
  });
  logVerbose(`line: registered webhook handler at ${normalizedPath}`);
  const stopHandler = () => {
    logVerbose(`line: stopping provider for account ${resolvedAccountId}`);
    unregisterHttp();
    recordChannelRuntimeState({
      channel: 'line',
      accountId: resolvedAccountId,
      state: {
        running: false,
        lastStopAt: Date.now()
      }
    });
  };
  abortSignal?.addEventListener('abort', stopHandler);
  return {
    account: bot.account,
    handleWebhook: bot.handleWebhook,
    stop: () => {
      stopHandler();
      abortSignal?.removeEventListener('abort', stopHandler);
    }
  };
}
export {
  getLineRuntimeState,
  monitorLineProvider
};
