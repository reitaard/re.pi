# Recode parity plan

## Source of truth

The product baseline is the exact working branch and commit:

```text
origin/oauth-test
b9b33fd62adfd46fb2dcc35a26afaea8fe3cab62
```

The upstream integration target is:

```text
origin/repi/integrate-v0.82.1
```

No RePi release is eligible for publication or update notification until the integration branch satisfies this document.

## Release quarantine

`0.82.1-repi.1` is an incomplete migration. It must not be advertised, installed by `recode update`, or used as a parity reference. The next eligible stable release must use a higher RePi revision.

## Required parity layers

### 1. Product shell

- Recode/re.pi naming and process title
- responsive `re™ CODE` welcome panel
- exact brand palette and wordmark
- dark/light theme behavior
- editor border and startup layout
- footer, status rows, context usage, model/provider and cwd
- working, thinking, retry and compaction indicators
- update notices that belong to the RePi release channel only

### 2. OpenAI OAuth subsystem

Repositories:

```text
reitaard/re.pi
reitaard/openai-oauth
```

The OAuth proxy is a managed Recode subsystem, not merely a hardcoded URL.

Required behavior:

- use the proxy's account-aware `/v1/models` discovery
- do not hardcode account model availability
- preserve the proxy's current Codex client metadata and bundled fallback behavior
- use the same local Codex auth source (`~/.codex/auth.json` unless overridden)
- preserve OAuth refresh and ChatGPT account identity
- expose proxy status, login, restart and model-refresh diagnostics
- classify `usage_limit_reached` as non-retryable
- show one useful error with plan and reset time instead of repeating the same 429
- keep normal transient 429 retry behavior
- keep `open-provider` available as an independent LM Studio provider
- verify Responses streaming, reasoning replay, tool calls and tool-call IDs

### 3. Agent harness

- harness journal
- durable session/runtime behavior
- compaction behavior
- prompt/resource loading
- subprocess and shell handling
- all existing harness regression tests

### 4. Orchestration and workers

- Aizen runtime
- delegation tool
- named worker registry, directory, settings and storage
- direct worker chat
- worker header/status colors and indicators
- workspace guards
- durable teach sessions and evaluation history

### 5. Memory and learning

- Kioku source-of-truth Markdown memory
- SQLite FTS index
- project/global isolation and permissions
- Cardinal
- Shiori desk, review and harness behavior
- Teach Mode
- creator messages

### 6. Gateway, browser and connectors

- Recode gateway and session control
- browser production runtime
- MCP adapter and configured MCP startup summary
- existing external extensions and package compatibility
- LSP lifecycle/status integration
- Telegram and remote-session behavior where present in the baseline

### 7. Packaging and update

- package contains the complete product layer
- Windows and Ubuntu Node 26.5 build/test/package/install gates
- proper global install, not a source symlink
- exact Git-derived version and provenance
- rollback-safe publication and tag flow
- update notice tested from an older complete Recode build
- `recode update` installs only a parity-approved RePi revision

## Final parity gate

Before publishing, capture and compare the following from both `oauth-test` and the candidate package:

1. startup screen at wide, stacked and compact terminal widths
2. `/model`, `/settings`, `/memory` and worker commands
3. footer/status output with OAuth, LM Studio, browser, MCP and Kioku active
4. one normal tool-calling turn
5. one worker delegation and direct-chat turn
6. one memory write/search/recall cycle
7. one OAuth usage-limit response proving it is emitted once with reset information
8. one update notification and successful `recode update`

A release is blocked if any visible product surface or required behavior is absent, renamed unintentionally, or replaced by raw upstream Pi behavior.
