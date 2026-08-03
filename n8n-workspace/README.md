# Recode n8n Workspace

Dedicated project directory for designing, validating, and explicitly deploying n8n workflows through Recode and the installed community `n8n-mcp` server.

## Layout

- `workflows/drafts/` — proposed workflow JSON
- `workflows/validated/` — workflows that passed MCP validation
- `workflows/published/` — explicitly approved published artifacts
- `templates/` — reviewed templates and attribution notes
- `notes/` — design notes and test records
- `skills/` — reviewed n8n guidance
- `instructions/` — workspace operating rules
- `.mcp.json` — committed MCP configuration for the community server; it reads `N8N_API_KEY` from the environment
- `.mcp.example.json` — credential-free configuration template
- `node_modules/n8n-mcp/` — pinned standalone community server

## Setup

Set `N8N_API_KEY` in the Recode process environment. The n8n URL is configured directly because it is not secret; the API key is never stored in this workspace.

Start new Recode sessions from this directory when the task is n8n-only. All workflow artifacts should remain inside this directory.

## Rebuilding the local template catalog

The community server's template catalog is stored in the ignored `node_modules/n8n-mcp/data/nodes.db` database and is not transferred by Git. On a new machine, use the tested Node 22.16.0 runtime, install dependencies with scripts disabled, then refresh the catalog:

```text
npm install --ignore-scripts
npm rebuild better-sqlite3
cd node_modules/n8n-mcp
node dist/scripts/fetch-templates-robust.js
```

The refresh command downloads the current template list and details. Do not commit `node_modules`, the database, API keys, or other generated credential data.
