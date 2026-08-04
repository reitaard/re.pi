# Recode n8n Workspace

Dedicated project directory for designing, validating, and explicitly deploying n8n workflows through Recode and both the official and community n8n MCP servers.

## Layout

- `workflows/drafts/` — proposed workflow JSON
- `workflows/validated/` — workflows that passed MCP validation
- `workflows/published/` — explicitly approved published artifacts
- `templates/` — reviewed templates and attribution notes
- `notes/` — design notes and test records
- `skills/` — reviewed n8n guidance
- `instructions/` — workspace operating rules
- `.mcp.json` — committed credential-free configuration for both MCP servers
- `.mcp.example.json` — portable configuration template
- `node_modules/n8n-mcp/` — pinned standalone community server used by `n8n-community`

## Setup

Set these variables in the Recode process environment:

- `N8N_MCP_TOKEN` — official instance-level MCP bearer token
- `N8N_API_URL` — n8n base URL, without `/api/v1`
- `N8N_API_KEY` — n8n API key for the community server's management tools

The values are never stored in this workspace.

Start new Recode sessions from this directory when the task is n8n-only. All workflow artifacts should remain inside this directory.

## Rebuilding the local template catalog

The community server's template catalog is stored in the ignored `node_modules/n8n-mcp/data/nodes.db` database and is not transferred by Git. On a new machine, install dependencies with scripts disabled, then refresh the catalog:

```text
npm install --ignore-scripts
npm rebuild better-sqlite3
cd node_modules/n8n-mcp
node dist/scripts/fetch-templates-robust.js
```

The refresh command downloads the current template list and details. Do not commit `node_modules`, the database, API keys, or other generated credential data.
