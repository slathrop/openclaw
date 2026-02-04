# External Integrations

**Analysis Date:** 2026-02-04

## APIs & External Services

**Messaging Platforms:**
- Telegram - Telegram Bot API via `grammy` (polling/webhook)
  - SDK: `grammy` 1.39.3, `@grammyjs/runner`, `@grammyjs/transformer-throttler`
  - Auth: `TELEGRAM_BOT_TOKEN` env var
  - Code: `src/telegram/`

- Slack - Slack Bot API via `@slack/bolt`
  - SDK: `@slack/bolt` 4.6.0, `@slack/web-api` 7.13.0
  - Auth: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`
  - Code: `src/slack/`

- Discord - Discord API (REST + Gateway)
  - SDK: `discord-api-types` 0.38.38 (types only; custom REST client)
  - Auth: Discord bot token stored in config
  - Code: `src/discord/`

- WhatsApp - WhatsApp Web via Baileys
  - SDK: `@whiskeysockets/baileys` 7.0.0-rc.9
  - Auth: QR code pairing (session stored locally)
  - Code: `src/whatsapp/` (normalize only)

- LINE - LINE Messaging API
  - SDK: `@line/bot-sdk` 10.6.0
  - Auth: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`
  - Code: `src/line/`

- Feishu/Lark - Enterprise chat platform
  - SDK: `@larksuiteoapi/node-sdk` 1.42.0
  - Auth: Lark API credentials
  - Code: `src/feishu/`

- Signal - Signal messenger
  - SDK: `signal-utils` 0.21.1
  - Auth: Signal phone number pairing
  - Code: `src/signal/`

- iMessage - Apple Messages
  - Auth: macOS system integration
  - Code: `src/imessage/`

- Web (WhatsApp Web via Browser)
  - SDK: `playwright-core` 1.58.1 (headless browser)
  - Auth: QR code pairing via browser
  - Code: `src/channels/web/`, `src/web/`

**LLM & AI Providers:**
- AWS Bedrock - AWS generative AI models
  - SDK: `@aws-sdk/client-bedrock` 3.981.0
  - Auth: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (via AWS SDK)
  - Discovery: `src/agents/bedrock-discovery.ts`

- Anthropic Claude - LLM via HTTP API
  - SDK: Native HTTP calls (via `undici`)
  - Auth: `ANTHROPIC_API_KEY`
  - Config: `src/agents/models-config.providers.ts`

- OpenAI - GPT models, embeddings, audio
  - SDK: Native HTTP calls
  - Auth: `OPENAI_API_KEY`
  - Code: `src/memory/embeddings-openai.ts`, `src/memory/batch-openai.ts`

- Google Gemini - Gemini models, embeddings
  - SDK: Native HTTP calls
  - Auth: `GOOGLE_API_KEY`
  - Code: `src/memory/embeddings-gemini.ts`

- Ollama - Local LLM inference
  - SDK: `ollama` 0.6.3
  - Endpoint: `http://127.0.0.1:11434/v1`
  - Discovery: Auto-discovery via `/api/tags`
  - Code: `src/agents/models-config.providers.ts`

- MiniMax - Chinese LLM provider
  - Endpoint: `https://api.minimax.chat/v1`
  - Auth: MiniMax API key

- Xiaomi MiMo - Chinese AI model provider
  - Endpoint: `https://api.xiaomimimo.com/anthropic`
  - Anthropic-compatible API

- Moonshot (Kimi) - Chinese LLM
  - Endpoint: `https://api.moonshot.ai/v1`
  - Auth: Moonshot API key

- Qwen - Alibaba Qwen LLM
  - Portal: `https://portal.qwen.ai/v1`
  - Auth: OAuth or API key

- Venice AI - LLM aggregator
  - Code: `src/agents/venice-models.ts`

- GitHub Copilot - GitHub's code model
  - SDK: Native HTTP calls
  - Auth: GitHub OAuth tokens (via `@octokit/auth`)
  - Code: `src/providers/github-copilot-token.ts`

- Cloudflare AI Gateway - Model proxy/routing
  - SDK: Native HTTP calls
  - Code: `src/agents/cloudflare-ai-gateway.ts`

**Media & Content Processing:**
- PDF.js - PDF text extraction
  - SDK: `pdfjs-dist` 5.4.624
  - Usage: Extract text from PDF documents

- Playwright - Headless browser automation
  - SDK: `playwright-core` 1.58.1
  - Usage: Web scraping, link understanding, WhatsApp Web session

- Mozilla Readability - Article extraction
  - SDK: `@mozilla/readability` 0.6.0
  - Usage: Extract article content from web pages

- Sharp - Image processing
  - SDK: `sharp` 0.34.5
  - Usage: Resize, compress, convert media formats

- Edge TTS - Text-to-speech
  - SDK: `node-edge-tts` 1.2.9
  - Usage: Convert text to audio via Microsoft Edge TTS

**Webhooks & Event Delivery:**
- OpenAI - Webhook callbacks for streaming
  - Code: `src/gateway/openai-http.ts`

- OpenResponses - Custom webhook protocol
  - Code: `src/gateway/openresponses-http.ts`

- Custom Hooks - User-defined HTTP webhooks
  - Support: POST JSON to arbitrary endpoints
  - Code: `src/gateway/server-http.ts`, `src/gateway/hooks.js`

## Data Storage

**Databases:**
- SQLite - Local persistent storage
  - Client: sqlite-vec (vector embeddings)
  - Usage: Sessions, message history, vector embeddings
  - Location: `~/.openclaw/` (local files)

**File Storage:**
- Local filesystem only
- Locations:
  - `~/.openclaw/credentials/` - Encrypted web provider login tokens
  - `~/.openclaw/auth-profiles.json` - Encrypted API key/OAuth credentials
  - `~/.openclaw/sessions/` - Pi agent session state and history

**Caching:**
- In-memory via JavaScript objects
- Session-level caching (no Redis/Memcached)

## Authentication & Identity

**Auth Provider:**
- Custom multi-profile system
  - Config file: `~/.openclaw/auth-profiles.json` (encrypted at rest)
  - Modes: `api_key` (static), `oauth` (refresh token), `token` (bearer)
  - Code: `src/agents/auth-profiles.ts`, `src/config/types.auth.ts`

**OAuth Flow:**
- GitHub OAuth for Copilot
  - Code: `src/providers/github-copilot-auth.ts`

- Qwen Portal OAuth
  - Code: `src/providers/qwen-portal-oauth.ts`

**Session Management:**
- Local storage in `~/.openclaw/sessions/` (JSONL format)
- Pi agent persistent state across conversations
- Platform-specific sessions (Telegram, Discord, Slack, etc.)

## Monitoring & Observability

**Error Tracking:**
- None detected (not integrated)

**Logs:**
- Structured logging via `tslog` 4.10.2
- Code: `src/logging/` directory
- Console output captured and structured in `src/logging.ts`
- Subsystem loggers: `src/logging/subsystem.ts`

**Metrics:**
- Not detected

## CI/CD & Deployment

**Hosting:**
- Self-hosted CLI (runs on user's machine)
- Optional gateway server (local or remote)
- Docker support: `docker-compose.yml`, `Dockerfile.sandbox`

**CI Pipeline:**
- GitHub Actions (referenced in `.github/`)
- Test: `pnpm test`
- Live tests: Docker containers for isolated testing
- Coverage: V8 coverage reporting (70% threshold)

**Release/Publishing:**
- npm publish (via 1Password OTP flow)
- Installers: Served from `https://openclaw.ai/` (sibling repo `../openclaw.ai`)

## Environment Configuration

**Required env vars for basic setup:**
- None (optional; config via interactive setup/REPL)

**Service-specific env vars (optional):**
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` - Twilio WhatsApp
- `TELEGRAM_BOT_TOKEN` - Telegram
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` - Slack
- Discord token - via config file
- `ANTHROPIC_API_KEY` - Anthropic Claude
- `OPENAI_API_KEY` - OpenAI
- `GOOGLE_API_KEY` - Google Gemini
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - AWS Bedrock
- `.env` file template: `.env.example`

**Secrets location:**
- Encrypted storage: `~/.openclaw/auth-profiles.json`
- Web provider credentials: `~/.openclaw/credentials/` (encrypted)
- Environment variables: Shell env or `.env` file

## Webhooks & Callbacks

**Incoming:**
- Slack Event API - Webhook subscriptions
  - Code: `src/slack/monitor/provider.ts`

- Telegram Webhook - Optional webhook polling alternative
  - Code: `src/telegram/webhook-set.ts`

- Discord Gateway - WebSocket connection
  - Gateway Intent subscriptions

- Custom Hooks - User-defined HTTP POST endpoints
  - Code: `src/gateway/server-http.ts`

**Outgoing:**
- OpenAI streaming callbacks
  - Code: `src/gateway/openai-http.ts`

- OpenResponses protocol callbacks
  - Code: `src/gateway/openresponses-http.ts`

- User-defined webhooks for message delivery
  - Support: Route replies to arbitrary HTTP endpoints

## Extensions & Plugins

**Plugin System:**
- Plugin SDK exported: `openclaw/plugin-sdk` (via `src/plugin-sdk/index.ts`)
- Runtime loader: `jiti` 2.6.1
- Plugin discovery: `src/plugins/runtime/`
- Extensions location: `extensions/` (workspace packages)

**Built-in Extensions (in `extensions/`):**
- Channel plugins (Slack, Telegram, Discord, etc.)
- Custom integrations (e.g., Matrix, Microsoft Teams, Zalo)

---

*Integration audit: 2026-02-04*
