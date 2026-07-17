# RePi Agent Orchestration Plan

Status: planned sequence after the named-worker delegation checkpoint.

## Target shape

```text
You / Telegram / Web
        |
        v
Gateway (ordinary server code; no AI reasoning)
        |
        v
Aizen (main intelligent agent)
        |
        v
AgentHarness (generic runtime; name remains unchanged)
        |
        +-- Shiori (existing memory reviewer)
        +-- Mayuri / research
        +-- Levi / audit
        |
        v
Kioku (durable memory)
```

OpenClaw is a control-plane reference for the future Gateway: authentication,
channel routing, session separation, health, cancellation, and typed events. RePi
keeps Pi's runtime and agent loop rather than copying OpenClaw's agent loop or its
full channel/plugin stack.

Pi delegation packages are implementation references for fresh child context,
named specialists, tool allowlists, bounded results, cancellation, parallel calls,
and blocking recursive delegation. Background workers, chains, worktrees,
worker-to-worker messaging, complex permissions, and permanent child sessions are
not part of the first version.

## Current checkpoint

- `AgentHarness` remains the generic engine.
- Aizen is the parent identity.
- `delegate` creates one fresh child `AgentHarness` per task.
- Child context is isolated and in-memory.
- Child tools are read-only and workspace-guarded.
- Child output is bounded.
- Cancellation and a 300-second timeout propagate to the child.
- No nested delegation.
- Independent child calls may be launched in parallel; the provider may queue them.
- Stable worker ids are `research` and `audit`; display names are Mayuri and Levi.

## Immediate stabilization before the major migration

1. Canonical worker routing
   - Inject the worker directory into the `delegate` tool on every model request.
   - Constrain the schema to canonical ids.
   - Accept Mayuri and Levi as case-insensitive aliases.
   - Never require Aizen to remember worker ids from conversation history.
   - An explicit request to use a worker overrides the simple-task optimization.

2. Pi package compatibility
   - Allow third-party Pi extensions to resolve upstream Pi package names against
     RePi's renamed `@reitaard/repi-*` packages.
   - Keep external skills such as `librarian` package-owned rather than copying
     their instructions into RePi.

3. Repeat the live Mayuri + Levi test
   - Both tasks must produce real `delegate` calls.
   - No direct parent read before the requested worker runs.
   - Results must report canonical worker id, display name, run id, status, and duration.

## Major phases

### Phase 1: Live worker/process directory

Add a lightweight in-memory directory, similar in purpose to a tiny MCP service
but internal to RePi. It is the source of truth for worker definitions and active
runs.

Track only operational information:

- run id
- canonical worker id and display name
- short task summary
- queued/running/completed/failed/timeout/cancelled status
- start time and elapsed time
- current or last tool name
- final error or completion metadata
- cancellation handle

Expose deterministic tools:

- `worker_list`: available workers and capabilities
- `worker_status`: active/recent runs and status
- `worker_cancel`: cancel one run by id

Do not expose hidden reasoning or full child transcripts. Clean up stale completed
runs and abort active children when the parent session closes or reloads.

The compact worker directory remains injected into `delegate` for speed. The live
status tools are used only when Aizen needs dynamic process information, avoiding
an unnecessary extra tool round trip for normal delegation.

### Phase 2: Real Aizen one-shot/print AgentHarness path

- Create Aizen directly on `AgentHarness` for one-shot/print mode.
- Reuse the current model registry, resource loader, tools, session storage, Kioku
  integration, and named-worker directory.
- Keep the existing path available temporarily as a rollback boundary.
- Do not rename or fork `AgentHarness`.

### Phase 3: RPC migration

- Move RPC onto the same Aizen harness path.
- Preserve typed events, cancellation, model switching, resource reload, and cwd
  behavior.
- Avoid a separate RPC-only agent loop.

### Phase 4: Interactive migration

- Migrate the TUI last because it is the largest and most coupled surface.
- Preserve editing, autocomplete, rendering, themes, status, extension events,
  tool display, cancellation, and session operations.
- Remove the temporary `AgentSession` delegation bridge after parity is proven.

### Phase 5: Deterministic Gateway

Add one long-running ordinary server process for:

- authentication and device pairing
- Telegram/web/other channel adapters
- routing messages to isolated sessions
- health, cancellation, and status
- typed request/response and lifecycle events
- keeping credentials outside model prompts

The Gateway performs no AI reasoning. It routes work to Aizen.

### Later references, not first-version requirements

- worker-to-Aizen blocked/decision messages inspired by `pi-intercom`
- allow/ask/deny policies inspired by `pi-agent-permissions`
- stronger central filesystem and command boundaries inspired by
  `pi-file-permissions`
- background workers, chains, worktrees, and richer supervision only after the
  lightweight path is stable

## Non-negotiable identities

- Aizen: main intelligent agent
- AgentHarness: generic runtime engine
- Shiori: existing memory-review specialist
- Cardinal: current memory-routing behavior/configuration
- Kioku: durable memory
- Mayuri: `research` worker
- Levi: `audit` worker
