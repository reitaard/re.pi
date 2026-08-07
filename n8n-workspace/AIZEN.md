# Aizen / Creator n8n Operating Guide

- VPS address: root@157.173.127.84

Portable instructions for working with the Creator on Recode + n8n. This file is operational guidance, not memory. Read it before starting a session.

## Working relationship

- Creator gives the goal and approves externally visible or destructive actions.
- Aizen inspects current state first, explains the intended mutation, executes one bounded change, tests it, restores temporary test wiring, and reports evidence.
- Keep replies concise and technical.
- Never store secrets, tokens, cookies, API keys, or credential values here. Use n8n credential names only.
- Use n8n MCP for n8n work. Never use browser automation.
- Do not guess workflow contracts when a reference workflow or node definition exists.
- Stage only reviewed `n8n-workspace/**` files for n8n changes. Never stage `packages/**` for an n8n task.

## Environment

- n8n/VPS public address: `https://n8.retakt.cc`
- Active workflow: `Spotipy Fast Mode`
- Active workflow ID: `HYRePy4buI9l4SEk`
- Spotify data sub-workflow: `Spotipy Music Data Tool v1` (`2nRzAS4MCCB8uKMw`)
- Credential names: `spotipy` (Telegram), `laxya` (Spotify), `vps-spotdl` (SSH), `LM studio` (model)
- Never place credential values in workflow JSON, notes, commands, or commits.

## MCP servers

- `n8n-official`: native workflow details, executions, updates, publishing, and validation.
- `n8n-community`: templates, node knowledge, and advanced management tools.
- Do not perform the same mutation through both servers.
- Read `instructions/n8n-mcp.md` before using MCP tools.

## Reusable MCP calls

```js
// Inspect a workflow before changing it.
mcp({
  server: "n8n-official",
  tool: "n8n_official_get_workflow_details",
  args: { workflowId: "HYRePy4buI9l4SEk" }
})

// Find recent executions.
mcp({
  server: "n8n-official",
  tool: "n8n_official_search_executions",
  args: { workflowId: "HYRePy4buI9l4SEk", limit: 20 }
})

// Inspect selected nodes from one execution.
mcp({
  server: "n8n-official",
  tool: "n8n_official_get_execution",
  args: {
    workflowId: "HYRePy4buI9l4SEk",
    executionId: "<id>",
    includeData: true,
    nodeNames: ["Parse Fast input", "Route Fast input", "AI Agent", "Send Chat reply"],
    truncateData: 5
  }
})

// Execute only workflows with Schedule, Webhook, Form, or Chat triggers.
mcp({
  server: "n8n-official",
  tool: "n8n_official_execute_workflow",
  args: {
    workflowId: "<workflow-id>",
    executionMode: "production",
    inputs: {
      type: "webhook",
      webhookData: {
        method: "POST",
        body: { "<input>": "<value>" }
      }
    }
  }
})

// Apply a small atomic change, then publish if production behavior changed.
mcp({
  server: "n8n-official",
  tool: "n8n_official_update_workflow",
  args: { workflowId: "<workflow-id>", operations: [/* addConnection, removeConnection, addNode, ... */] }
})
mcp({
  server: "n8n-official",
  tool: "n8n_official_publish_workflow",
  args: { workflowId: "<workflow-id>" }
})
```

## Webhook testing

Production Webhook nodes normally use:

```text
POST https://n8.retakt.cc/webhook/<node-path>
Content-Type: application/json
```

PowerShell example:

```powershell
$body = @{ update_id = 123; message = @{ message_id = 456; chat = @{ id = 5759927190; type = 'private' }; text = 'Tell me something about the song purple rain' } } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Post -Uri 'https://n8.retakt.cc/webhook/<node-path>' -ContentType 'application/json' -Body $body
```

Important:

- A standard Webhook node wraps the request under `$json.body`; add a temporary unwrap node or read `$json.body` explicitly.
- `execute_workflow` cannot directly invoke a Telegram Trigger.
- A Telegram Trigger webhook requires Telegram's generated secret header; a bare curl request returns `Provided secret is not valid`.
- For temporary Telegram testing: replace the trigger, add an unwrap node, test, remove every temporary node/connection, restore the Telegram Trigger and reply settings, publish, then verify the final graph.
- Telegram allows only one active Trigger per bot.

## Common node conventions

- Code nodes: use `runOnceForEachItem`; return one object for one item. Avoid arrays unless the node explicitly runs once for all items.
- Switch/IF wiring: use explicit `sourceIndex` and `true`/`false` branches; inspect connections after every change.
- Telegram reply: use the existing `spotipy` credential, `resource: "message"`, `operation: "sendMessage"`, HTML parse mode, and `reply_to_message_id: "={{ $json.messageId }}"` for real Telegram updates.
- SSH: use credential `vps-spotdl`; prefer `sudo -n`; pass complex structured data as base64 rather than unsafe raw shell JSON.
- Spotify lookup: reuse `Spotipy Music Data Tool v1` for read-only catalog evidence; do not duplicate Spotify contracts.
- Redis Chat admission/completion must always release locks on success, cancellation, and failure paths.

## Observed Recode + n8n behavior

- `update_workflow` batches are atomic; validation warnings can describe stale node-schema differences even when n8n runtime accepts the workflow.
- Publishing is required before a new production Webhook path is reachable.
- Static validation can report zero errors while a connection is still missing; verify live execution paths.
- Inspect `lastNodeExecuted`, node run data, Telegram message IDs, Redis cleanup, and VPS cleanup rather than trusting execution status alone.
- Keep temporary diagnostic nodes out of the final workflow and document real execution IDs.

## Session checklist

1. Read `AGENTS.md`, this file, and `instructions/n8n-mcp.md`.
2. Check Git status and preserve unrelated changes.
3. Inspect the active workflow and a reference workflow before designing.
4. State the intended change and get approval for production, Telegram, credential, activation, deletion, or publication actions.
5. Apply one bounded MCP mutation; publish only when required.
6. Test the smallest useful path and inspect the execution data.
7. Restore temporary wiring, verify the active trigger and connections, and update the relevant Markdown docs.
8. Run `git diff --check`; stage explicit paths only if the Creator asks for a commit.
