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
- [ ] Register Shiori as a first-class direct-chat worker while retaining her isolated reviewer.
- [ ] Make slash worker tasks bypass Aizen execution and hand results to Aizen at the next safe runtime boundary.
- [ ] Keep dedicated worker chats private and preserve Teach Mode.
- [ ] Remove Shiori review's idle wait while retaining one process-wide review lock.
- [ ] Apply one global eight-conversation default equally to Levi, Mayuri, and Shiori; retain one active Shiori review.
- [ ] Add behavior, concurrency, cancellation, handoff, and session-restoration tests.
- [ ] Build, pack, smoke-test, and install only after review.

### Worker dogfood notes

- Three Levi audits overlapped successfully, reducing approximately 896 seconds of combined runtime to 375 seconds wall time.
- Individual audit latency of 214–375 seconds is too high for narrow code reviews.
- Audit evidence was useful but missed one current tool and one existing concurrency test; prompt scope and evidence verification need tightening.
- Alternate-worktree audit startup exposed an MSYS Windows path-conversion defect before model execution.
- Later optimization should measure scheduling, harness setup, skill loading, provider start, and first useful output separately.

## Immediate next step

Commit the behavior-preserving worker-folder boundary, then add Shiori's direct-chat identity and independent slash-worker handoff behavior in separately tested changes.
