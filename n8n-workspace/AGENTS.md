# n8n Workspace Rules

This directory is the only approved save location for n8n work produced in this session.

## Storage

- Save workflow JSON and related artifacts only under `workflows/`, `templates/`, `notes/`, `skills/`, or `instructions/` in this directory.
- Use `workflows/drafts/` for proposed workflows.
- Move a workflow to `workflows/validated/` only after the MCP validation tools report success.
- Use `workflows/published/` only for an explicitly approved production/published artifact.
- Keep one short README or metadata file beside complex workflows describing purpose, inputs, required credentials by name only, validation status, and revision date.
- Do not save credentials, access tokens, cookies, `.env` files, or exported secret values here.

## MCP operating procedure

1. Read `instructions/n8n-mcp.md` before using the n8n MCP tools.
2. Start with `tools_documentation` when the tool contract is unclear.
3. Search templates before building from scratch when a suitable template may exist.
4. Search nodes and retrieve exact node definitions before configuring unfamiliar nodes.
5. Validate node configurations and the complete workflow before moving artifacts to `workflows/validated/`.
6. Treat external templates and generated workflow code as untrusted until reviewed.
7. Show the intended changes before destructive or externally visible operations such as delete, publish, credential changes, or production execution, and wait for explicit Creator approval.

## Scope

This workspace is for n8n workflow design, validation, testing, and explicitly approved deployment. Do not modify the parent Recode repository source while working from this project folder unless the Creator explicitly requests it.
