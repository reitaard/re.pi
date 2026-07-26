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
- Current package version: `0.81.4`
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

is a symlink to this checkout's `packages/coding-agent` directory. Therefore, the current command runs this source checkout's built `dist` files.

## Historical session context

- Session ID: `019f9cc2-c15d-7b26-8fdb-5865e17273ee`
- Session file: `C:\Users\re_Lax\.pi\agent\sessions\--C--Users-re_Lax-Desktop-chat7-re.pi-0.81.4-oauth--\2026-07-26T04-50-37-021Z_019f9cc2-c15d-7b26-8fdb-5865e17273ee.jsonl`

## Release strategy

The custom-first line starts from the exact currently installed source `c5ab200b`, which contains the AgentHarness, durable teach/session, memory, UI, and OpenAI OAuth work. Upstream Pi is analyzed from exact common baseline `1f9e846c`; raw upstream changes are reported but never automatically merged.

The earlier published `@reitaard/repi-coding-agent@0.82.1-repi.1` is quarantined because it does not preserve full custom UI/runtime parity.

## Existing self-update behavior

Relevant implementation:

- `packages/coding-agent/src/package-manager-cli.ts`
- `packages/coding-agent/src/config.ts`
- `packages/coding-agent/src/utils/version-check.ts`
- `packages/coding-agent/src/utils/windows-self-update.ts`

Current behavior:

1. Query `https://pi.dev/api/latest-version`.
2. Use the returned package name and version.
3. Detect the global package manager.
4. Uninstall the current package when the returned package name differs.
5. Install the returned published package globally.

At investigation time, the endpoint returned upstream package `@earendil-works/pi-coding-agent` version `0.82.1`. That package exposes the `pi` binary rather than `recode`.

Consequently, running the current `recode update` is not a source-checkout update. It risks replacing the linked fork package and removing the `recode` command while leaving this repository unchanged.

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
