# Update Work Log

## 2026-07-26 — Initial investigation

### Completed

- Identified the customized coding-agent package as `@reitaard/repi-coding-agent` version `0.81.4` with binary name `recode`.
- Located the existing self-update implementation.
- Confirmed that update discovery currently queries `https://pi.dev/api/latest-version`.
- Confirmed the endpoint currently advertises upstream `@earendil-works/pi-coding-agent` version `0.82.1`.
- Confirmed the upstream package exposes `pi`, not `recode`.
- Confirmed the active global package path is symlinked to this checkout's `packages/coding-agent` directory.
- Determined that the current package-manager update path could replace the linked fork package without updating this checkout.
- Located repository remotes in parent Git metadata:
  - origin: `reitaard/re.pi`
  - upstream: `earendil-works/pi`
- Detected a broken Git Bash linked-worktree boundary requiring investigation.
- Configured project-local GitHub MCP access in `.mcp.json`.
- Verified authenticated GitHub MCP connectivity and tool availability.

### Additional completed work

- Repaired the legacy OAuth worktree `.git` pointer without touching its generated-model changes.
- Established `repi/canonical` at published tag `repi-v0.82.1-r1` in the authoritative `re.pi` repository.
- Verified that the canonical release already contains the OpenAI OAuth provider and its metadata-precedence fixes; the remaining OAuth-only commits were temporary CI workflow churn.
- Added source-checkout detection using `repi/product.json` product identity.
- Added clean-branch, fork-tag, and fast-forward-only source update behavior.
- Preserved npm package-manager updates for non-source installations.
- Added regression coverage for source-root detection, fast-forward updates, branch preservation, dirty checkout refusal, detached checkout refusal, and divergence refusal.
- Regenerated the coding-agent shrinkwrap and install lock required by the canonical branch.
- Regenerated model catalogs through the approved generator to restore strict type checking.
- Focused updater tests pass: 9 tests across 3 files.
- Full `npm run check` passes.

### Next

- Commit and push the canonical updater changes.
- Build and smoke-test canonical Recode.
- Repoint the development `recode` symlink from the legacy OAuth worktree to the canonical checkout.
- Merge the canonical line into `agent-harness` after validation.

## 2026-07-26 — Three-way upstream planner

- Recorded exact Pi baseline `b4f293684bba718d59cc1157679bcf6157b3a7f5` (`v0.82.1`).
- Added explicit protected-path ownership under `repi/upstream-ownership.json`.
- Added read-only `recode upstream status|plan [target] [--json]` commands.
- Classified paths as custom-only, upstream-only, identical, protected, overlapping, or rename-review.
- Required a clean checkout and a target descended from the recorded baseline to prevent incomplete or misleading reports.
- Added unit and temporary-repository regression coverage proving no worktree mutation.
- Initial local `upstream/main` comparison on the incomplete 0.82 port reported 110 preserved custom-only files, 6 upstream-only candidates, and no overlaps against the then-recorded 0.82 baseline.

## 2026-07-26 — Custom-first pivot

- Visual testing proved the 0.82 canonical package omitted custom UI/runtime behavior; the global symlink was immediately restored.
- Preserved exact feature-complete source commit `c5ab200b`, which includes `agent-harness` plus later durable teach/session and OpenAI OAuth work.
- Aborted an experimental raw merge after detecting a fork/upstream tag-baseline collision; no conflict resolution or source loss occurred.
- Established `repi/preserve-custom` from exact `c5ab200b` and removed only assistant-created build artifacts.
- Recorded exact common Pi baseline `1f9e846c84f7d53356e7904e53f67b479d6f9c86` for read-only upstream classification.
- Added fail-closed package identity checks so `recode update` cannot replace `@reitaard/repi-coding-agent` with upstream Pi.
- Added read-only `recode upstream status|plan [target] [--json]` to the feature-complete line.
- Recorded historical session `019f9cc2-c15d-7b26-8fdb-5865e17273ee` and deferred worker restructuring until after release stability.
- Added a self-contained local packer that stages a Git-derived top-level version and bundles exact custom AI, Agent, TUI, and runtime dependencies.
- Built committed model catalogs offline so packaging did not rewrite generated source.
- Isolated artifact smoke tests passed for version, help, model listing, upstream planning, and selected custom runtime hashes.
- Verified complete packaged Coding Agent, TUI, Agent, and AI runtime trees against built source; only npm-excluded `.gitignore` files differed.
- Installed normal global package `@reitaard/repi-coding-agent@0.81.4-repi.2.dev.7.d9e9359f`; global path is no longer a package symlink.
- Verified the final global runtime trees exactly match the custom build.
- Verified live `recode update --self` refuses `@earendil-works/pi-coding-agent` and exits cleanly with status 1.
- Final artifact SHA-256: `8408643910b3a1841d5a100239eb095047eb5c6487a0a0f864d731e12e67dbae`.

## 2026-07-26 — Worker capability follow-up

- Confirmed multiple persistent conversations can use the same named worker identity.
- Added `worker_start_many` to launch two to eight independent conversations concurrently in one tool call.
- Added Levi's bounded `git_read` capability with a strict read-only subcommand allowlist.
- Blocked Git mutation commands, external execution/configuration flags, and parent traversal.
- Added explicit alternate workspace selection restricted to worktrees sharing the active Git common directory.
- Preserved Mayuri's librarian specialization and strengthened Levi's Git-evidence audit prompt.
- Focused worker tests pass, including simultaneous running-state proof and sibling/unrelated worktree boundaries.
- Installed final worker-capable package `0.81.4-repi.2.dev.9.b4b58fc9` from source commit `b4b58fc949c3d800ce4e29aca9f905c8b3556bb9`.
- Verified the installed worker-capable Coding Agent, TUI, Agent, and AI trees exactly match the custom build.
- Final worker-capable artifact SHA-256: `b15220d1a5975d06dbeede5350503bca633c121cc1e519633cf0caa6720d956a`.

## 2026-07-26 — Worker presentation and module boundary

- Restored `worker_start_many` batch count, per-worker identity/color/activity, progress text, timing, and separate handoff cards.
- Committed and pushed the presentation fix at `c1fd1121`; installed staged package `0.81.4-repi.2.dev.11.c1fd1121` with SHA-256 `89584b63eb3bdb310a1f3683af08a725f914041ab8ebd217a20aac97db6bb964`.
- Moved Levi, Mayuri, and Shiori-owned code under dedicated worker folders while retaining generic delegation lifecycle machinery.
- Moved specialized tool construction into worker definitions through `createTools`.
- Fixed native/MSYS Windows sibling-worktree path normalization.
- Committed and pushed the structural boundary at `c6b4dd13`.

## 2026-07-26 — Shiori and independent slash-worker phase

- Registered Shiori as stable worker id `shiori` with private normal conversation, read-only local tools, and no Kioku write capability.
- Preserved the isolated schema-constrained Shiori reviewer and made it explicit through `/shiori review [path]`.
- Removed review dependence on Aizen's idle state while retaining the process-wide single-flight lock.
- Made slash tasks independent of Aizen's abort signal and delivered completed reports through hidden, explicitly untrusted Aizen handoff messages.
- Added equal eight-conversation global/per-worker defaults, atomic over-capacity batch rejection, unique same-worker activity widgets, `/worker status`, and scoped `/worker cancel <id>`.
- Focused validation currently passes: 61 tests across seven worker, memory, and Shiori files; full `npm run check` passed before the final cancellation/UI refinements and will be rerun at the phase boundary.
- A Levi dogfood audit could not start because the currently installed `c1fd1121` runtime still has the old MSYS workspace bug (`lstat 'C:\\c'`). The source fix is in `c6b4dd13`; no automatic retry or fallback audit was performed.
- Committed and pushed first-class Shiori and independent slash handoffs at `fbe4f5a2`.

## 2026-07-26 — Live footer and worker installation

- Confirmed from the active session JSONL that compaction succeeded while the footer reverted from `ctx ?` to stale pre-compaction `ctx 187k 50.2%`.
- Identified the mismatch: cumulative footer statistics read live session entries, but context estimation read AgentHarness state synchronized only at the outer turn boundary.
- Changed context estimation to use the live compaction-aware session branch after every persisted model/tool-loop step.
- Colored `R`, `W`, and `CH` cache statistics with the token/context accent color.
- Added regressions for immediate post-compaction unknown state, live post-compaction usage before outer-turn synchronization, and cache-stat colors.
- Committed and pushed the footer fix at `88ba9b4a`.
- Focused footer/compaction validation passed: 36 tests with 2 skipped; full `npm run check` and commit hooks passed.
- Packed and isolated-smoke-tested `0.81.4-repi.2.dev.14.88ba9b4a`; version, help, model listing, metadata, worker files, and all four custom runtime trees passed.
- Installed the package globally as a normal non-symlink npm package and verified `recode --version` plus Coding Agent, AI, Agent, and TUI tree parity.
- Artifact SHA-256: `c72252625f1a67349e1d2f9432540216a41bc0a8bfa4feaaa8a0c8d12b9b74f4`.
- npm could not remove one temporary old-package directory because the running Recode process holds the native clipboard module open. The active package installed successfully; the stale process must be restarted before testing and the temporary directory can be retired afterward.

## 2026-07-26 — Worker hardening and modal-session boundary

- Normalized worker Git paths and installed `0.81.4-repi.2.dev.16.89e8dc30` (SHA-256 `c6f8df3836f042ac07c85438443c95c71cc03f0d47402af09b1fb7a6c252a0e2`).
- Hardened shared capacity accounting, atomic batch preflight, one-shot cancellation, Shiori settings-listener cleanup, foreign update-notice suppression, and compact Levi/Mayuri activity text in committed tip `84a9fbdc`.
- Replaced worker private-chat root-session creation with the existing custom modal UI.
- Removed private-chat session renaming and Aizen abort-signal inheritance while preserving independent worker conversation ids, custom-entry restoration, scoped cancellation, and runtime-teardown cleanup.
- Clarified that `/shiori` opens private chat and `/shiori review` performs current-session memory review.
- Focused modal/memory validation passed: 23 tests across two files. Full `npm run check` passed.
- Inspected the existing orchestrator: it already owns multiple RPC child processes, persisted instance metadata, event streams, UI request routing, independent stop lifecycle, and spawn/list/status/stop/RPC protocols.
- Reviewed Codex, Claude Code, and Hermes Agent architecture. Added a minimal plan to harden the existing supervisor with attach/detach, bounded cancellation, atomic manifests, safe completion delivery, and optional worktree isolation rather than introducing another framework.
- Hermes evidence was reviewed at `NousResearch/hermes-agent` commit `339d968689a3b91c5f537d7198ff28abde32ab3b`; selected patterns are bounded async delegation, completion queues, cooperative cancellation, schema/prompt caching, conservative safe-tool parallelism, and optional worktrees.
- Committed and pushed the modal boundary and structural plan at `053dee25`.
- Packed and isolated-smoke-tested `0.81.4-repi.2.dev.18.053dee25`; version, help, model listing, source metadata, and packaged worker runtime parity passed.
- Installed the package globally and verified version, source commit, and built worker runtime parity.
- Artifact SHA-256: `a4fcf6fb980150f1164a5fd53b4bc8d4757af32f6041c46c848e4e00806c8b38`.
- npm left another locked old-package directory because this running process still holds the clipboard native module; installation itself succeeded.

## 2026-07-27 — Kioku retrieval audit

- Confirmed automatic recall arrives at the correct `before_agent_start` boundary but retrieved irrelevant memory for generic continuation prompts.
- Identified four causes: raw-prompt OR FTS, no automatic acceptance threshold, overlapping multi-fact chunks, and global-only recall caused by resuming the legacy OAuth-worktree session with no project memory.
- Found stale global facts claiming the package is still symlinked and that self-update can still replace Recode; no memory was silently deleted or rewritten.
- Changed canonical list memory chunking to one durable entry per chunk while retaining bounded overlapping chunks for prose documents.
- Added an index-version hash so existing documents rebuild under the new chunker after restart.
- Added conservative local automatic reranking: conversational stop-word removal, minimum term coverage, project preference, and a three-entry cap. Explicit search remains broad.
- Focused memory validation passed: 15 tests.
- Committed and pushed the retrieval fix at `48459331`.
- Packed and isolated-smoke-tested `0.81.4-repi.2.dev.21.48459331`; version, help, model listing, and packaged memory-runtime parity passed.
- Installed globally and verified source metadata plus built memory-runtime parity.
- Artifact SHA-256: `9e7a96aa0c1875acfb38a54aa28cb71707a42fbfdab3df3684c1a61f9d31b997`.

## 2026-07-27 — Durable operations and release direction

- Confirmed restart from the authoritative `re.pi` checkout: project Kioku now resolves to this repository and the entry-based reindex expanded indexed chunks from 35 to 61.
- With Creator approval, removed or replaced stale global symlink, unsafe-update, transient MCP 401, and obsolete integration-branch memories.
- Created concise project memories for checkout authority, update safety, modal-worker/orchestrator architecture, and cross-platform deployment.
- Added root `OPERATIONS.md` and linked it from `AGENTS.md` so future sessions have a single safety, packaging, architecture, memory, and deployment entry point.
- Recorded the accepted goal of one certified artifact set for npm/Node, Windows, Linux, Termux, the primary machine, work PC, and VPS.
- Audited existing release foundations. Binary and Termux builders plus checksummed GitHub release staging already exist; npm trusted publishing described in `AGENTS.md` is absent from the current workflow and remains a release blocker.
- Did not connect to or mutate the VPS. It remains a later explicitly authorized inventory and rollout phase.
- Strengthened automatic and explicit memory prompts so recalled content is treated as potentially stale evidence below current Creator instructions and verified state.
- Added shared read-only `kioku_search` to every worker through the directory's host-provided external-tool boundary; no write tool or Cardinal bypass was added.
- Changed delegation from environment opt-in to default-on with explicit `REPI_DELEGATION=0|false|no|off` opt-out, and added release certification coverage for that default.
- Focused memory and worker validation passed: 42 tests across three files; 14 additional AgentSession/runtime tests passed with 3 environment-gated skips.
- Committed shared worker memory/default delegation at `535afb7c` and durable operations/release documentation at `eae21614`.
- Packed and isolated-smoke-tested `0.81.4-repi.2.dev.24.eae21614`; version, help, model listing, source metadata, and compiled parity for delegation, worker directory, memory, modal chat, and updater guards passed.
- Installed the exact artifact globally and verified the same runtime parity.
- Artifact SHA-256: `913ddc4fc79955ef7a1b75c289724d196554966945217f3483ebd53ec8d8b077`.

## 2026-07-27 — Release certification and VPS rollout

- Creator paused structural supervisor work and explicitly authorized release-candidate construction plus VPS inventory/update.
- Confirmed clean pushed `repi/preserve-custom` commit `659d9fcd7ebc7dc963df79060e71a426c942d30d`, descended from `c5ab200b`.
- The first full local-release attempt passed `npm run check` but failed before tests because Windows `cmd.exe` cannot execute `./test.sh` directly.
- Corrected the cross-platform local-release runner to invoke `bash ./test.sh`; no release artifact from the failed attempt was accepted.
- A second full local-release attempt reached the complete suite and failed before packaging. Failures separated into current regressions plus Windows/environment assumptions.
- Fixed current regressions: service-based `noTools` no longer exposes default delegation tools, Aizen retry/queue continuations no longer recreate the session-control host on continuation `agent_start`, and stale Recode identity tests were updated.
- Focused validation passed: 101 tests across system prompt, Aizen runtime/profile, retry/queue, no-tools, memory, workers, and worker directory suites.
- Full `npm run check` passed after the fixes.
- Remaining unrestricted `test.sh` failures on this Windows host include symlink privilege, chmod/read-only semantics, path separators, timing, stale platform-specific expectations, and broader historical tests. They are not accepted as a green release gate, but they are now documented as separate release hardening work.
- Committed and pushed release-candidate fixes at `9e818840`.
- Packed, isolated-smoke-tested, and locally installed `0.81.4-repi.2.dev.27.9e818840` from source `9e818840f33478847e8cc5fb376b61f7fc5fd366`.
- Artifact SHA-256: `44773d6c6c72f4a32ee6eeed82fa779c285d5d122ac136c94bc64285f6c801fb`.
- VPS inventory found `vmi3286400` running Ubuntu Linux x64, Node `v20.20.2`, and `/usr/local/bin/recode -> /opt/repi/v0.81.4/recode` at version `0.81.4`.
- Transferred the exact certified tarball to the VPS and verified the same SHA-256 remotely.
- Installed private Node `v26.5.0` under `/opt/node-v26.5.0-linux-x64` after verifying Node's upstream SHA-256.
- Installed Recode under `/opt/recode/0.81.4-repi.2.dev.27.9e818840` without modifying `/root/.pi/agent` user data.
- Removed the old `/usr/local/bin/recode` symlink and replaced it with a regular wrapper file that executes the certified package through private Node 26.
- Verified VPS `recode --version`, `recode --help`, `recode --list-models`, package source metadata, private Node version, non-symlink command wrapper, and foreign-package update refusal.
- Preserved `/opt/repi/v0.81.4` and recorded the previous symlink target under `/opt/recode/rollback/recode-bin-before-0.81.4-repi.2.dev.27.9e818840.txt` for rollback.
- `/root/repi` was not present on the VPS.
