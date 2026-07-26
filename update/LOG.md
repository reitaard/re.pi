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
