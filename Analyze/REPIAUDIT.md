# Recode audit

## Scope and provenance

- Audited checkout: `agent-harness` at `733df388`.
- Upstream inspected: `earendil-works/pi` `upstream/main` at `c820aa26` (fetched 2026-07-28).
- This checkout diverged from upstream at `1f9e846c`; it contains 142 commits beyond that merge base. The delta is 577 files, 32,831 insertions, and 3,781 deletions. This is not a claim that every changed line is custom product logic; it is the verified repository delta.
- No jcode comparison is included in this document.

## Product assessment

Recode is a capable, Pi-derived interactive coding agent. Its core is strong: terminal UI, session persistence/tree/fork/compaction, many providers, filesystem and shell tools, JSON/RPC/SDK modes, and a mature extension/skill/theme/package model. `packages/coding-agent` has 214 test files.

The main product risks are startup latency, an unfinished multi-session orchestrator, documentation identity drift, and a host-privilege security boundary.

### Measured startup observation

A local Node RPC benchmark of the already-built coding-agent CLI, using offline mode and an isolated agent directory, recorded 10 measured runs:

- ready-state median: **1,513.8 ms**
- range: **1,497.3–1,597.6 ms**
- first isolated warmup: **28,856.0 ms**

The benchmark waits for an actual RPC `get_state` response (`scripts/profile-coding-agent-node.mjs`), so this is a useful readiness metric. It is not yet a release SLO: there is no retained environment fingerprint, cold-start phase breakdown, or checked-in benchmark artifact. The ~29-second first launch should be investigated before external performance comparisons.

## Additions over the Pi merge base

### Product identity and distribution

- RePi product metadata establishes `RePi`, the `recode` app name, and `@reitaard/repi-coding-agent` package identity (`repi/product.json`; `packages/coding-agent/package.json`).
- Custom local packing and release paths were added for Recode, including binary and Termux packaging support (`scripts/recode/pack-custom-local.mjs`, `scripts/build-binaries.sh`, `scripts/build-termux-release.sh`, `scripts/recode-termux`).
- The updater was hardened around source-checkout preservation and fail-closed update behavior; project operational guidance requires clean, fast-forward-only source updates and prevents replacing Recode with upstream Pi (`OPERATIONS.md`, `packages/coding-agent/src/recode/update/`).

### Named workers and delegation

- Added first-class named worker conversations and delegation tooling (`packages/coding-agent/src/core/delegation/`, `packages/coding-agent/src/core/workers/`, `packages/coding-agent/src/recode-workers.ts`).
- Workers are modal private chats within the root Aizen session rather than replacement root sessions. Delegation is enabled by default with `REPI_DELEGATION=0` as opt-out (`OPERATIONS.md`).
- Current named worker roles include audit, research, and private knowledge-oriented handoff behavior.

### Durable project memory

- Added Kioku/Recode memory runtime, chunking, SQLite storage, routing, and explicit teach controls (`packages/coding-agent/src/core/recode-memory/`, `packages/coding-agent/src/core/recode-teach/`, `packages/coding-agent/src/recode-memory.ts`).
- Project Kioku is deliberately scoped to the launch checkout; workers have read-only recall and cannot write durable memory (`OPERATIONS.md`).

### Code intelligence and tool surface

- Added an LSP client, lifecycle, diagnostics, navigation, edits, formatting, code actions, references, symbol search, and rename integration (`packages/coding-agent/src/lsp/`).
- Added Recode package-management tooling (`packages/coding-agent/src/core/tools/package-manage.ts`).

### Provider and integration work

- Added an optional local OpenAI OAuth proxy provider with bounded startup model discovery and manual refresh (`packages/coding-agent/src/recode-openai-oauth.ts`).
- Added Telegram gateway integration and an OpenAI-compatible provider entry point (`packages/coding-agent/src/recode-telegram-gateway.ts`, `packages/coding-agent/src/recode-open-provider.ts`).
- The AI layer also has substantial provider/model catalog changes relative to the merge base (`packages/ai/src/providers/`).

### Multi-session experiment

- Added `@reitaard/repi-orchestrator`, which starts coding-agent RPC children, tracks instances, and exposes a coordinator path (`packages/orchestrator/`).
- This is explicitly experimental and is **not production-ready**: it has no tests, no RPC/termination deadlines, non-atomic JSON persistence, deleted terminal records, and no installed `orchestrator` executable despite README instructions.

## Priority gaps

1. **Startup (P0):** profile the first isolated launch and divide time among Node/module loading, configuration/context discovery, extension/skill loading, provider initialization, persistence, and TUI rendering. Establish cold/warm TUI and RPC baselines with retained artifacts.
2. **Orchestrator reliability (P0):** add RPC and shutdown timeouts, termination escalation, atomic persistence/recovery, retained terminal state, an explicit ownership/reattach model, a package `bin` or corrected documentation, and failure-path tests.
3. **Product identity (P1):** rewrite primary Pi-branded install/run documentation to use Recode identity and `recode`; the package itself already exposes `recode`.
4. **Background security (P1):** do not position unattended workers as sandboxed. Tools and extensions operate with host-user privileges; background or untrusted-repository workflows need explicit containment.
