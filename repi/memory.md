# Kioku durable memory

Kioku (`記憶`) is RePi's local durable-memory foundation. Markdown remains the source of truth; a SQLite FTS5 index provides fast bounded recall.

## Locations

- Global Markdown: `~/.pi/agent/memory/`
- Project Markdown: `<launch-cwd>/.pi/memory/`
- Search index: `~/.pi/agent/recode-memory.sqlite`
- Settings: `~/.pi/agent/recode-memory.json`

The existing file and database names are intentionally preserved for compatibility with earlier RePi builds. The index is disposable and can always be rebuilt from Markdown.

## Safety defaults

- Project memory is the default scope.
- A project must be trusted before Kioku tools or automatic recall can use it.
- Global access is disabled by default.
- Global automatic recall is controlled separately from global manual access.
- Global writes require at least one searchable tag.
- Obvious credential and private-key patterns are rejected.
- Reads and writes are constrained to the selected memory root, including symlink resolution.
- `desk/` and `archive/` are excluded from indexing so later review workflows cannot leak pending items into recall.

## Automatic recall

Before an agent run, Kioku searches the enabled scopes using the new prompt. Relevant chunks are inserted as a hidden context message with source paths and line ranges. The default limits are six results and 6,000 injected characters.

## Commands

```text
/memory status
/memory search <query>
/memory reindex
/memory on|off
/memory recall on|off
/memory global on|off
/memory global-recall on|off
/memory scope project|global|both
```

## Agent tools

- `kioku_search`
- `kioku_write`
- `kioku_read`
- `kioku_status`

This layer intentionally excludes Shiori review, Cardinal admission, Aizen, and Teach Mode. Those are downstream layers built on top of the tested Kioku storage/runtime contract.
