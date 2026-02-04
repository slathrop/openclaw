# Codebase Structure

**Analysis Date:** 2026-02-04

## Directory Layout

```
openclaw-simplified/
├── src/                         # TypeScript source code
│   ├── index.ts                # Main CLI entry point
│   ├── entry.ts                # CLI respawner/bootstrapper
│   ├── runtime.ts              # Runtime environment abstraction
│   ├── cli/                     # CLI infrastructure and commands
│   ├── commands/                # Command implementations
│   ├── gateway/                 # Gateway server and protocol
│   ├── routing/                 # Message routing and session resolution
│   ├── config/                  # Configuration loading and validation
│   ├── agents/                  # Agent execution runtime
│   ├── providers/               # AI model provider clients
│   ├── channels/                # Shared channel infrastructure
│   ├── telegram/                # Telegram channel implementation
│   ├── discord/                 # Discord channel implementation
│   ├── whatsapp/                # WhatsApp channel implementation
│   ├── slack/                   # Slack channel implementation
│   ├── signal/                  # Signal channel implementation
│   ├── imessage/                # iMessage channel implementation
│   ├── feishu/                  # Feishu (DingTalk) channel
│   ├── line/                    # LINE channel
│   ├── web/                     # Web provider (WhatsApp Web)
│   ├── plugins/                 # Plugin system
│   ├── infra/                   # Infrastructure utilities
│   ├── terminal/                # Terminal UI utilities
│   ├── logging/                 # Structured logging
│   ├── memory/                  # Session memory and persistence
│   ├── sessions/                # Session management
│   ├── utils/                   # Shared utility functions
│   ├── types/                   # Type definitions
│   └── shared/                  # Shared modules
├── ui/                          # Web UI (React + Tailwind)
│   └── src/ui/                  # UI components and controllers
├── docs/                        # Documentation (Markdown)
├── extensions/                  # Plugin extensions (workspace packages)
├── test/                        # Test fixtures and utilities
├── scripts/                     # Build and utility scripts
├── package.json                 # Package manifest
└── tsconfig.json                # TypeScript configuration
```

## Directory Purposes

**src/cli/:**
- Purpose: CLI command registration, argument parsing, dependency injection
- Contains: Command routing, help system, option parsing, profiles
- Key files: `src/cli/program/build-program.ts` (root command builder), `src/cli/program/command-registry.ts` (route mapping), `src/cli/deps.ts` (dependency injection)

**src/commands/:**
- Purpose: Business logic for all CLI commands
- Contains: Agent execution, channel management, config, status, health checks
- Key files: `src/commands/agent.ts` (agent execution), `src/commands/agents.ts` (agent commands), `src/commands/health.ts` (health checks), `src/commands/status.ts` (status reporting)

**src/cli/program/:**
- Purpose: Program construction and command registration
- Contains: Command builder, command registry, help, pre-action hooks
- Key files: `src/cli/program/build-program.ts`, `src/cli/program/command-registry.ts`, `src/cli/program/register.*.ts` (specific command registrations)

**src/gateway/:**
- Purpose: Gateway server, WebSocket protocol, chat/call handling
- Contains: Client management, protocol frames, configuration reload, call handling
- Key files: `src/gateway/client.ts` (WebSocket client), `src/gateway/boot.ts` (bootstrap), `src/gateway/protocol/` (protocol definitions)

**src/routing/:**
- Purpose: Route messages to agents based on config bindings
- Contains: Binding matching, session key generation, agent resolution
- Key files: `src/routing/resolve-route.ts` (main routing logic), `src/routing/session-key.ts` (session key builder), `src/routing/bindings.ts` (binding iteration)

**src/config/:**
- Purpose: Load, parse, validate configuration
- Contains: Type definitions, Zod schemas, config I/O, migrations
- Key files: `src/config/io.ts` (file I/O), `src/config/zod-schema.ts` (validation), `src/config/types.*.ts` (type modules by feature)
- Pattern: Types split across multiple files for locality; central export in `src/config/types.ts`

**src/agents/:**
- Purpose: Agent execution, model selection, skill management
- Contains: Agent runner, model catalog, skill loading, timeout handling
- Key files: `src/agents/cli-runner.ts` (local agent runner), `src/agents/pi-embedded.ts` (embedded Pi runtime), `src/agents/model-selection.ts` (model resolution), `src/agents/skills.ts` (skill loading)

**src/providers/:**
- Purpose: AI model provider integrations
- Contains: Model client wrappers, OAuth handling, auth flows
- Key files: Per-provider auth/models (e.g., `src/providers/github-copilot-auth.ts`, `src/providers/qwen-portal-oauth.ts`)

**src/channels/:**
- Purpose: Shared channel infrastructure and metadata
- Contains: Channel registry, allowlists, command gating, conversation labels
- Key files: `src/channels/registry.ts` (channel listing), `src/channels/dock.ts` (docking system), `src/channels/plugins/` (plugin implementations)

**src/telegram/**, **src/discord/**, etc.:
- Purpose: Channel-specific implementations
- Contains: Platform-specific auth, message handlers, webhooks
- Pattern: Each channel has `bot.ts` (event handler) and auth files

**src/plugins/:**
- Purpose: Plugin system and loading
- Contains: Plugin registry, runtime, types
- Key files: `src/plugins/runtime.ts` (plugin registry), `src/plugins/loader.ts` (plugin loading)

**src/infra/:**
- Purpose: Low-level infrastructure utilities
- Contains: Port management, TLS, binaries, environment, errors, device auth
- Key files: `src/infra/ports.ts` (port checking), `src/infra/dotenv.ts` (env loading), `src/infra/device-identity.ts` (device tracking)

**src/terminal/:**
- Purpose: Terminal UI output and formatting
- Contains: Progress indicators, table formatting, color palette, prompts
- Key files: `src/terminal/palette.ts` (color scheme), `src/terminal/table.ts` (table rendering), `src/terminal/progress.ts` (progress bars)

**src/logging/:**
- Purpose: Structured logging and capture
- Contains: Subsystem loggers, console capture, formatting
- Key files: `src/logging/subsystem.ts` (per-module loggers), `src/logging.ts` (capture setup)

**src/utils/:**
- Purpose: Shared utility functions
- Contains: Message channel resolution, path normalization, text utilities
- Key files: `src/utils.ts` (main utilities), `src/utils/message-channel.ts` (message channel logic)

**src/types/:**
- Purpose: Type definitions for external packages
- Contains: Type stubs for packages without types
- Pattern: `.d.ts` files for vendored/untyped packages

**ui/src/ui/:**
- Purpose: Web interface components and state
- Contains: Chat views, config forms, controllers, styling
- Key files: `ui/src/ui/app.ts` (root component), `ui/src/ui/app-render.ts` (rendering), `ui/src/ui/chat/` (chat components), `ui/src/ui/controllers/` (feature controllers)

**src/config/sessions/:**
- Purpose: Session storage and retrieval
- Contains: Session file I/O, session key parsing
- Key files: `src/config/sessions.ts` (main API), `src/config/sessions/main-session.ts` (main session resolution)

**src/auto-reply/:**
- Purpose: Auto-reply and templating
- Contains: Reply text formatting, template application
- Key files: `src/auto-reply/reply.ts` (reply logic), `src/auto-reply/templating.ts` (template engine)

**src/memory/:**
- Purpose: Session memory and conversation history
- Contains: Memory storage, conversation persistence
- Key files: Per-memory-type modules

**docs/:**
- Purpose: User documentation (Markdown)
- Contains: Installation, channel setup, configuration guides
- Pattern: Root-relative doc links (no `.md` extension), structured by topic

**extensions/:**
- Purpose: Community and commercial plugins
- Contains: Channel plugins, skill plugins (as npm workspace packages)
- Pattern: Each extension is a standalone package with its own `package.json`

**test/:**
- Purpose: Test utilities and fixtures
- Contains: Mock implementations, test helpers, fixture data
- Key files: `test/mocks/`, `test/fixtures/`, `test/helpers/`

**scripts/:**
- Purpose: Build, test, and utility scripts
- Contains: TypeScript/build runners, test orchestration, code generation
- Key files: `scripts/run-node.mjs`, `scripts/test-parallel.mjs`, `scripts/build-docs-list.mjs`

## Key File Locations

**Entry Points:**
- `src/index.ts`: CLI main export
- `src/entry.ts`: CLI respawner/bootstrapper
- `openclaw.mjs`: npm bin entry (wrapper around built index.js)

**Configuration:**
- `src/config/config.ts`: Main config loader
- `src/config/zod-schema.ts`: Validation schema
- `src/config/types.ts`: Type exports
- `~/.openclaw/config.json`: User config file location
- `~/.openclaw/credentials/`: Channel credentials storage

**Core Logic:**
- `src/commands/agent.ts`: Agent execution
- `src/routing/resolve-route.ts`: Message routing
- `src/gateway/client.ts`: Gateway WebSocket client
- `src/agents/cli-runner.ts`: Local agent runner
- `src/agents/pi-embedded.ts`: Embedded Pi agent runtime

**Testing:**
- `src/**/*.test.ts`: Co-located unit tests
- `src/**/*.e2e.test.ts`: End-to-end tests
- `vitest.config.ts`: Test runner configuration
- `test/fixtures/`: Test data and mocks

## Naming Conventions

**Files:**
- Commands: `{feature}-cli.ts` (e.g., `channels-cli.ts`, `memory-cli.ts`)
- Tests: `{module}.test.ts` or `{module}.e2e.test.ts`
- Type definitions: `types.{feature}.ts` for config types, `types/` for external types
- Utilities: Direct name (e.g., `utils.ts`, `prompt.ts`, `exec.ts`)
- Barrels: `index.ts` or `{module}.ts` that re-export
- Async operations: Included in function name (e.g., `loadConfig`, `resolveRoute`)

**Directories:**
- Features: Plural if multiple files (e.g., `agents/`, `channels/`)
- Organized by functional domain, not layer
- Sub-directories for related files (e.g., `src/config/sessions/`, `src/agents/skills/`)

**Functions:**
- Load/fetch operations: `load*` or `fetch*` (e.g., `loadConfig`)
- Build/create operations: `build*` or `create*` (e.g., `buildProgram`, `createDefaultDeps`)
- Resolve operations: `resolve*` (e.g., `resolveRoute`, `resolveAgentId`)
- Normalize operations: `normalize*` (e.g., `normalizeEnv`, `normalizeAgentId`)
- Utility predicates: `is*` or `has*` (e.g., `isMainModule`, `hasFlag`)

**Variables:**
- Config objects: `cfg` (short for config)
- Dependencies: `deps` (injected dependencies)
- Runtime environment: `runtime`
- Options/parameters: `opts` or `params`
- Temporary/working: `tmp*` prefix

**Types:**
- Command options: `*CommandOpts` (e.g., `AgentCommandOpts`)
- Config types: No suffix (e.g., `OpenClawConfig`, `ChannelConfig`)
- Result types: `*Result` (e.g., `BootRunResult`)
- Resolved types: `Resolved*` (e.g., `ResolvedAgentRoute`)

## Where to Add New Code

**New Channel:**
1. Create `src/{channel-name}/` directory
2. Implement auth in `src/{channel-name}/{channel-name}-auth.ts`
3. Implement bot/handler in `src/{channel-name}/{channel-name}-bot.ts`
4. Register in `src/channels/registry.ts` (CHAT_CHANNEL_ORDER, CHAT_CHANNEL_META)
5. Export plugin from plugin index
6. Add config types in `src/config/types.{channel-name}.ts`
7. Add tests co-located: `src/{channel-name}/{module}.test.ts`

**New Agent Feature:**
1. Implement in `src/agents/{feature}.ts`
2. Export from `src/agents/` if it's a public API
3. Integrate into `src/commands/agent.ts` command flow
4. Add tests: `src/agents/{feature}.test.ts`

**New CLI Command:**
1. Create command implementation in `src/commands/{command}.ts`
2. Register in `src/cli/program/register.{command}.ts`
3. Add to command registry in `src/cli/program/command-registry.ts`
4. Export from command registration file
5. Tests co-located: `src/commands/{command}.test.ts`

**New Config Option:**
1. Add type in appropriate `src/config/types.{feature}.ts`
2. Add to Zod schema in `src/config/zod-schema.ts`
3. Document in `docs/configuration/`
4. Update migration logic if backwards-compatible change
5. Reference in relevant command code

**New Utility:**
1. **Shared utilities:** `src/utils.ts` or `src/utils/{feature}.ts`
2. **Terminal UI:** `src/terminal/{feature}.ts`
3. **Logging/infra:** `src/infra/{feature}.ts`
4. Export from directory index if it's internal API

**New Test:**
- Co-locate with source: `src/{path}/{module}.test.ts`
- Follow naming: `describe('module', () => { test('behavior') })`
- Use fixtures from `test/fixtures/`
- Mock external dependencies
- Aim for 70%+ line coverage per module

## Special Directories

**src/cli/program/register.*.ts:**
- Purpose: Command registration modules (one per feature group)
- Generated: No
- Committed: Yes
- Pattern: Each file exports `register{Feature}Command()` function with `CommandRegistration` type

**~/.openclaw/:**
- Purpose: User data directory
- Generated: Yes (created on first run)
- Committed: No
- Contains: config.json, credentials/, sessions/, auth/, .device-auth-token

**dist/:**
- Purpose: Built output
- Generated: Yes (via `pnpm build` / tsdown)
- Committed: No
- Pattern: TypeScript compiled to ESM JavaScript

**ui/dist/:**
- Purpose: Built web UI
- Generated: Yes (via `pnpm ui:build`)
- Committed: No
- Pattern: Bundled React app

**extensions/*/dist/:**
- Purpose: Built plugin distributions
- Generated: Yes
- Committed: No
- Pattern: Each extension workspace builds independently

**docs/zh-CN/:**
- Purpose: Chinese documentation (generated)
- Generated: Yes (via `pnpm docs:i18n`)
- Committed: No
- Pipeline: English docs → glossary adjustment → auto-translate

**.git/hooks/ (symbolic via git config core.hooksPath = git-hooks):**
- Purpose: Pre-commit hooks
- Contains: Linting, type checking, formatting
- Location: `git-hooks/` directory in repo root

**node_modules/, .pnpm/:**
- Purpose: Installed dependencies
- Generated: Yes
- Committed: No
- Pattern: Managed by pnpm; checked for consistency via pnpm-lock.yaml

---

*Structure analysis: 2026-02-04*
