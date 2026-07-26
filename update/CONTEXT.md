# Update Context

## Product identity

The authoritative repository is the customized Recode monorepo derived from Pi.

- Main repository: `C:\Users\re_Lax\Desktop\chat7\re.pi`
- Feature-complete custom-first integration branch: `repi/preserve-custom`
- Exact preserved source commit: `c5ab200bc43993d211e1e97baa0c9abd27c0ce79`
- Earlier incomplete 0.82 port (retained for reference): `repi/canonical`
- Legacy OAuth worktree: `C:\Users\re_Lax\Desktop\chat7\re.pi-0.81.4-oauth`
- Root package: `repi-monorepo`
- Coding-agent package: `@reitaard/repi-coding-agent`
- Source package baseline: `0.81.4`
- Installed staged version: `0.81.4-repi.2.dev.21.48459331`
- Installed runtime source commit: `48459331`
- CLI binary name: `recode`
- Required Node version: `>=22.19.0`

Core packages:

- `packages/coding-agent` — Recode CLI and application behavior
- `packages/agent` — reusable agent runtime and AgentHarness
- `packages/ai` — provider and model abstraction
- `packages/tui` — terminal UI
- `packages/orchestrator` — experimental orchestration

## Repository relationships

The parent repository metadata currently declares:

- `origin`: `https://github.com/reitaard/re.pi.git`
- `upstream`: `https://github.com/earendil-works/pi.git`

The checkout is a linked Git worktree. Its `.git` file points at metadata under:

`C:\Users\re_Lax\Desktop\chat7\re.pi\.git\worktrees\re.pi-0.81.4-oauth`

The legacy OAuth worktree's `.git` pointer was normalized from `/c/...` to `C:/...`; ordinary Git commands now work there. The canonical updater is implemented only in the main repository.

## Installed command

The active command wrappers are under:

- `C:\nvm4w\nodejs\recode`
- `C:\nvm4w\nodejs\recode.cmd`

The global package path:

`C:\nvm4w\nodejs\node_modules\@reitaard\repi-coding-agent`

is a normal self-contained npm installation, not a symlink. Its staged package metadata records source commit `484593314835e5b11aebb52e5d287fdfd2256f91`. The installed Coding Agent, TUI, Agent, and AI runtime trees were verified byte-for-byte against the feature-complete custom build, excluding npm-omitted `.gitignore` files.

## Worker architecture

The behavior-preserving worker-folder restructure is committed and pushed at `c6b4dd13`.

- Generic lifecycle, conversation history, cancellation, workspace security, and tools remain under `packages/coding-agent/src/core/delegation`.
- Worker-owned definitions and specialized implementations live under `packages/coding-agent/src/core/workers/{levi,mayuri,shiori}`.
- Stable worker ids are `audit`, `research`, and `shiori`.
- Shiori has a normal private-chat worker definition with read-only project tools and no Kioku write tool.
- Shiori's schema-constrained memory reviewer remains a separate process-owned path controlled by Cardinal and a single-flight lock.
- Slash tasks run with Creator identity, do not inherit Aizen's abort signal, and inject a hidden, explicitly untrusted handoff into Aizen at the runtime's next safe turn boundary.
- Active conversation defaults are bounded to eight globally and eight per worker; over-capacity batches are rejected atomically.
- `/worker status` exposes conversation ids and `/worker cancel <id>` provides scoped user cancellation.
- Footer context usage reads the live compaction-aware session branch after every persisted AgentHarness model/tool-loop step; it shows `ctx ?` immediately after compaction and then the first available post-compaction usage without waiting for the outer turn.
- Cache read, cache write, and cache-hit footer statistics use the same accent color as token traffic and context usage.
- Private worker chats are modal conversations inside the current Aizen runtime. They retain independent worker conversation ids, history, cancellation, and custom-entry persistence without creating, renaming, replacing, or cancelling the root Aizen session.
- Opening a worker modal does not inherit Aizen's abort signal. Runtime teardown still owns final worker cleanup through the shared directory.

## Existing orchestrator foundation

`packages/orchestrator` already implements most of the process-supervisor substrate needed for multiple full Aizen sessions:

- `OrchestratorSupervisor` owns multiple live RPC child processes and persisted `InstanceRecord` metadata.
- Each instance already has an id, label, cwd, status, session id/file, event subscribers, UI-request routing, and independent stop lifecycle.
- The newline-delimited IPC protocol already supports spawn, list, status, stop, RPC, and streaming RPC attachment.
- Unexpected child exits are isolated and persisted as instance errors.
- Current restart recovery marks previously live children stopped; it does not reattach to orphaned processes.
- Current JSON persistence rewrites the whole instance array synchronously and should be hardened atomically before becoming a durable session supervisor.

The minimal next architecture should extend this package rather than adding another orchestrator.

## Memory retrieval audit

- Automatic Kioku recall is correctly timed at `before_agent_start`, immediately before each agent turn.
- The prior retrieval path used raw-prompt OR FTS, no acceptance threshold, six results, and overlapping 1,600-character chunks. Generic continuation prompts could therefore inject unrelated global memory.
- Canonical memory entries are now isolated into per-entry chunks and automatic injection is locally filtered to at most three high-coverage results. Explicit memory search remains broad.
- The chunk-index version is part of each document hash so the next runtime initialization rebuilds existing chunks without a database migration.
- This resumed session's active project is `C:\Users\re_Lax\Desktop\chat7\re.pi-0.81.4-oauth`; its project Kioku root is empty. The authoritative implementation checkout is `C:\Users\re_Lax\Desktop\chat7\re.pi`, so future sessions should launch there for relevant project auto-recall.
- Global `MEMORY.md` contains obsolete symlink/update facts. They require explicit Creator-reviewed cleanup rather than silent deletion.

## Historical session context

- Session ID: `019f9cc2-c15d-7b26-8fdb-5865e17273ee`
- Session file: `C:\Users\re_Lax\.pi\agent\sessions\--C--Users-re_Lax-Desktop-chat7-re.pi-0.81.4-oauth--\2026-07-26T04-50-37-021Z_019f9cc2-c15d-7b26-8fdb-5865e17273ee.jsonl`

## Release strategy

The custom-first line starts from the exact currently installed source `c5ab200b`, which contains the AgentHarness, durable teach/session, memory, UI, and OpenAI OAuth work. Upstream Pi is analyzed from exact common baseline `1f9e846c`; raw upstream changes are reported but never automatically merged.

The earlier published `@reitaard/repi-coding-agent@0.82.1-repi.1` is quarantined because it does not preserve full custom UI/runtime parity.

## Self-update behavior

Relevant implementation:

- `packages/coding-agent/src/package-manager-cli.ts`
- `packages/coding-agent/src/config.ts`
- `packages/coding-agent/src/utils/version-check.ts`
- `packages/coding-agent/src/utils/windows-self-update.ts`

Current behavior:

1. Query the configured update endpoint.
2. Require the returned package identity to equal `@reitaard/repi-coding-agent`.
3. Refuse before package-manager mutation when the service returns upstream Pi or any foreign package.
4. Allow extension-only updates independently.
5. Provide read-only `recode upstream status|plan` source comparison commands.

At investigation time, the endpoint returned upstream package `@earendil-works/pi-coding-agent` version `0.82.1`. That package exposes the `pi` binary rather than `recode`.

The fail-closed identity guard was validated against the live endpoint: `recode update --self` reports the foreign package and exits cleanly with status 1 without changing the global installation.

## MCP and research access

Project MCP configuration is stored in `.mcp.json`.

- GitHub hosted MCP endpoint is configured with bearer authentication.
- The credential is read from `GITHUB_PAT_TOKEN` and is not stored in the repository.
- GitHub MCP is connected and exposes repository, code, issue, PR, commit, and release tools.
- Web research is available independently through web-search and librarian tooling.

## Validation constraints

Repository rules require:

- run `npm run check` after code changes,
- run focused tests when tests are created or modified,
- do not run unrestricted `npm test` or `npm run build` unless requested,
- do not discard unrelated work,
- do not commit unless explicitly requested.
