# Memory

- #recode [[authoritative-checkout]] [[workflow]] This repository on branch repi/preserve-custom is the authoritative Recode checkout. Use update/README.md, CONTEXT.md, PLAN.md, DECISIONS.md, and LOG.md as the compact operational source of truth; deprecated sibling worktrees are not implementation sources.

- #update [[release]] [[safety]] Recode updates fail closed: never replace @reitaard/repi-coding-agent with upstream Pi, never stash/reset/rebase user work, and never run raw recode update against an unverified source checkout. Build a clean committed tree, run focused tests and npm run check, pack with npm run recode:pack-custom-local, smoke-test the tarball, then install the exact artifact.

- #workers [[orchestrator]] [[architecture]] Named worker private chats are modal conversations inside the current Aizen session; they retain independent conversation ids and custom-entry history without creating, renaming, or cancelling the root session. Delegation is enabled by default with an explicit REPI_DELEGATION=0 opt-out, and every worker receives shared read-only Kioku search under the stale-evidence policy. Full concurrent Aizen sessions should extend packages/orchestrator rather than add another supervisor.

- #deployment [[cross-platform]] [[release]] The deployment goal is one reproducible Recode release artifact that installs on Windows, Linux, Termux, the VPS, and the work PC without cloning or rebuilding separately. The VPS is behind the current AgentHarness work and must be upgraded only after local release hardening, with explicit remote authorization and rollback verification.
