# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
# Build (includes docs + webchat embedding)
make build

# Cross-compile for all Windows targets
make build-windows

# Run gateway with dev config (builds first)
make run

# Tests
make test              # Full test suite with -race, 15m timeout
make test-short        # Quick tests with -short flag
make coverage          # Coverage report (excludes proc/pi/cmd packages)
make test-slack-e2e    # Slack semi-automated E2E (needs SLACK_BOT_TOKEN + SLACK_APP_TOKEN)

# Linting & formatting
make lint              # golangci-lint run ./...
make fmt               # go fmt + goimports

# Full CI pipeline
make quality           # fmt → lint → test
make check             # quality → build (full CI)

# Dev environment
make dev               # Start gateway + webchat dev servers
make dev-stop          # Stop all dev services
make dev-status        # Check dev services
make dev-logs          # View gateway logs

# Single test
go test -race -run TestName ./internal/path/to/package/

# Gateway management (production)
hotplex gateway start [-d]      # Start (daemon)
hotplex gateway stop
hotplex gateway restart [-d]    # Restart
hotplex gateway restart --detached  # Worker-initiated (isolated PGID)

# Service management
hotplex service install              # User-level (no root)
hotplex service install --level system  # System-wide
hotplex service start / stop / status / logs -f

# Config wizard
hotplex onboard
```

Go 1.26+, requires CGO_ENABLED=0 for production builds. Uses `modernc.org/sqlite` (pure Go SQLite).

## Architecture

HotPlex is a Go gateway that unifies AI coding agents (Claude Code, OpenCode Server) behind a single **AEP v1** WebSocket protocol. Clients connect via Web Chat UI, Slack, or Feishu — the gateway abstracts protocol differences and streams events through a central Hub.

### Request Flow

```
Client (Web/Slack/Feishu) → Hub (WS broadcast) → Handler (event dispatch)
  → Bridge (session↔worker lifecycle) → SessionManager (state machine)
  → Worker (stdio subprocess) → Back through Hub to client
```

### Key Layers

**Gateway** (`internal/gateway/`) — Central routing and session orchestration:
- `Hub` — WS connection registry, broadcast, per-session seq generation
- `Conn` — Single WS connection (ReadPump/WritePump), backpressure-aware (drops `message.delta` under load, preserves `state`/`done`/`error`)
- `Handler` — AEP event dispatch, validates auth via `security.Authenticator`
- `Bridge` — Session↔Worker lifecycle (Start, Resume, Cancel, LLM retry)
- `LLMRetryController` — Exponential backoff retry with user notification

**Session** (`internal/session/`) — 5-state machine (INIT → RUNNING → WAITING → TERMINATING → TERMINATED) with SQLite persistence, per-user pool quotas, background GC.

**Messaging** (`internal/messaging/`) — Multi-platform adapters with shared `PlatformAdapter` base, multi-bot `BotRegistry`, TTS (Edge-TTS → FFmpeg Opus), STT (SenseVoice), interaction permissions.

**Worker** (`internal/worker/`) — Agent process adapters using `init()` + `worker.Register()` pattern:
- `claudecode/` — Claude Code via stdio (`--print --session-id`)
- `opencodeserver/` — OpenCode Server via HTTP+SSE (singleton process)
- `proc/` — Cross-platform process lifecycle (POSIX PGID / Windows Job Object)
- `base/` — Shared `BaseWorker` + `Conn` + `MetadataHandler`

**Brain** (`internal/brain/`) — LLM orchestration layer: intent routing (LRU cache), safety guard (input/output audit), memory (context compression + preference extraction), LLM clients with decorator chain (retry→cache→ratelimit→circuit→metrics).

**Agent Config** (`internal/agentconfig/`) — B/C dual-channel prompt assembly:
- **B-channel** (directives): META-COGNITION.md (go:embed, always first) → SOUL.md → AGENTS.md → SKILLS.md
- **C-channel** (context): USER.md → MEMORY.md
- Config resolution: per-file, hit-once-then-stop, three-level fallback (global → platform → bot)

**Cron** (`internal/cron/`) — AI-native scheduler: cron expression / fixed interval / one-shot, YAML import, result delivery to messaging platforms.

### Entry Point

`cmd/hotplex/main.go` — Cobra CLI root. Worker packages imported via blank imports to trigger `init()` registration. Subcommands: gateway, service, slack, cron, update, config, dev, onboard, doctor, security, status.

### DI & Lifecycle

`cmd/hotplex/gateway_run.go` `GatewayDeps` struct is the DI container. Shutdown order: signal → cancel ctx → tracing → hub → bridge → sessionMgr → HTTP server.

## Conventions

- **Mutex**: explicit `mu` field, never embed or pass pointer. Lock order: `m.mu` → `ms.mu`.
- **Errors**: `Err` prefix for sentinels, `Error` suffix for custom types, `fmt.Errorf("%w")` wrap.
- **Logging**: `log/slog` with JSON handler.
- **Tests**: `testify/require`, table-driven, `t.Parallel()`. Side-effect imports use `_test.go` files.
- **Worker registration**: `init()` + `worker.Register(worker.TypeXxx, factory)` in each worker package.
- **New messaging adapter**: embed `PlatformAdapter`, register via `init()` + `messaging.Register`.
- **Cross-platform**: use `filepath.Join`/`filepath.Dir`/`filepath.Base`, `os.TempDir()`, `os.UserHomeDir()`. Platform-specific code in `*_unix.go`/`*_windows.go` build tags.
- **Shutdown protocol**: signal → cancel ctx → tracing → hub → bridge → sessionMgr → HTTP.
- **Service restart**: always use `hotplex service restart` (atomic). Manual `stop && sleep && start` only for binary replacement.
- **Backpressure**: drop `message.delta` and `raw` events; preserve `state`, `done`, `error`.
- **Seq generation**: per-session atomic monotonic counter.
- **Process termination**: 3-layer (SIGTERM → wait 5s → SIGKILL).
- **Detached restart**: `--detached` forks independent PGID helper with 60s cooldown.
- **Windows injection**: always use `--append-system-prompt-file` (temp file), never inline args (cmd.exe truncation risk).
- **XML sanitizer**: always on, HTML-escapes reserved tags in agent config to prevent prompt injection.

## Anti-patterns (forbidden)

- ❌ `sync.Mutex` embedding or pointer passing
- ❌ `math/rand` for cryptographic use
- ❌ Shell execution (only `claude` binary allowed)
- ❌ Non-ES256 JWT
- ❌ Hardcoded path separators (`/` or `\`)
- ❌ Direct POSIX signal use (use `process.Kill()`)
- ❌ Using `sed`/`awk` to insert/modify source code lines (use Edit tool)
