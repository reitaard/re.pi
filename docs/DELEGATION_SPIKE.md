# Named Worker Harness Checkpoint

Status: optional live worker harness on `agent-harness`.

## Goal

Expose reusable named workers through `AgentHarness` without first migrating all
of `AgentSession`, print, RPC, and the TUI:

```text
Any Aizen / authorized caller
  -> shared WorkerDirectory
     -> delegate (one-shot)
     -> worker_start / worker_message (conversation)
  -> isolated named child AgentHarness turn
  -> typed bounded result
```

The larger main-agent migration remains separate and is recorded in
`docs/AGENT_ORCHESTRATION_PLAN.md`.

## Workers

Stable ids are used for routing; display names are case-insensitive aliases.

- `research` -> **Mayuri**
  - real loaded `librarian` skill
  - curious, meticulous research personality
  - tools: `read`, `grep`, `find`, `ls`
  - thinking: off
  - output cap: 2048 tokens
- `audit` -> **Levi**
  - blunt, disciplined audit personality
  - tools: `read`, `grep`, `find`, `ls`
  - thinking: off
  - output cap: 2048 tokens

The schemas inject both canonical ids and display-name aliases into every model
request. Returned results always report the stable canonical id.

Mayuri resolves the package-owned skill named `librarian` from coding-agent's
existing `ResourceLoader`, reads its file, and invokes it through
`AgentHarness.skill()`. If the skill is not loaded, Mayuri returns a typed failure.

## Activation

Delegation is disabled by default. Enable it before starting RePi:

### Git Bash / Linux

```bash
export REPI_DELEGATION=1
repi
```

### PowerShell

```powershell
$env:REPI_DELEGATION = "1"
repi
```

The worker tools are registered centrally in `createAgentSessionFromServices()`.
One `WorkerDirectory` is shared by sessions created from the same runtime services.

## Available tools

- `delegate`: one-shot worker call
- `worker_list`: worker identity/capability/personality directory
- `worker_start`: start an addressable worker conversation
- `worker_message`: talk to that worker again using its conversation id
- `worker_status`: process/run status and bounded last result
- `worker_cancel`: cancel an active turn
- `worker_close`: close and forget a conversation

Independent one-shot or conversation calls are parallel-safe. LM Studio or another
provider may queue requests according to its own concurrency setting.

## Runtime rules

- An explicit request to use a worker overrides the simple-task optimization.
- If an explicitly requested worker fails or is cancelled, Aizen must report that
  result instead of silently doing the worker's task itself unless fallback was
  requested.
- Worker identities and personalities come from the directory, not model memory.
- Each turn uses a fresh isolated child `AgentHarness`.
- Worker conversations carry only bounded caller messages and final worker answers.
- Hidden reasoning and child tool transcripts are never copied into shared context.
- Children never receive worker/delegate tools, so nesting is impossible.
- Worker tools are read-only and workspace-guarded.
- There is no built-in worker timeout. Hosts may explicitly configure one.
- Parent/user cancellation calls `AgentHarness.abort()`.
- Results are typed as `completed`, `failed`, `cancelled`, or optional `timeout`.
- Workers do not write Kioku directly.

Read-only tools are not a complete process/container sandbox. Do not expose this
checkpoint to an untrusted remote channel before the Gateway trust boundary exists.

## Public API

The reusable harness layer is exported as:

```ts
import {
  WorkerDirectory,
  createDelegateTool,
  createWorkerControlTools,
} from "@reitaard/repi-coding-agent/workers";
```

## Files

- `packages/coding-agent/src/core/delegation/named-worker.ts`
- `packages/coding-agent/src/core/delegation/delegate-tool.ts`
- `packages/coding-agent/src/core/delegation/worker-directory.ts`
- `packages/coding-agent/src/core/delegation/worker-tools.ts`
- `packages/coding-agent/src/core/delegation/worker-registry.ts`
- `packages/coding-agent/src/core/agent-session-services.ts`
- `packages/coding-agent/test/delegation.test.ts`
- `packages/coding-agent/test/delegation-isolation.test.ts`
- `packages/coding-agent/test/worker-directory.test.ts`
- `docs/AGENT_ORCHESTRATION_PLAN.md`

## Verification

From the repository root:

```bash
npm --prefix packages/agent run build
npm --prefix packages/coding-agent test -- \
  test/delegation.test.ts \
  test/delegation-isolation.test.ts \
  test/worker-directory.test.ts
npm --prefix packages/coding-agent run build
npm --prefix packages/agent run test:harness
npm --prefix packages/coding-agent test -- test/recode-shiori.test.ts
```

Live test requirements:

1. `worker_list` reports Mayuri and Levi with canonical ids and personalities.
2. Two `worker_start` calls can be launched in the same turn.
3. Each result returns a conversation id and canonical worker id.
4. `worker_message` continues one chosen conversation.
5. No 300-second timeout occurs.
6. Aizen does not perform an explicitly assigned worker task after worker failure
   unless the user requested fallback.
