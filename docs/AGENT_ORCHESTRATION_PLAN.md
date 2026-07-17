# RePi Agent Orchestration Plan

Status: worker harness phase implemented; Aizen harness migration remains next.

## Target shape

```text
You / Telegram / Web / another Aizen / programmatic host
                        |
                        v
              WorkerDirectory + Gateway later
                        |
                        v
              Aizen (main intelligent agent)
                        |
                        v
          AgentHarness (generic runtime; unchanged)
                        |
             +----------+----------+
             |                     |
       Shiori / Kioku       Named worker conversations
                                  |
                        Mayuri / research
                        Levi / audit
```

OpenClaw remains a control-plane reference for the future Gateway: authentication,
channel routing, session separation, health, cancellation, and typed events. RePi
keeps Pi's runtime and agent loop rather than copying OpenClaw's agent loop or its
full channel/plugin stack.

Pi delegation packages remain references for fresh child context, named specialists,
tool allowlists, bounded results, cancellation, parallel calls, and blocking
recursive delegation.

## Implemented worker harness phase

### Shared source of truth

`WorkerDirectory` owns:

- canonical worker ids and display names
- roles, personalities, skills, and tool allowlists
- case-insensitive id/name resolution
- active and recent worker conversations
- run ids, statuses, elapsed time, last tool, result, and cancellation handles
- bounded caller/worker dialogue history

It is not tied to one Aizen implementation. It is exported publicly as:

```ts
import { WorkerDirectory } from "@reitaard/repi-coding-agent/workers";
```

Any Aizen, future Gateway, test host, or other programmatic caller can mount the
same directory and worker tools.

### Worker tools

- `delegate`: one-shot bounded worker task
- `worker_list`: identities, roles, personalities, skills, and tools
- `worker_start`: open a conversation and send its first message
- `worker_message`: continue the same named conversation
- `worker_status`: inspect active/recent process state
- `worker_cancel`: cancel the current turn without deleting the conversation
- `worker_close`: cancel if needed and forget the conversation

Independent `delegate` and `worker_start` calls remain parallel-safe. The model
provider may queue them according to its own concurrency limit.

### Conversation behavior

Workers act as stable named personalities. A conversation keeps its worker identity
and bounded caller/worker dialogue, allowing later messages such as:

```text
Start Mayuri and research the extension loader.
Ask Mayuri to narrow the result to Windows.
Ask Levi to audit Mayuri's proposed boundary.
```

Each turn still runs through an isolated child `AgentHarness`. RePi carries forward
only bounded user messages and final worker answers. Hidden reasoning and child tool
transcripts never enter the shared directory.

### Current guarantees

- `AgentHarness` remains the generic engine and is not renamed.
- Aizen is the parent identity, not the runtime class.
- Children use read-only, workspace-guarded tools.
- No nested delegation.
- Child output and carried dialogue are bounded.
- Parent/user cancellation propagates.
- There is **no built-in worker timeout**. A host may explicitly configure one.
- An explicitly requested worker is never silently replaced by Aizen doing the task
  itself unless the user requested fallback.
- Workers do not write Kioku directly.

## Stabilization still required

1. Run focused tests and one live Mayuri + Levi conversation test.
2. Add Pi package compatibility aliases so third-party extensions can resolve
   upstream Pi package names against RePi's renamed packages.
3. Connect directory cleanup to final session/runtime shutdown events so active
   conversations are always cancelled when their owning service is destroyed.
4. Consider durable conversation storage only after the in-memory lifecycle is stable.

## Next major phases

### Phase 2: Real Aizen one-shot/print AgentHarness path

- Create Aizen directly on `AgentHarness` for one-shot/print mode.
- Reuse the current model registry, resource loader, tools, session storage, Kioku
  integration, and shared `WorkerDirectory`.
- Keep the existing path temporarily as a rollback boundary.
- Do not rename or fork `AgentHarness`.

### Phase 3: RPC migration

- Move RPC onto the same Aizen harness path.
- Preserve typed events, cancellation, model switching, resource reload, cwd behavior,
  and shared worker access.
- Avoid a separate RPC-only agent loop.

### Phase 4: Interactive migration

- Migrate the TUI last because it is the largest and most coupled surface.
- Preserve editing, autocomplete, rendering, themes, status, extension events, tool
  display, cancellation, and session operations.
- Remove the temporary `AgentSession` bridge after parity is proven.

### Phase 5: Deterministic Gateway

Add one long-running ordinary server process for:

- authentication and device pairing
- Telegram/web/other channel adapters
- routing messages to isolated Aizen sessions
- exposing the shared worker directory to authorized callers
- health, cancellation, and status
- typed request/response and lifecycle events
- keeping credentials outside model prompts

The Gateway performs no AI reasoning. It routes work to Aizen or directly to an
authorized named worker harness.

### Later references, not current requirements

- background worker turns and queued messages
- durable worker conversations across process restarts
- worker-to-Aizen blocked/decision messages inspired by `pi-intercom`
- allow/ask/deny policies inspired by `pi-agent-permissions`
- stronger central filesystem and command boundaries inspired by `pi-file-permissions`
- chains, worktrees, and richer supervision only after the lightweight path is stable

## Non-negotiable identities

- Aizen: main intelligent agent
- AgentHarness: generic runtime engine
- Shiori: existing memory-review specialist
- Cardinal: current memory-routing behavior/configuration
- Kioku: durable memory
- Mayuri: `research` worker
- Levi: `audit` worker
