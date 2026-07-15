# Durable memory

re.pi includes a local durable-memory layer. Markdown remains the source of truth; a SQLite FTS5 index makes recall fast without hiding your data in a proprietary format.

## Memory locations

- Global memory: `~/.pi/agent/memory/`
- Project memory: `<project>/.pi/memory/`
- Search index: `~/.pi/agent/recode-memory.sqlite`
- Settings: `~/.pi/agent/recode-memory.json`

`MEMORY.md` is created on the first write to a scope, so merely opening re.pi does not dirty a project. Daily notes are stored under `daily/YYYY-MM-DD.md`. Any Markdown file placed below either root is indexed automatically.

## Automatic recall

Before an agent run, re.pi searches enabled memory scopes using the new prompt. Up to six relevant chunks are injected as a hidden context message with source paths and line ranges. This does not rewrite the system prompt and therefore does not destabilize its prompt-cache prefix.

Automatic recall is bounded to 6,000 characters by default. It can be disabled without deleting memory:

```text
/memory off
```

## Commands

```text
/memory                         Show status
/memory status                  Show roots and index counts
/memory search <query>          Search memory
/memory reindex                 Refresh changed Markdown files
/memory on                      Enable memory and automatic recall
/memory off                     Disable memory and automatic recall
/memory scope global            Search global memory only
/memory scope project           Search project memory only
/memory scope both              Search both scopes
```

## Agent tools

- `memory_search` searches durable memory.
- `memory_write` appends a concise entry to `MEMORY.md` or today's daily note.
- `memory_read` reads a relative Markdown file inside a memory root.
- `memory_status` reports configuration and index state.

`memory_write` rejects common private-key and credential patterns. It never writes outside the selected memory root.

## Current scope

Version 0.81.2 is the focused core: incremental Markdown indexing, FTS5/BM25 retrieval, bounded automatic recall, explicit global/project scope, and safe agent tools. Embeddings, graph promotion/dreaming, multimodal indexing, and session-history import are intentionally deferred until the core has real usage data.
