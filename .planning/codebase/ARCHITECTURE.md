# Architecture

**Analysis Date:** 2026-02-04

## Pattern Overview

**Overall:** Modular, layered architecture with clear separation of concerns. OpenClaw is a multi-channel messaging gateway with agent-driven response routing. The system uses a CLI entry point, config-based routing, channel plugins, and an embedded agent runtime.

**Key Characteristics:**
- CLI-first interface with Commander.js for command dispatch
- Plugin-based channel architecture (Telegram, WhatsApp, Discord, etc.)
- Config-driven routing that maps messages to agents via bindings
- Embedded AI agent runtime (Pi) for processing and responding to messages
- Gateway server for managing channels and coordinating communication
- WebSocket-based client-server protocol for gateway communication
- Modular configuration system with Zod validation

## Layers

**Entry Layer:**
- Purpose: Bootstrap CLI and manage process-level concerns
- Location: `src/entry.ts`, `src/index.ts`
- Contains: CLI entry point, environment normalization, unhandled error handlers
- Depends on: Commander.js, process utilities, logger
- Used by: npm/pnpm entry point

**CLI Command Layer:**
- Purpose: Define and dispatch CLI commands (gateway, channels, agent, config, etc.)
- Location: `src/cli/program/`, `src/cli/register.*.ts`
- Contains: Command registration, argument parsing, program context
- Depends on: Commander.js, config loader, deps injection
- Used by: Entry layer, tests

**Command Implementation Layer:**
- Purpose: Execute business logic for CLI commands
- Location: `src/commands/`
- Contains: Agent execution, channel management, configuration, status checks
- Depends on: Config, routing, agents, providers, channels
- Used by: CLI command layer

**Routing & Session Layer:**
- Purpose: Map incoming messages to agents based on channel, account, peer, and bindings
- Location: `src/routing/`, `src/config/sessions/`
- Contains: Agent route resolution, session key building, binding matching logic
- Depends on: Config types
- Used by: Gateway, commands, channel plugins

**Gateway Layer:**
- Purpose: Manage WebSocket communication with clients, protocol handling, state
- Location: `src/gateway/`
- Contains: GatewayClient, protocol validation, chat/call handling, config reload
- Depends on: Protocol definitions, routing, channels
- Used by: Commands, provider integrations, clients

**Channel Layer:**
- Purpose: Implement messaging protocol for each platform
- Location: `src/telegram/`, `src/discord/`, `src/slack/`, `src/whatsapp/`, `src/signal/`, `src/imessage/`, `src/feishu/`, `src/line/`, `src/web/`
- Contains: Channel-specific auth, message handling, platform APIs
- Depends on: Config, routing, gateway
- Used by: Gateway, commands

**Agent Runtime Layer:**
- Purpose: Execute AI agents (Pi) for message processing
- Location: `src/agents/`, `src/commands/agent.ts`
- Contains: Agent execution, model selection, skill loading, tool runner
- Depends on: Config, providers, skills, memory
- Used by: Commands, gateway, bootstrap

**Provider Layer:**
- Purpose: Abstract AI model APIs (Anthropic, OpenAI, Groq, etc.)
- Location: `src/providers/`
- Contains: Model clients, OAuth/auth handling, model fallback logic
- Depends on: External APIs, config
- Used by: Agent runtime

**Plugin System Layer:**
- Purpose: Load and manage channel and skill plugins
- Location: `src/plugins/`, `src/channels/plugins/`, `src/agents/skills/`
- Contains: Plugin registry, plugin loading, plugin types
- Depends on: Node.js dynamic imports
- Used by: Gateway, agents, CLI

**Configuration Layer:**
- Purpose: Parse, validate, and provide configuration
- Location: `src/config/`, `src/config/types.*.ts`
- Contains: Config I/O, Zod schemas, type definitions
- Depends on: File system, JSON5 parser, Zod
- Used by: All layers

**Infrastructure Layer:**
- Purpose: Low-level utilities and platform abstractions
- Location: `src/infra/`, `src/terminal/`, `src/logging/`, `src/process/`
- Contains: Port management, TLS, binaries, error handling, logging, process control
- Depends on: Node.js builtins
- Used by: All layers

**UI Layer (Web/Desktop):**
- Purpose: Render chat interface and configuration UI
- Location: `ui/src/ui/`, `src/browser/`, `src/web/`
- Contains: React components, state management, WebSocket client
- Depends on: Gateway client, React, Tailwind
- Used by: Web provider, desktop app

## Data Flow

**Message Ingestion Flow:**

1. Message arrives on a channel (Telegram, WhatsApp, Discord, etc.)
2. Channel plugin receives message and normalizes it
3. Channel plugin calls routing function with `{channel, accountId, peer}`
4. `resolveAgentRoute()` matches against config bindings → `ResolvedAgentRoute`
5. Gateway routes message to matched agent session
6. Message stored in session memory
7. Agent execution triggered via `agentCommand()`

**Agent Execution Flow:**

1. `agentCommand()` receives message, resolves session key
2. Load agent config, workspace, models, skills
3. Create agent run context
4. Call `runCliAgent()` or `runEmbeddedPiAgent()` with message
5. Agent processes message via Pi RPC
6. Tools/skills executed (with capability gating)
7. Response collected and formatted
8. Result delivered back to channel via `deliverAgentCommandResult()`
9. Session store updated with new memory state

**Configuration Reload Flow:**

1. User modifies config file
2. `config-reload` handler detects change via file watcher
3. New config parsed and validated
4. Existing connections notified
5. New bindings applied to subsequent messages

**State Management:**

- **Session Memory:** Stored per session in `~/.openclaw/sessions/` (JSON files)
- **Session Key:** Built from `{agentId}:{channel}:{accountId}:{peerKind}:{peerId}` hierarchy
- **Config State:** In-memory after load, reloaded on file change
- **Gateway State:** Client connections tracked in `GatewayClient` with pending message tracking

## Key Abstractions

**RoutePeer:**
- Purpose: Represent a message origin (DM, group, channel)
- Examples: `{ kind: "dm", id: "user123" }`, `{ kind: "group", id: "group456" }`
- Pattern: Used in routing to match bindings; normalized to lowercase

**ResolvedAgentRoute:**
- Purpose: Result of routing resolution
- Examples: Returns agent ID, session key, and "matched by" reason (binding.peer, binding.guild, default)
- Pattern: Immutable data structure passed through message flow

**ChannelPlugin:**
- Purpose: Platform-specific messaging integration
- Examples: `TelegramPlugin`, `WhatsAppPlugin`, `DiscordPlugin`
- Pattern: Loaded via plugin registry; exposes `id`, `meta`, channel handlers

**AgentCommandOpts:**
- Purpose: Options for executing an agent
- Pattern: Includes message, session key, model overrides, thinking level, delivery mode
- Location: `src/commands/agent/types.ts`

**OpenClawConfig:**
- Purpose: Root config object with all settings
- Pattern: Validated by Zod schema; includes agents, channels, bindings, hooks, models
- Location: `src/config/types.ts` (composed of multiple type modules)

**GatewayClient:**
- Purpose: WebSocket client for gateway communication
- Pattern: Manages connection lifecycle, message sequencing, frame validation
- Location: `src/gateway/client.ts`

## Entry Points

**CLI Entry:**
- Location: `src/entry.ts` (respawner), `src/index.ts` (main)
- Triggers: `openclaw <command>` from npm script or installed binary
- Responsibilities: Parse arguments, load config, dispatch command

**Gateway Entry:**
- Location: `src/cli/program/register.gateway.ts`
- Triggers: `openclaw gateway run`
- Responsibilities: Start gateway server, load channels, await connections

**Agent Entry:**
- Location: `src/commands/agent.ts`
- Triggers: `openclaw agent --message "..." --to <target>` or via gateway message dispatch
- Responsibilities: Load agent, execute Pi, collect response, deliver result

**Channel Entry:**
- Location: `src/telegram/bot.ts`, `src/discord/bot.ts`, etc.
- Triggers: Platform webhook/bot event
- Responsibilities: Receive message, route to agent, send response

**Web Entrypoint:**
- Location: `ui/src/ui/app.ts`
- Triggers: Browser loads web UI
- Responsibilities: Connect to gateway, render chat, handle user interactions

## Error Handling

**Strategy:** Layered error handling with context preservation and graceful degradation.

**Patterns:**
- Input validation errors: Throw with descriptive messages early in command flow
- Agent execution errors: Caught, logged, returned as error message to user
- Channel errors: Logged separately; don't block other channels
- Config errors: Validation errors shown at load time; reload aborted if invalid
- Network errors: Exponential backoff for gateway client reconnect
- Unhandled errors: Global handler logs and exits with code 1

**Examples:**
- `formatUncaughtError()` in `src/infra/errors.js` wraps error stack
- `agentCommand()` catches agent execution errors and delivers them as response
- `GatewayClient` tracks backoff state and reconnect behavior

## Cross-Cutting Concerns

**Logging:**
- Framework: `console` captured and structured by `enableConsoleCapture()` in `src/logging.ts`
- Subsystems: Per-module loggers via `createSubsystemLogger()` in `src/logging/subsystem.ts`
- Approach: Debug/info/error levels; contextual tags for filtering

**Validation:**
- Config validation: Zod schemas in `src/config/zod-schema.ts`
- Input validation: Commander.js option parsing + custom validators
- Frame validation: Protocol validation in `src/gateway/protocol/`

**Authentication:**
- Channel auth: Per-channel config (tokens, OAuth, API keys)
- Device auth: Stored in `~/.openclaw/.device-auth-token`
- Session auth: Per-agent auth profiles in `~/.openclaw/auth/`

**Authorization:**
- Skill gating: Control which skills agents can invoke
- Command gating: Restrict commands by channel/role
- Allowlisting: Control which peers/accounts can interact

**Concurrency:**
- Session isolation: Session key uniqueness prevents concurrent access issues
- Memory updates: Last-write-wins for session state
- Gateway: Message sequencing via `seq` field in protocol frames

---

*Architecture analysis: 2026-02-04*
