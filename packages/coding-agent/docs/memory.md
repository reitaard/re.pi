# Durable memory

re.pi includes a local durable-memory layer. Markdown remains the source of truth; a SQLite FTS5 index makes recall fast without hiding your data in a proprietary format.

## Memory locations

- Global memory: `~/.pi/agent/memory/`
- Project memory: `<project>/.pi/memory/`
- Search index: `~/.pi/agent/recode-memory.sqlite`
- Settings: `~/.pi/agent/recode-memory.json`

`MEMORY.md` is created on the first write to a scope, so merely opening re.pi does not dirty a project. Daily notes are stored under `daily/YYYY-MM-DD.md`. Any Markdown file placed below either root is indexed automatically.

## Scope, trust, and recall

Project memory is the default. It is available only when the current project is trusted. Global memory is disabled by default and has two independent controls:

- Global access allows explicit `memory_search`, `memory_read`, and `memory_write` operations.
- Global auto-recall allows relevant global results to be injected before an agent turn.

Enabling global auto-recall also enables global access. Disabling global access disables global auto-recall. This keeps global memory callable on demand without requiring it in every prompt.

Before an agent run, re.pi searches the scopes whose auto-recall controls are enabled. Up to six relevant chunks are injected as a hidden context message with source paths and line ranges. This does not rewrite the system prompt and therefore does not destabilize its prompt-cache prefix.

Automatic recall is bounded to 6,000 characters by default. Project and global auto-recall can be changed independently without deleting memory:

```text
/memory auto off
/memory global-auto off
```

## Commands

```text
/memory                         Open interactive memory settings
/memory status                  Show roots and index counts
/memory search <query>          Search memory
/memory reindex                 Refresh changed Markdown files
/memory on                      Enable the memory subsystem
/memory off                     Disable the memory subsystem
/memory auto on|off             Toggle project auto-recall
/memory global on|off           Toggle explicit global access
/memory global-auto on|off      Toggle automatic global injection
/memory cardinal auto           Route project knowledge and global preferences automatically
/memory cardinal project        Route every Shiori memory to this project
/memory cardinal global         Route every Shiori memory to global memory
/memory cardinal ask            Ask where to save each Shiori memory
/memory shiori model current    Use the active RePi model for Shiori
/memory shiori model <id>       Use an available model from the current provider
/memory shiori thinking on|off  Control reasoning for Shiori only
/memory scope global            Search global memory only
/memory scope project           Search project memory only
/memory scope both              Search both scopes
```

Selecting a global search scope does not bypass the global-access setting.

## Shiori, Cardinal, and Kioku

`/shiori` manually starts `Shiori (栞)`, RePi's focused session-memory reviewer. She combines the RePi process's local time with one of her short memory greetings, then reads only session entries after her latest session checkpoint and uses an isolated, tool-free `AgentHarness` call. The same local timestamp is included in the review prompt. She never inherits the coding prompt, coding tools, or the live coding-agent context. Shiori uses the current model by default, but `/memory` can select another available model from the current provider and independently turn Shiori thinking on or off.

For an LM Studio `/v1` provider, Shiori uses LM Studio's native chat endpoint so `reasoning: "off"` is enforced per request without disabling thinking for normal RePi coding. Non-thinking Shiori reviews are capped at 1,024 output tokens. Other providers retain the portable AgentHarness path and request-local JSON schema.

While Shiori works, her complete greeting renders directly on the terminal background with an animated star and a moving green-lime shimmer. It settles into durable UI-only greeting and compact completion entries when the review finishes; those entries never enter future LLM context.

Long sessions are divided into bounded chunks. One invocation processes at most four chunks and reports when another `/shiori` call is needed. The checkpoint advances only after a successful review, so an error or cancelled routing decision does not silently lose unreviewed history.

Only one Shiori review can run per session. Repeated `/shiori` submissions while a review is active are ignored without starting additional model calls. Failed reviews release the lock and can be retried.

Cardinal is deterministic code, not another model. It applies the configured routing policy, normalizes tags, rejects duplicates, writes approved entries to Markdown, and asks `Kioku (記憶)` to reconcile its SQLite index once after the batch. `Kioku (記憶)` remains the existing Markdown plus FTS5/BM25 memory layer.

Automatic routing uses project memory for repository-specific decisions and global memory for stable cross-project user preferences. When a candidate requires global memory but global access is disabled, the TUI asks for an allowed destination; non-interactive use safely falls back to project memory.

## Agent tools

- `memory_search` searches durable memory.
- `memory_write` appends a concise entry to `MEMORY.md` or today's daily note. Global writes require at least one searchable tag, such as `#preference [[package-manager]]`.
- `memory_read` reads a relative Markdown file inside a memory root.
- `memory_status` reports configuration and index state.

`memory_write` rejects common private-key and credential patterns. It never writes outside the selected memory root.

## Index reconciliation

Recall reads directly from SQLite and does not scan Markdown on every turn. Successful memory writes update the index immediately. External Markdown edits are detected by recursive filesystem watchers, debounced, and reconciled in the background. A periodic full reconciliation remains as a fallback for missed or unsupported watcher events.

The current reconciler hashes every Markdown file before replacing changed documents. A future dirty-file queue may reduce filesystem work for very large memory directories, but it is not required for normal personal-memory sizes.

## Configuration compatibility

Older `recode-memory.json` files may contain `globalRecall`. On load, re.pi maps that legacy switch to both `globalAccess` and `globalAutoRecall`, preserving its previous behavior. The next settings change writes the new independent fields.

## Current scope

Version 0.81.2 is the focused coding-agent implementation: incremental Markdown indexing, FTS5/BM25 retrieval, bounded automatic recall, explicit global/project scope, and safe agent tools. It intentionally remains an extension plus dedicated storage/index modules until the first real `AgentHarness` migration establishes the reusable service contract. Embeddings, graph promotion/dreaming, multimodal indexing, and session-history import are deferred until the core has real usage data.
