# Update Decisions

This file records accepted architectural decisions. Proposed ideas remain in `PLAN.md` until accepted.

## D-001 — Recode identity must be preserved

**Status:** Accepted

The updater must treat this customized Recode repository and `@reitaard/repi-coding-agent` as the installed product. It must not silently replace Recode with `@earendil-works/pi-coding-agent` or rename the command from `recode` to `pi`.

**Reason:** The repository has intentionally diverged from upstream and contains Recode-specific runtime, extensions, branding, and workflows.

## D-002 — Upstream is an integration source

**Status:** Accepted

`https://github.com/earendil-works/pi.git` is an upstream source of changes, not automatically the release authority for the customized product.

**Reason:** Upstream version availability does not establish compatibility with Recode customizations.

## D-003 — Credentials remain outside repository files

**Status:** Accepted

GitHub MCP authentication uses the `GITHUB_PAT_TOKEN` environment variable. Tokens must not be written to `.mcp.json`, update documentation, logs, source files, or commits.

## D-004 — Linked checkout updates require a distinct strategy

**Status:** Accepted

A globally linked source checkout must not use the published-package uninstall/install path. Installation classification must occur before mutation.

**Reason:** Reinstalling a global package replaces the link but does not update the source checkout.

## D-005 — Canonical release branch and fork tags

**Status:** Superseded by D-008

`repi/canonical` was the initial release line, but visual and source audits proved that its 0.82 port omitted custom UI and runtime functionality. It remains available for reference and recovery.

## D-006 — Source updates fail closed

**Status:** Accepted

Source-linked updates require a clean branch and a fast-forward relationship to the selected RePi release tag. Dirty, detached, and diverged checkouts are refused. The updater never stashes, resets, rebases, or resolves conflicts automatically.

## D-007 — Three-way upstream planning

**Status:** Accepted

Upstream analysis compares the recorded Pi baseline tree with both the committed Recode tree and a target upstream revision. `recode upstream status|plan` classifies custom-only, upstream-only, identical, protected, overlapping, and renamed paths without modifying source files. Pure Recode paths are declared in `repi/upstream-ownership.json`; shared paths are never silently excluded from compatibility review.

## D-008 — Feature-complete custom tree is authoritative

**Status:** Accepted

The release line starts from exact commit `c5ab200b`. Upstream Pi changes are classified from common baseline `1f9e846c` and reported without source mutation. No custom path is replaced merely to claim a newer upstream version. A normal npm package may replace the development symlink only after isolated and visual parity tests.

## D-009 — Worker private chats are modal, not root sessions

**Status:** Accepted

Levi, Mayuri, and Shiori private chats run as modal, independently cancellable worker conversations inside the current Aizen runtime. They keep their own conversation ids and custom-entry history but never call root-session replacement or rename the Aizen session. One-shot tasks remain independent and deliver explicitly untrusted handoffs. Delegation is enabled by default with an explicit environment opt-out. All workers share read-only Kioku search under the stale-evidence policy; memory admission remains unavailable to worker tools.

## D-010 — Extend the existing orchestrator for full-session concurrency

**Status:** Accepted

Multiple full Aizen sessions will use `packages/orchestrator` as the single supervisor foundation. Each background session is an isolated RPC child process with attach/detach, bounded admission, scoped cancellation, persisted ownership metadata, and optional verified worktree isolation. Named workers remain lightweight and do not become processes by default.

## D-011 — Optimize from measurements and reuse existing boundaries

**Status:** Accepted

Latency work starts with stage-level measurements. Prefer schema/prompt caching, lazy loading, event-driven waits, and conservative parallel read-only tools. Do not add SQLite, deep delegation, multi-platform gateways, or automatic background review until measurements establish need.

## D-012 — One certified release serves every deployment

**Status:** Accepted

Windows, Linux, Termux, the primary machine, work PC, and VPS must consume artifacts from one reviewed source commit and release manifest. Extend the existing local-release, binary, Termux, and GitHub workflow; do not clone and rebuild independently on each deployment machine. Remote rollout occurs only after local certification and explicit authorization, with inventory and rollback evidence.

## D-013 — Port Hermes lifecycle contracts through Recode adapters

**Status:** Accepted

Freeze Hermes Agent at exact reviewed commit `5b22bd955682a8fc7b07769784c5129e23f53eaf` and faithfully translate its public lifecycle state machine, bounds, cancellation/result semantics, iteration-budget behavior and relevant turn-lease invariants. Preserve required MIT attribution. Bind the port through separate adapters for existing named workers and full orchestrator-owned RPC sessions rather than replacing either Recode implementation with Hermes’s in-process `AIAgent` executor.

**Reason:** Hermes provides the preferred tested lifecycle contract, while Recode requires durable process identity, restart verification and attach/detach behavior that Hermes’s in-process executor does not provide.

## D-014 — Ratify gaps and SLOs only after an exact three-way checkpoint

**Status:** Accepted

After the S2–S3 package/readiness work and O0–O8 Hermes lifecycle/service checkpoint, clone a fresh exact jcode revision and fetch an exact upstream Pi revision. Compare Recode, jcode and upstream Pi through mapped behavioral contracts, native/translated tests and matched lifecycle performance probes. Hermes remains lifecycle provenance, not a fourth product score. Raw test counts and unlike startup endpoints are not accepted as comparative evidence.

**Reason:** Final performance targets and service optimization order should follow executable evidence from exact implementations, not README claims, moving branches or language-level assumptions.

## D-015 — RePi Browser is a required first-party package

**Status:** Accepted

Include `repi-browser` in certified Recode package sets and the later Recode/jcode/upstream-Pi checkpoint even while its source package remains private. Use it as the first controlled S2 built-artifact/runtime-contract migration. Private status must not silently remove browser capability. Public redistribution remains blocked until explicit license/distribution terms replace the current `UNLICENSED` package state.

**Reason:** Browser control is an intentional Recode product capability and the largest controlled extension graph. Excluding it would produce misleading startup and feature comparisons.

## Pending decisions

- Whether a later `recode upstream prepare` command should create an isolated integration worktree
- Dependency-refresh policy
- Final development symlink repoint procedure
