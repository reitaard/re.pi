# Named Worker Delegation Spike

Status: non-production experiment on `aizen-harness-spike`.

## Purpose

Prove the smallest useful delegation path without migrating the existing coding
loop or creating a second agent runtime:

```text
Aizen / parent AgentHarness
  -> delegate tool
  -> one named child AgentHarness
  -> typed bounded result
```

This spike deliberately does not wire `delegate` into `AgentSession`, print,
RPC, or interactive mode. It is an isolated API and test surface for validating
the child lifecycle first.

## Implemented boundary

- `runNamedWorker()` creates one fresh in-memory `AgentHarness` session.
- The worker has a stable id and a separate human-readable display name.
- The child receives only configured read-only tools: `read`, `grep`, `find`,
  and `ls`.
- The child never receives `delegate`, so delegation depth is exactly one.
- The child receives one focused task and optional bounded parent context.
- The final text returned to the parent is character-bounded.
- Parent cancellation and a worker timeout call `AgentHarness.abort()`.
- The result status is typed as `completed`, `failed`, `cancelled`, or
  `timeout`.
- Progress is reduced to start, tool start/end, and completion events.
- A private provider registry can reuse the current coding-agent
  `ModelRegistry`; tests may inject faux `Models` directly.

## Intentionally deferred

- Production registration of the `delegate` tool.
- Parallel worker pool.
- Background or persistent workers.
- Worker-to-worker communication.
- Nested delegation.
- Worktrees or process/container sandboxing.
- A filesystem boundary stronger than the current read-only tool set.
- Durable worker transcripts or recovery.
- Kioku access from workers.
- Gateway authentication and remote channels.
- Final names and prompts for future specialist workers.

The current tools cannot mutate files, but their existing path behavior is not
a complete sandbox. Do not expose this spike to an untrusted channel or treat it
as the Phase 5 trust boundary.

## Files

- `packages/coding-agent/src/core/delegation/named-worker.ts`
- `packages/coding-agent/src/core/delegation/delegate-tool.ts`
- `packages/coding-agent/src/core/delegation/index.ts`
- `packages/coding-agent/test/delegation.test.ts`

## Focused verification

From the repository root:

```bash
npm --prefix packages/agent run build
npm --prefix packages/coding-agent test -- test/delegation.test.ts
npm --prefix packages/coding-agent run build
```

Then run the existing focused harness and Shiori tests to catch integration
regressions:

```bash
npm --prefix packages/agent run test:harness
npm --prefix packages/coding-agent test -- test/recode-shiori.test.ts
```

## Go/no-go question after the spike

If the focused tests pass, review whether the API is small enough to keep. Only
then should a later patch register `delegate` on the first real Aizen
`AgentHarness` coding path. Do not wire it into the old `AgentSession` loop as a
permanent shortcut.
