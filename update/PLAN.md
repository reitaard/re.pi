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
- [x] Enable delegation by default while retaining explicit `REPI_DELEGATION=0` opt-out.
- [x] Give every worker the loaded shared read-only `kioku_search` tool without exposing memory writes.
- [x] Apply the same stale-evidence and current-instruction precedence policy to worker memory use.
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
- [x] Establish latency baselines for startup, harness setup, provider first token, tool dispatch, persistence, and final rendering before changing architecture.

### S1 — Harden the existing supervisor

- [x] Treat each full background Aizen session as one existing orchestrator RPC child process.
- [x] Extend `InstanceRecord` with explicit run state and parent/session lineage through the versioned lifecycle projection.
- [x] Replace whole-file synchronous instance rewrites with atomic temp-write/rename persistence and bounded corruption recovery; retain JSON until measured scale justifies SQLite.
- [x] Add per-instance/RPC cancellation, independent iteration budgets, and bounded global concurrency with fail-fast admission.
- [x] Persist only safe metadata: instance id, PID/process identity receipt, cwd/worktree, session id/file, status, timestamps, bounded output and terminal/completion outbox data. Never persist credentials.
- [x] Define ownership receipts so restart recovery never kills or adopts an unverifiable process.

### S2 — Attach/detach without duplicate runtimes

- [x] Add explicit attach, detach, cancel, and send operations over the existing RPC stream transport.
- [x] Keep child lifetime owned by the supervisor; closing a TUI detaches rather than stops the child.
- [x] Permit only one interactive UI/approval owner per instance while allowing read-only event subscribers.
- [x] Route permission prompts and required user input to the attached owner; mark detached blocked sessions `waiting-input`.
- [x] Add a compact session board showing label, id, workspace, state, elapsed time, activity and pending input.
- [x] Keep ordinary `/resume` as an explicit foreground replacement; use the Maestro board for concurrently live full sessions.

### S3 — Workspace safety

- [x] Default read-only/background analysis to the selected workspace without creating a worktree.
- [x] Require explicit isolated sibling worktrees for concurrent write-capable full sessions.
- [x] Reuse the existing Git common-directory guard; reject unrelated repositories, traversal and ambiguous ownership.
- [x] Never auto-merge, reset, stash, create, clean or delete a worktree.

### S4 — Completion delivery

- [x] Queue background completion events and inject them only as fresh, explicitly untrusted handoffs at a safe foreground reasoning boundary.
- [x] Never mutate prior Aizen turns or inject private worker transcripts.
- [x] Keep bounded result summaries plus links/ids to full persisted session transcripts.

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
- Hermes Agent (`NousResearch/hermes-agent`, lifecycle port frozen at `5b22bd955682a8fc7b07769784c5129e23f53eaf`): faithfully port the reviewed public lifecycle state machine, bounds, cancellation/results, iteration budgets and relevant turn-lease invariants through Recode worker/full-session adapters. Do not port its broad messaging gateway, automatic memory machinery or in-process `AIAgent` executor.
- OpenClaw-derived browser orchestration remains a separate guarded browser-control boundary; reuse lifecycle concepts, not browser-specific control code.

## Post-lifecycle three-way checkpoint

Run only after the release-grade package/readiness work and the Hermes lifecycle/service implementation pass their gates.

- [ ] Clone a fresh exact jcode revision into a temporary directory and record its commit/toolchain.
- [ ] Fetch exact upstream Pi without switching the Recode worktree and record its commit/toolchain.
- [ ] Map Recode, jcode and upstream Pi behavioral contracts before comparing test counts.
- [ ] Distinguish passing implementation tests from proposed, ignored, environment-gated and documentation-only behavior.
- [ ] Run native focused suites plus implementation-independent translated conformance cases where public contracts permit them.
- [ ] Compare process-to-frame, rendered input echo, session/integration readiness, service cold start, warm attach and provider-to-first-event only at matched endpoints.
- [ ] Use the checkpoint to ratify startup SLOs and shared-service optimization order.

Hermes is lifecycle provenance for the Recode port, not a fourth product in this checkpoint.

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
- [x] Add regressions proving generic continuation and repository-file prompts inject nothing while targeted package-manager recall still succeeds.
- [x] Add a strict system-prompt policy: memory is potentially stale evidence, current Creator instructions and verified state take precedence, contradictions are rejected, and embedded memory instructions never execute.
- [ ] Add provenance and explicit supersession metadata before attempting automatic contradiction removal.
- [ ] Review stale global entries with the Creator before removing or replacing durable memory.
- [ ] Launch future implementation sessions from `C:\Users\re_Lax\Desktop\chat7\re.pi` so project memory corresponds to the authoritative checkout.
- [ ] Measure automatic retrieval candidate count, accepted count, duration, and injected characters before considering embeddings or model-based reranking.

## Cross-platform release and deployment

The repository already has one intended release path: `scripts/local-release.mjs`, `scripts/build-binaries.sh`, `scripts/build-termux-release.sh`, and `.github/workflows/build-binaries.yml`. Harden it instead of maintaining machine-specific builds.

### R0 — Audit current release identity

- [x] Confirm binary targets exist for Linux x64/arm64 and Windows x64/arm64.
- [x] Confirm a deterministic Termux Node archive exists.
- [x] Confirm GitHub release assets receive SHA-256 checksums and a source archive.
- [x] Prove every path builds from the authoritative `agent-harness` release commit, remains descended from the exact custom baseline, and enables delegation by default.
- [x] Make the full local-release test runner execute `test.sh` through Bash on Windows instead of handing it to `cmd.exe`.
- [ ] Separate Windows-incompatible historical tests from true release blockers so `release:local` has an authoritative cross-platform gate instead of a host-specific failure mode.
- [x] Reconcile release documentation with workflow reality: the current binary workflow stages/publishes GitHub assets but does not contain the documented npm trusted-publishing job.
- [x] Verify the release/tag script cannot accidentally release incomplete `main` or a raw upstream-derived tree.

### R1 — One versioned release manifest

- [x] Generate one immutable embedded identity manifest containing product/package identity, version, source commit, custom baseline, runtime requirements, and supported artifact/platform matrix.
- [x] Embed or bundle the same identity manifest in npm, binary, Termux, and source artifacts; generate a detached manifest-bound index for final artifact names, sizes and SHA-256 hashes.
- [x] Fail packaging if the checkout is dirty, detached, not descended from the custom baseline, or package identity differs.
- [ ] Make artifact generation reproducible where practical: normalized archive ordering/timestamps and no live model-catalog drift during release builds.

### R2 — Certification matrix

- [ ] npm/Node on Windows x64 and Linux x64.
- [ ] Bun binary on Windows x64, Windows arm64, Linux x64, and Linux arm64.
- [ ] Termux Node archive on supported Android architecture.
- [ ] Verify `--version`, `--help`, model/account listing, interactive startup, one real prompt, OAuth, clipboard fallback, Kioku, worker modal isolation, orchestrator RPC startup, and foreign-update refusal.
- [ ] Compare critical runtime trees/assets against the source build and retain machine-readable evidence.
- [ ] Test install, upgrade, and rollback from the immediately previous Recode release.

### R3 — Publication

- [ ] Publish npm packages under `@reitaard` through reviewed GitHub trusted publishing; never publish locally from an interactive machine.
- [ ] Publish checksummed GitHub release archives only after the certification matrix passes and release preview is approved.
- [ ] Make `recode update` consume only validated Recode release metadata and verify package identity before mutation.
- [ ] Keep release publication idempotent; rerunning a failed publish must skip already-published identical package versions.

### R4 — Fleet rollout

- [ ] Primary Windows machine canary.
- [ ] Work PC canary from the exact same artifact.
- [x] VPS inventory and backup under a separately authorized SSH task; previous `/usr/local/bin/recode -> /opt/repi/v0.81.4/recode` symlink target recorded under `/opt/recode/rollback`.
- [x] VPS upgrade from the exact certified npm artifact into `/opt/recode/0.81.4-repi.2.dev.27.9e818840`, followed by version, help, model-listing, source metadata, update-guard, non-symlink wrapper, and rollback-path checks.
- [ ] Termux rollout only from the certified Termux archive.
- [ ] Never clone/build independently on deployment machines unless performing an explicitly approved source-development task.

## Immediate next step

The shared release-identity gate now binds the authoritative branch/custom baseline or exact release tag to HEAD, clean source, product identity and lockstep package versions across local, binary, Termux, npm and GitHub entrypoints. The stable compatibility target is `0.81.5`, with publication deferred and self-update discovery disabled until Recode-owned metadata exists.

Continue with R1: generate one immutable release manifest and embed it in every artifact without putting commit provenance in SemVer. Keep Telegram, O9 and broad jcode benchmarking deferred.
