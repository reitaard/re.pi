# Named Worker Delegation Checkpoint

Status: optional live bridge on `agent-harness`.

## Goal

Expose the smallest useful `AgentHarness` delegation path without first moving
all of `AgentSession`, print, RPC, and the TUI onto the harness:

```text
current AgentSession parent
  -> delegate tool
  -> isolated named child AgentHarness
  -> typed bounded result
```

This is a tactical bridge. It proves real harness usage now while the larger
main-agent migration remains separate. The later sequence is recorded in
`docs/AGENT_ORCHESTRATION_PLAN.md`.

## Workers

Stable ids are used for routing; display names may be changed later without
breaking prompts or stored configuration.

- `research` -> **Mayuri**
  - explicitly invokes the loaded `librarian` skill
  - tools: `read`, `grep`, `find`, `ls`
  - thinking: off
  - output cap: 2048 tokens
- `audit` -> **Levi**
  - focused code and architecture audit
  - tools: `read`, `grep`, `find`, `ls`
  - thinking: off
  - output cap: 2048 tokens

The delegate schema injects the canonical ids into every model request. Display
names are accepted as case-insensitive aliases, so `Mayuri` resolves to
`research` and `Levi` resolves to `audit`; returned results still use the stable
canonical id.

Mayuri does not contain an invented copy of the Librarian instructions. The
worker resolves the real skill named `librarian` from coding-agent's existing
`ResourceLoader`, reads its file, and invokes it through `AgentHarness.skill()`.
If the skill is not loaded, Mayuri returns a typed failure.

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

Unset the variable or set it to `0` to remove the delegate tool on the next
runtime start.

The tool is registered centrally in `createAgentSessionFromServices()`, so the
same optional behavior applies to print, RPC, interactive, reload, and cwd
replacement paths without separate mode patches.

## Runtime rules

- No worker starts unless the parent calls `delegate`.
- The user may explicitly say `do not delegate` or `do this yourself`.
- An explicit request to use a worker overrides the simple-task optimization.
- The parent is told to use canonical ids and never invent worker names.
- Child sessions are fresh, in-memory, and discarded after the result.
- Children never receive the `delegate` tool, so nesting is impossible.
- Worker tools are read-only.
- Independent delegate calls are marked parallel-safe.
- Parent cancellation and the 300-second timeout call `AgentHarness.abort()`.
- Results are typed as `completed`, `failed`, `cancelled`, or `timeout`.
- Returned text is bounded before entering the parent context.
- Workers do not write Kioku.

Read-only tools are not a complete filesystem sandbox. Do not expose this bridge
to an untrusted remote channel yet.

## Files

- `packages/coding-agent/src/core/delegation/named-worker.ts`
- `packages/coding-agent/src/core/delegation/delegate-tool.ts`
- `packages/coding-agent/src/core/delegation/worker-registry.ts`
- `packages/coding-agent/src/core/agent-session-services.ts`
- `packages/coding-agent/test/delegation.test.ts`
- `docs/AGENT_ORCHESTRATION_PLAN.md`

## Verification

From the repository root:

```bash
npm --prefix packages/agent run build
npm --prefix packages/coding-agent test -- test/delegation.test.ts
npm --prefix packages/coding-agent run build
npm --prefix packages/agent run test:harness
npm --prefix packages/coding-agent test -- test/recode-shiori.test.ts
```

Then perform one live run with `REPI_DELEGATION=1` and explicitly request both
`research`/Mayuri and `audit`/Levi. The parent must emit two real `delegate` calls
rather than reading the assigned files itself. Mayuri requires a loaded skill
whose exact skill name is `librarian`.
