# Technology Stack

**Analysis Date:** 2026-02-04

## Languages

**Primary:**
- TypeScript 5.9.3 - Core application logic, CLI wiring, bot integrations, gateway server
- JavaScript (ESM) - Build scripts, entry point runners

**Secondary:**
- Swift - macOS app (`apps/macos/Sources`), iOS app (`apps/ios/Sources`)
- Kotlin - Android app (`apps/android`)
- Shell - Docker setup, build scripts, installers (`scripts/`)

## Runtime

**Environment:**
- Node.js 22.12.0+ (minimum requirement specified in `package.json` engines)
- Also supported: Bun for TypeScript execution and package management

**Package Manager:**
- pnpm 10.23.0 (primary)
- Bun (alternative for install and execution)
- npm (for publishing)

**Lockfile:**
- `pnpm-lock.yaml` (present)
- Bun patches synchronized when modifying dependencies

## Frameworks

**Core:**
- `@hono/node-server` 4.11.7 - HTTP server framework for gateway/webhooks
- `express` 5.2.1 - HTTP middleware (legacy/fallback support)
- `ws` 8.19.0 - WebSocket support for real-time connections

**CLI & TUI:**
- `commander` 14.0.3 - CLI argument parsing and command routing
- `@clack/prompts` 1.0.0 - Interactive terminal prompts
- `chalk` 5.6.2 - Terminal color output
- `@mariozechner/pi-tui` 0.51.1 - Terminal UI components for agent interactions

**Testing:**
- `vitest` 4.0.18 - Unit/integration test runner (config: `vitest.config.ts`)
- `@vitest/coverage-v8` 4.0.18 - V8-based code coverage reporting
- Coverage thresholds: 70% lines/functions/statements, 55% branches (enforced via `package.json` vitest.coverage)

**Build/Dev:**
- `tsdown` 0.20.1 - TypeScript to JavaScript bundler
- `rolldown` 1.0.0-rc.2 - Modern JavaScript bundler
- `tsx` 4.21.0 - TypeScript execution runtime

**Linting & Formatting:**
- `oxlint` 1.43.0 - Rust-based linter (replaces ESLint)
- `oxfmt` 0.28.0 - Code formatter (experimental sort imports/package.json)
- `oxlint-tsgolint` 0.11.4 - TypeScript integration for oxlint
- Config: `.oxlintrc.json`, `.oxfmtrc.jsonc`

## Key Dependencies

**Critical:**
- `@mariozechner/pi-agent-core` 0.51.1 - Core agent orchestration and reasoning
- `@mariozechner/pi-ai` 0.51.1 - AI model adapters for LLM providers
- `@mariozechner/pi-coding-agent` 0.51.1 - Code execution and tool invocation

**Messaging Channels:**
- `@whiskeysockets/baileys` 7.0.0-rc.9 - WhatsApp Web client (native channel)
- `grammy` 1.39.3 - Telegram bot framework with plugins
- `@slack/bolt` 4.6.0 - Slack bot framework
- `@slack/web-api` 7.13.0 - Slack API client
- `discord-api-types` 0.38.38 - Discord API type definitions
- `@line/bot-sdk` 10.6.0 - LINE messaging platform SDK
- `@larksuiteoapi/node-sdk` 1.42.0 - Feishu/Lark enterprise chat SDK
- `signal-utils` 0.21.1 - Signal messenger protocol utilities
- `@grammyjs/runner` 2.0.3 - Telegram polling runner
- `@grammyjs/transformer-throttler` 1.2.1 - Telegram rate limiting

**Cloud & Infrastructure:**
- `@aws-sdk/client-bedrock` 3.981.0 - AWS Bedrock LLM access
- `@agentclientprotocol/sdk` 0.13.1 - ACP protocol for agent communication
- `undici` 7.20.0 - HTTP client library (Node.js native fetch)
- `ws` 8.19.0 - WebSocket server implementation

**Data & Storage:**
- `sqlite-vec` 0.1.7-alpha.2 - Vector embeddings in SQLite
- `yaml` 2.8.2 - YAML configuration parsing
- `json5` 2.2.3 - JSON5 parser for flexible config

**Media & Content Processing:**
- `sharp` 0.34.5 - Image manipulation and optimization
- `pdfjs-dist` 5.4.624 - PDF parsing and text extraction
- `playwright-core` 1.58.1 - Headless browser for web scraping
- `@mozilla/readability` 0.6.0 - Article extraction from web content
- `linkedom` 0.18.12 - DOM implementation for server-side HTML parsing
- `jszip` 3.10.1 - ZIP file handling
- `file-type` 21.3.0 - File type detection from magic bytes
- `node-edge-tts` 1.2.9 - Text-to-speech via Edge TTS
- `markdown-it` 14.1.0 - Markdown parser and renderer

**Utilities & Helpers:**
- `jiti` 2.6.1 - Dynamic ES module loader (plugin SDK runtime)
- `proper-lockfile` 4.1.2 - File-based locks for concurrent access
- `tar` 7.5.7 - TAR archive handling (fixed version, pinned in overrides)
- `zod` 4.3.6 - TypeScript schema validation and parsing
- `ajv` 8.17.1 - JSON Schema validator
- `croner` 10.0.1 - Cron job scheduling
- `@sinclair/typebox` 0.34.48 - JSON Schema code generation
- `long` 5.3.2 - 64-bit integer support (protobuf compatibility)
- `tslog` 4.10.2 - Structured logging
- `cli-highlight` 2.1.11 - Syntax highlighting in terminal
- `qrcode-terminal` 0.12.0 - QR code generation for terminal
- `osc-progress` 0.3.0 - Terminal progress bars

**UI & Components (Web):**
- `lit` 3.3.2 - Web components framework
- `@lit/context` 1.1.6 - Context API for Lit components
- `@lit-labs/signals` 0.2.0 - Reactive signals for Lit
- `hono` 4.11.7 - Lightweight web framework for API handlers

**Terminal & PTY:**
- `@lydell/node-pty` 1.2.0-beta.3 - Pseudo-terminal support for shell sessions
- `authenticate-pam` - PAM authentication for system sessions

**Network & Device Discovery:**
- `@homebridge/ciao` 1.3.4 - mDNS/Bonjour service discovery (local network pairing)

**Development:**
- `ollama` 0.6.3 - Local Ollama model client (dev/testing)

## Configuration

**Environment:**
- Loaded via `dotenv` 17.2.3
- Config file: `.env.example` (provides Twilio WhatsApp example)
- Auth profiles: `~/.openclaw/auth-profiles.json` (encrypted credentials)
- Session store: `~/.openclaw/sessions/` (Pi agent sessions)
- Credentials: `~/.openclaw/credentials/` (web provider login tokens)

**Build:**
- TypeScript config: `tsconfig.json` (strict mode, ES2023 target)
- Bundler: `tsdown.config.ts` (multiple entry points: CLI, plugin-sdk, extension API)
- Test configs: `vitest.config.ts`, `vitest.unit.config.ts`, `vitest.e2e.config.ts`, `vitest.live.config.ts`

**Key Configuration Files:**
- `tsconfig.json` - TypeScript compiler options
- `.oxlintrc.json` - Linting rules (Oxlint)
- `.oxfmtrc.jsonc` - Code formatting (Oxfmt)
- `vitest.config.ts` - Test runner setup
- `.env.example` - Environment template

## Platform Requirements

**Development:**
- Node 22.12.0+
- macOS 12.0+ (for native build via Xcode)
- Xcode 14.0+ (Swift compilation)
- Android SDK 28+ (Android development)
- Optional: Ollama running locally for embedding models

**Production:**
- Node 22.12.0+
- Supports: Linux, macOS, Windows (via WSL)
- Optional: Tailscale for secure tunneling
- Optional: Docker for containerized deployments (includes `docker-compose.yml` and `Dockerfile.sandbox`)

---

*Stack analysis: 2026-02-04*
