# Recode Update Plan

## Goal

Make `recode update` update the customized Recode product safely instead of replacing it with an upstream published Pi package.

## Non-goals for the first implementation

- Fully automatic conflict resolution
- Destructive reset or cleanup of a working tree
- Automatic publication or release creation
- Silent migration from Recode to upstream Pi
- Updating extensions unless explicitly requested

## Phase 1 — Establish facts

- [x] Repair or explain the broken linked-worktree metadata.
- [x] Confirm the active branch, HEAD, remotes, tracking branches, and working-tree state.
- [x] Inspect the fork and upstream repository branches and releases through GitHub.
- [x] Determine how Recode customizations are organized relative to upstream.
- [x] Identify the exact build/relink mechanism currently used for the global `recode` command.
- [x] Inventory tests covering package update and self-update behavior.

**Gate:** No updater design proceeds until repository identity and working-tree safety can be determined reliably.

## Phase 2 — Define update policy

- [x] Decide which source is authoritative for Recode releases.
- [x] Decide whether updates consume fork releases, fork branches, upstream tags, or a combination.
- [x] Define behavior for clean, dirty, diverged, detached, and conflicted checkouts.
- [x] Define how upstream changes are integrated: prepared canonical release branch plus fast-forward clients.
- [x] Define rollback/checkpoint behavior: preserve the prior commit in error output; never reset automatically.
- [ ] Define interactive confirmation and `--force` semantics.

**Gate:** Record the selected policy in `DECISIONS.md` before implementation.

## Phase 3 — Separate update strategies

- [ ] Introduce an explicit installation/update classification:
  - published global package,
  - linked source checkout,
  - compiled binary,
  - unsupported/unknown installation.
- [x] Preserve package-manager self-update for genuine published installations.
- [x] Route linked Recode checkouts to a source-update strategy.
- [x] Ensure upstream package-name migration cannot occur silently.
- [x] Produce a read-only three-way upstream status/plan representation before mutation.

**Gate:** Tests prove that a linked checkout never invokes global uninstall/install.

## Phase 4 — Implement safe source update

Tentative flow, subject to Phase 2 decisions:

1. Resolve and validate checkout identity.
2. Refuse unsafe working-tree states unless the chosen policy explicitly handles them.
3. Fetch fork and upstream refs without changing files.
4. Calculate incoming commits and likely conflicts.
5. Present an update plan.
6. Create a recoverable checkpoint.
7. Apply the selected integration strategy.
8. Refresh dependencies only when metadata changed, using repository-safe install commands.
9. Run required validation.
10. Rebuild/relink the CLI using an explicit supported workflow.
11. Verify `recode --version` and startup.
12. Report rollback instructions.

## Phase 5 — TUI and command UX

- [ ] Update startup notification text so it names the actual update source and strategy.
- [ ] Update `recode update --help` and documentation.
- [ ] Distinguish core source updates from extension updates.
- [ ] Add clear states for update available, blocked, conflict predicted, validation failed, and complete.
- [ ] Ensure no message directs customized Recode users to install upstream Pi accidentally.

## Phase 6 — Verification

- [ ] Unit tests for installation classification and update-plan creation.
- [ ] Regression test for the current symlinked Windows layout.
- [ ] Tests proving dirty work is preserved.
- [ ] Tests proving upstream package-name changes do not replace Recode.
- [ ] Focused package tests.
- [ ] Full `npm run check`.
- [ ] Manual source-linked smoke test outside destructive paths.

## Phase 6 — Custom-first release

- [x] Anchor the release line at exact feature-complete commit `c5ab200b`.
- [x] Preserve the restored global checkout while integration proceeds elsewhere.
- [x] Add fail-closed Recode package identity checks.
- [x] Add read-only three-way upstream status/plan commands.
- [x] Add Git-derived staged package versioning without editing runtime custom files.
- [x] Build and test all customized workspace packages together.
- [x] Pack and smoke-test an isolated normal npm installation.
- [x] Verify all installed Coding Agent, TUI, Agent, and AI runtime trees byte-for-byte against the custom build.
- [ ] Obtain a final user visual confirmation after restart; automated pseudo-TTY startup is unavailable in the non-TTY tool host.

## Worker capability follow-up

- [x] Add one-call concurrent launch for two to eight independent conversations, including repeated Levi instances.
- [x] Add bounded read-only Git evidence for audit workers.
- [x] Allow explicit sibling worktrees only when they share the active Git common directory.
- [x] Keep Git mutations, unsafe execution/configuration flags, and workspace traversal blocked.
- [x] Preserve Mayuri's librarian skill and strengthen Levi's audit instructions around Git evidence.
- [x] Add focused concurrency, workspace-boundary, and Git fail-closed tests.

## Worker architecture and behavior

- [x] Restore per-worker batch activity and handoff rendering.
- [x] Move Levi, Mayuri, and Shiori-owned code under `core/workers/<name>` without behavior changes.
- [x] Keep generic conversation, delegation, cancellation, storage, and workspace guards under `core/delegation`.
- [x] Let worker definitions own their specialized tool factories instead of importing Levi from the generic runtime.
- [x] Accept native and MSYS-style Windows paths for sibling-worktree routing.
- [x] Register Shiori as a first-class direct-chat worker while retaining her isolated reviewer.
- [x] Make slash worker tasks bypass Aizen execution and hand results to Aizen at the next safe runtime boundary.
- [x] Keep dedicated worker chats private and preserve Teach Mode.
- [x] Remove Shiori review's idle wait while retaining one process-wide review lock.
- [x] Apply one global eight-conversation default equally to Levi, Mayuri, and Shiori; retain one active Shiori review.
- [x] Add behavior, concurrency, cancellation, handoff, and session-restoration tests.
- [x] Build, pack, smoke-test, and install only after review.
- [x] Keep private worker chats inside the current Aizen runtime as modal conversations.
- [x] Preserve independent worker conversation ids and custom-entry history without creating or renaming root sessions.
- [x] Decouple modal worker turns from Aizen's abort signal while retaining runtime-teardown cleanup.
- [x] Clarify `/shiori` versus `/shiori review` command text.
- [x] Pack, smoke-test, and install the modal boundary.
- [ ] Restart and visually verify the modal boundary.

### Worker dogfood notes

- Three Levi audits overlapped successfully, reducing approximately 896 seconds of combined runtime to 375 seconds wall time.
- Individual audit latency of 214–375 seconds is too high for narrow code reviews.
- Audit evidence was useful but missed one current tool and one existing concurrency test; prompt scope and evidence verification need tightening.
- Alternate-worktree audit startup exposed an MSYS Windows path-conversion defect before model execution.
- A post-refactor Levi audit launched from the still-installed `c1fd1121` runtime reproduced that old `C:\\c` failure; no automatic retry was made. Source commit `c6b4dd13` contains the tested fix, but it will not affect the tool host until the next reviewed installation.
- Later optimization should measure scheduling, harness setup, skill loading, provider start, and first useful output separately.

## Structural hardening — full Aizen session supervision

The existing `packages/orchestrator` is the foundation. Do not add a second orchestration framework.

### S0 — Preserve the simple foreground path

- [x] Keep one foreground Aizen runtime in the ordinary TUI.
- [x] Keep named workers as lightweight in-process conversations; do not turn every worker into an OS process.
- [ ] Establish latency baselines for startup, harness setup, provider first token, tool dispatch, persistence, and final rendering before changing architecture.

### S1 — Harden the existing supervisor

- [ ] Treat each full background Aizen session as one existing orchestrator RPC child process.
- [ ] Extend `InstanceRecord` with explicit run state (`idle`, `running`, `waiting-input`, `completed`, `cancelled`, `error`) and parent/session lineage.
- [ ] Replace whole-file synchronous instance rewrites with atomic temp-write/rename persistence and bounded corruption recovery; retain JSON until measured scale justifies SQLite.
- [ ] Add per-instance `AbortController`/RPC cancellation and bounded global concurrency with fail-fast admission.
- [ ] Persist only safe metadata: instance id, PID/process identity receipt, cwd/worktree, session id/file, status, timestamps, and bounded output tail. Never persist credentials.
- [ ] Define ownership receipts so restart recovery never kills or adopts an unverifiable process.

### S2 — Attach/detach without duplicate runtimes

- [ ] Add explicit `attach`, `detach`, `cancel`, and `send` protocol operations over the existing `rpc_stream` transport.
- [ ] Keep child lifetime owned by the supervisor; closing a TUI detaches rather than stops the child.
- [ ] Permit only one interactive UI/approval owner per instance while allowing read-only event subscribers.
- [ ] Route permission prompts and required user input to the attached owner; mark detached blocked sessions `waiting-input`.
- [ ] Add a compact session picker showing label, id, workspace, state, elapsed time, and pending input.
- [ ] Keep ordinary `/resume` as an explicit foreground replacement; use the supervisor picker for concurrently live full sessions.

### S3 — Workspace safety

- [ ] Default read-only/background analysis to the selected workspace without creating a worktree.
- [ ] Require explicit isolated sibling worktrees for concurrent write-capable full sessions.
- [ ] Reuse the existing Git common-directory guard; reject unrelated repositories, traversal, dirty destructive setup, and ambiguous ownership.
- [ ] Never auto-merge, reset, stash, or delete a worktree. Cleanup requires verified ownership and no uncommitted work.

### S4 — Completion delivery

- [ ] Queue background completion events and inject them only as fresh, explicitly untrusted handoffs at a safe foreground reasoning boundary.
- [ ] Never mutate prior Aizen turns or inject private worker transcripts.
- [ ] Keep bounded result summaries plus links/ids to full persisted session transcripts.

## Latency optimization order

Implement only after measurement identifies a material cost:

1. Cache immutable worker/tool schemas and stable system-prompt prefixes.
2. Reuse model/provider registries and parsed static configuration inside a process.
3. Avoid follow-up `get_state` calls except for commands that can change persisted identity; the orchestrator already follows this rule.
4. Parallelize only independent read-only or path-disjoint tool batches; preserve barriers around writes, prompts, approvals, and interactive tools.
5. Load expensive skills/tools lazily when the worker or command actually needs them.
6. Keep recent context and stable prompt prefixes cache-friendly; put volatile recall/handoff material afterward.
7. Prefer bounded queues, event-driven waits, and incremental output over polling.
8. Do not add SQLite, deep nested delegation, a multi-platform gateway, or automatic background memory review without measured need.

## External architecture evidence

- Codex: app-server agent threads and a picker are the model for inspectable subagent/modal navigation; switching primary sessions still replaces the primary runtime.
- Claude Code: a supervisor owning independent background session processes is the model for full attach/detach.
- Hermes Agent (`NousResearch/hermes-agent`, reviewed at `339d9686`): reuse bounded asynchronous delegation, independent cancellation, completion queues, cached tool schemas, conservative safe-tool parallelism, stable prompt caching, and optional worktrees. Do not copy its broad gateway, deep delegation, or automatic memory machinery.
- OpenClaw-derived browser orchestration remains a separate guarded browser-control boundary; reuse lifecycle concepts, not browser-specific control code.

## Memory retrieval hardening

### Observed defects

- Automatic recall runs at `before_agent_start`, so delivery timing is correct.
- It previously searched only the raw current prompt with an OR-based FTS query, accepted every returned match, and injected up to six results.
- `MEMORY.md` was split into overlapping character windows, causing repeated chunks containing unrelated facts.
- The resumed historical session's active project is the legacy OAuth worktree, which has no project memory; global auto-recall therefore dominates even though implementation work occurs in `re.pi`.
- Global memory contains stale symlink/update facts and lacks the latest installed-package, modal-worker, and supervisor decisions.

### Minimal correction

- [x] Chunk canonical bullet-based memory files by individual durable entry; retain bounded character chunks for general prose documents.
- [x] Version the chunking hash so existing indexed documents reindex automatically after restart.
- [x] Keep explicit search broad and unchanged.
- [x] For automatic recall, remove conversational stop words, retrieve a bounded candidate set, require one match for a single specific term or two matches for broader prompts, prefer project results, and inject at most three entries.
- [x] Add regressions proving a generic “continue” prompt injects nothing and targeted package-manager recall still succeeds.
- [ ] Add provenance and explicit supersession metadata before attempting automatic contradiction removal.
- [ ] Review stale global entries with the Creator before removing or replacing durable memory.
- [ ] Launch future implementation sessions from `C:\Users\re_Lax\Desktop\chat7\re.pi` so project memory corresponds to the authoritative checkout.
- [ ] Measure automatic retrieval candidate count, accepted count, duration, and injected characters before considering embeddings or model-based reranking.

## Immediate next step

Restart from the authoritative `re.pi` directory to activate conservative memory recall and rebuild the index. Separately visually confirm that `/levi`, `/mayuri`, and `/shiori` preserve the `chat1` root session while `/shiori review` remains isolated.
