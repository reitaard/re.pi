# Memory

- #fact [[architecture]] [[monorepo]] [[node]] RePi is a private npm monorepo containing AI, agent-core, coding-agent, orchestrator, server, TUI, and storage packages; Node.js >=22.19.0 is required.

- #fact [[status]] [[planning]] [[orchestrator]] [[lifecycle]] The implementation ledger records startup measurement (S0), S3, and lifecycle phases O0–O8—including V1 O1/O3/O6 closure—as complete; next work is to be selected between local control-plane security and release/update/certification.

- #decision [[mcp]] [[github]] [[security]] Project MCP configuration belongs in `.mcp.json`; GitHub MCP authentication must use `GITHUB_PAT_TOKEN` and never store tokens in the repository.

- #fact [[package]] [[updater]] [[fork]] The customized package is @reitaard/repi-coding-agent 0.81.4, exposing the recode binary; upstream exposes pi and must not replace the linked fork during updates.

- #lesson [[symlink]] [[self-update]] [[packaging]] The active global package is symlinked to this checkout, so package-manager self-updates can replace the linked fork without updating the checkout.

- #fact [[release]] [[oauth]] [[canonical]] Canonical release repi-v0.82.1-r1 already includes the OpenAI OAuth provider and metadata-precedence fixes; remaining OAuth-only commits were temporary CI workflow changes.

- #workflow [[security]] [[github-mcp]] [[credentials]] GitHub MCP credentials must come from GITHUB_PAT_TOKEN and must never be written to .mcp.json, documentation, logs, source files, or commits.

- #fact [[recode]] [[repository]] [[branch]] [[cli]] The authoritative Recode checkout is C:\Users\re_Lax\Desktop\chat7\re.pi on branch agent-harness; product package is @reitaard/repi-coding-agent and CLI is recode.

- #workflow [[updates]] [[safety]] [[git]] Before update or release work, read update/README.md, CONTEXT.md, PLAN.md, DECISIONS.md, and LOG.md; preserve local customizations and avoid destructive Git operations.

- #fact [[browser]] [[testing]] [[compatibility]] The controlled Browser package compatibility was updated through commit 4b149a6afe960d9a33e770e828f06e23d261b21d; its 90/91 suite retained a known real-Chrome download-event timeout.

- #workflow [[validation]] [[testing]] [[npm]] Repository validation requires npm run check after code changes and focused tests for changed or newly created tests; unrestricted npm test/build should not be run unless requested.

- #workflow [[recode]] [[git-pin]] [[installation]] Install and pin RePi packages with `recode install git:github.com/reitaard/re.pi-packages@<exact-commit-sha>`; editing settings.json alone may not materialize the checkout.

- #fact [[repi-browser]] [[footer]] [[commit]] The browser footer fix is pinned and installed at commit e660f6915933472338fb8e9c1a6c73f74732d761 (`fix: hide idle browser footer status`).

- #workflow [[local-install]] [[agent-harness]] [[bun]] For local Recode installation, fast-forward pull `origin agent-harness`, prepend `%USERPROFILE%\.bun\bin` to PATH, then run `npm run recode:install-local`.

- #fact [[n8n]] [[mcp]] [[workflows]] n8n supports instance-level MCP access for discovering and running enabled workflows, plus creating/editing workflows and data tables; access is centrally authenticated and scoped to selected workflows.

- #fact [[n8n]] [[mcp]] [[server]] n8n's MCP Server Trigger exposes tools from a specific workflow; attach Custom n8n Workflow Tool nodes to make workflow capabilities available to MCP clients.

- #fact [[n8n]] [[mcp]] [[client]] [[auth]] n8n's MCP Client connects to external MCP servers using a configured transport and endpoint URL, supporting bearer, generic or multiple headers, and OAuth2 authentication.

- #workflow [[get_search_content]] [[findtext]] [[tooling]] For get_search_content, findText cannot be combined with offset or limit; omit both fields when performing passage search.

- #correction [[tool-errors]] [[llm]] [[recode]] The retrieval failures were caused by malformed LLM-generated tool payloads, while Recode/pi-web-access correctly rejected the incompatible options.

- #decision [[recode]] [[tool-schema]] [[n8n]] Fix the Recode tool-schema translation defect before starting n8n work; preserve TypeBox optional-field semantics rather than weakening pi-web-access validation.

- #correction [[tool-contract]] [[schema-mismatch]] [[debugging]] The repeated invalid tool calls were caused by a schema translation/gateway contract mismatch that made optional fields effectively required; repeating the payload was an assistant error, not a project instruction.

- #decision [[tui]] [[diagnosis]] The TUI correctly displays received tool arguments and errors; no TUI change is needed for this incompatibility.

- #fact [[pi-web-access]] [[findtext]] [[tool-schema]] pi-web-access supports findText; failures were caused by the callable gateway injecting optional offset and limit fields into finder calls.

- #decision [[compatibility]] [[get_search_content]] [[pagination]] For get_search_content, finder mode should take precedence when findText is present, ignoring injected pagination fields while preserving pagination behavior without findText.

- #decision [[architecture]] [[tool-gateway]] [[fallback]] The robust fix should address the shared callable-tool schema gateway, with pi-web-access finder precedence as defensive compatibility; do not replace the package or avoid findText.

- #fact [[pi-web-access]] [[upstream]] [[findtext]] pi-web-access originally documented that findText cannot be combined with offset or limit; precedence behavior is a local defensive compatibility patch, not the package’s original documented intent.

- #fact [[repi]] [[gateway]] [[integration]] The RePi gateway injects optional defaults such as offset, limit, and empty url values, which can conflict with pi-web-access selectors.

- #lesson [[pi-web-access]] [[maintenance]] [[upstream]] The local pi-web-access patch is update-sensitive; package updates or reinstalls may overwrite it. A durable fix requires an upstream release or pinned commit.

- #workflow [[testing]] [[node-js]] [[typescript]] Focused get_search_content tests passed after running from a source clone; Node cannot type-strip TypeScript directly under node_modules.

- #decision [[recode]] [[pi-web-access]] [[architecture]] Do not modify upstream pi-web-access for the findText/offset conflict; fix Recode’s shared tool boundary instead.

- #fact [[tool-schema]] [[recode]] [[get_search_content]] get_search_content requires only responseId; offset, limit, findText, and findMode are optional in both AgentSession and OpenAI Responses schemas.

- #workflow [[compatibility]] [[tool-arguments]] [[pi-web-access]] pi-web-access intentionally treats findText/findMode and offset/limit as mutually exclusive retrieval modes; Recode should strip pagination when findText is present and normalize empty selectors at its compatibility boundary.

- #decision [[get_search_content]] [[compatibility]] [[coding-agent]] RePi normalizes get_search_content arguments in the coding-agent wrapper: removes empty query/url/findText, orphaned findMode, and pagination when finder mode is active.

- #fact [[testing]] [[vitest]] [[coding-agent]] Regression coverage for web finder argument compatibility is in packages/coding-agent/test/tool-definition-wrapper.test.ts; the focused suite has 3 passing tests.

- #fact [[git]] [[commit]] [[coding-agent]] The compatibility fix was committed as 8f4ae3bde with message 'fix(coding-agent): normalize web finder arguments'.

- #fact [[repi]] [[web-access]] [[bugfix]] RePi fix commit 8f4ae3bde normalizes empty web-finder selectors and pagination placeholders before upstream validation; installed Recode manifest confirms the full commit.

- #lesson [[recode]] [[windows]] [[installation]] The Recode installer may report Windows EPERM when deleting its old backup because the running Recode process locks it; the new installation is still active and restart releases the lock.

- #fact [[n8n]] [[mcp]] [[architecture]] n8n offers instance-level MCP access at /mcp-server/http with centralized authentication and selectable workflows; the MCP Server Trigger node instead exposes tools from one workflow.

- #fact [[mcp]] [[github]] [[configuration]] Project .mcp.json configures GitHub MCP with bearer authentication from GITHUB_PAT_TOKEN and lazy lifecycle.

- #decision [[n8n]] [[mcp]] [[tooling]] Use czlonkowski/n8n-mcp as the preferred n8n MCP because its broader templates, node knowledge, validation, and workflow-management capabilities outweigh the added maintenance risk.

- #workflow [[n8n]] [[project-structure]] [[session-workflow]] Create a dedicated folder at the repository root for n8n MCP skills and instructions; fork future sessions from that folder so it serves as the workflow project directory.

- #decision [[n8n]] [[storage]] [[organization]] Store n8n workflows and related project artifacts only in the dedicated folder, keeping its contents structured.

- #decision [[n8n]] [[workspace]] [[layout]] Created `n8n-workspace/` as the dedicated location for n8n workflows, with drafts, validated, published, templates, notes, skills, and instructions directories.

- #fact [[n8n-mcp]] [[dependency]] [[validation]] Pinned and installed `n8n-mcp` version 2.67.2 locally with lifecycle scripts disabled; the MCP smoke test connected successfully and listed 24 tools.

- #decision [[security]] [[credentials]] [[mcp-config]] MCP configuration uses environment placeholders for N8N_API_URL and N8N_API_KEY; credentials and secret values must never be stored in workspace files.

- #workflow [[n8n]] [[safety]] [[validation]] n8n workflow procedure: search templates and nodes, retrieve schemas, validate nodes and complete workflows, then save validated artifacts; destructive, publishing, credential, and production execution actions require explicit approval.

- #decision [[n8n]] [[mcp]] [[workspace]] The n8n workspace uses the official instance-level MCP endpoint at https://n8.retakt.cc/mcp-server/http; the locally installed community n8n-mcp package is only a fallback.

- #workflow [[security]] [[authentication]] [[environment]] MCP authentication must use the Windows environment variable N8N_MCP_TOKEN; do not store bearer tokens in .mcp.json or other project files.

- #workflow [[recode]] [[mcp]] [[setup]] Recode discovers the project MCP configuration from the current working directory; start Recode with n8n-workspace as the project directory, then restart it after environment-variable changes.

- #decision [[n8n]] [[mcp]] [[lifecycle]] The n8n MCP server in this project uses lazy lifecycle to avoid starting or loading tools until needed.

- #fact [[n8n]] [[mcp]] [[authentication]] The n8n MCP endpoint authenticates successfully with the Windows User-scope token and returns HTTP 200 using Streamable HTTP.

- #decision [[n8n]] [[mcp]] [[community-server]] Use the community czlonkowski/n8n-mcp server for this project, not n8n’s built-in MCP endpoint.

- #fact [[n8n]] [[mcp]] [[environment]] The community n8n-mcp configuration uses N8N_API_KEY from the Windows environment and the fixed URL https://n8.retakt.cc; N8N_MCP_TOKEN is for the official endpoint.

- #fact [[n8n-mcp]] [[configuration]] [[verification]] The n8n workspace uses the installed community n8n-mcp package, configured with N8N_API_URL and N8N_API_KEY; authentication and read-only workflow listing were verified.

- #workflow [[validation]] [[process]] For new workflows, follow: read skills, inspect tool docs, search templates, search/get nodes, validate unfamiliar nodes, create a draft, validate the workflow, review credentials/diff, then save as validated.

- #fact [[n8n-mcp]] [[tools]] [[capabilities]] The community MCP exposes template search/retrieval, node documentation and validation, workflow autofix, workflow updates, testing/evaluations, versioning, deployment, health checks, and audits.

- #decision [[reddit]] [[templates]] [[instructions]] [[skill]] The project should maintain explicit instruction files first, then derive a reusable skill file from them; the immediate test target is a Reddit post collector workflow, including trying Reddit-related templates.

- #workflow [[n8n]] [[mcp]] [[templates]] For n8n community template research, use the local n8n-mcp server through its MCP stdio wrapper and call search_templates.

- #preference [[focus]] [[mcp]] [[user-preference]] The user wants work focused on the core goal and prefers template searches to be performed through MCP.

- #fact [[reddit]] [[n8n]] [[templates]] Searching the community catalog by node type n8n-nodes-base.reddit returned 22 templates, with 20 returned in the requested page.

- #correction [[mcp]] [[templates]] [[search]] The community MCP template search is not limited to 10; its documented default is 20 and maximum is 100. The prior limit of 10 was explicitly chosen by the assistant.

- #workflow [[mcp]] [[templates]] [[optimization]] For compact keyword comparison, search_templates supports limit: 1 and fields such as ["id"], returning total and hasMore without listing full results.

- #fact [[n8n]] [[templates]] [[cache]] [[mcp]] The community MCP searches a local indexed template cache, not n8n.io live. Templates are fetched from https://api.n8n.io/api/templates and require an explicit manual refresh.

- #fact [[n8n]] [[templates]] [[freshness]] The local template fetcher filters templates to roughly the prior 12 months, so the catalog may omit older workflows; its exact refresh date is not exposed by search.

- #workflow [[n8n-mcp]] [[templates]] [[command]] The published n8n-mcp package may omit its npm scripts; run the included fetcher directly with `node dist/scripts/fetch-templates.js --update`.

- #fact [[n8n-mcp]] [[database]] [[working-directory]] The n8n-mcp template fetcher uses a relative `./data/nodes.db` path, so run it from `node_modules/n8n-mcp` to target the packaged database.

- #lesson [[n8n-mcp]] [[sql-js]] [[fts5]] [[templates]] The template download can reach 100% yet fail during database writes because the sql.js fallback lacks SQLite FTS5 support; the refresh is therefore incomplete.

- #decision [[n8n-mcp]] [[node22]] [[better-sqlite3]] [[configuration]] n8n-mcp must launch with Node v22.16.0 because better-sqlite3 lacks compatible prebuilds on Node 24/26; .mcp.json was updated to use the Node 22 executable directly.

- #fact [[template-catalog]] [[fts5]] [[refresh]] [[verification]] The n8n template catalog was successfully refreshed under Node 22, saving 2,156 templates and rebuilding the FTS5 index; the restarted MCP verified access to the refreshed catalog.

- #workflow [[n8n-workflows]] [[validation]] [[templates]] For new n8n workflows, search existing templates before designing from scratch, then inspect nodes, validate the workflow, review credentials, and save validated artifacts under workflows/validated/.

- #preference [[template-search]] [[reddit]] [[safety]] [[workflow-design]] Do not import or modify templates during template comparison unless explicitly requested; compare compact Reddit-relevant candidates and inspect only the simplest suitable options.

- #decision [[reddit-posts]] [[webhook]] [[curl]] [[read-only]] User wants the existing `reddit-posts` workflow to be a read-only Reddit collector testable via curl, without Discord posting.

- #workflow [[reddit]] [[webhook]] [[json]] Planned collector flow: Webhook accepts subreddit/limit, Reddit Get Many fetches new posts, then returns normalized JSON via the webhook response.

- #fact [[reddit]] [[oauth]] [[devvit]] [[credentials]] Use n8n's native Reddit OAuth2 integration for read-only API access; Devvit is not a replacement for standard Reddit API OAuth credentials.

- #fact [[n8n]] [[reddit]] [[workflow]] The n8n `reddit-posts` workflow (ID xrBvjuvnojsvrTTF) is inactive and read-only: GET webhook → Reddit newest-post retrieval → JSON response.

- #decision [[reddit]] [[webhook]] [[parameters]] The workflow accepts a `subreddit` query parameter defaulting to `n8n`; the result limit is fixed at 10 because the Reddit node requires a numeric limit.

- #fact [[validation]] [[n8n]] [[workflow]] Strict validation passed with 0 errors after setting the Reddit limit to 10 and adding webhook error-response settings; one non-blocking webhook warning remains.

- #fact [[reddit]] [[oauth]] [[credentials]] The Reddit node requires an n8n `redditOAuth2Api` credential before the workflow can execute successfully; no credential values are stored in the artifacts.

- #fact [[n8n]] [[reddit]] [[oauth2]] n8n's Reddit credential uses OAuth2 with a Reddit client ID and client secret; the Reddit app redirect URI must exactly match n8n's OAuth callback URL.

- #fact [[n8n]] [[reddit]] [[collector]] The project uses a read-only n8n Reddit collector workflow named `reddit-posts` on n8.retakt.cc.

- #lesson [[reddit]] [[api]] [[terms]] [[compliance]] Reddit's legacy API guidance may be outdated; current usage is governed by Reddit's Developer Terms, Data API Terms, and Responsible Builder Policy.

- #workflow [[reddit]] [[oauth]] [[n8n]] Reddit installed apps do not expose a client secret; create a separate web app for OAuth, using https://n8.retakt.cc/rest/oauth2-credential/callback as the redirect URI.

- #fact [[apify]] [[authentication]] The Apify actor input URL redirects to Apify sign-in, so authentication is required before inspecting its inputs.

- #workflow [[apify]] [[n8n]] [[integration]] For connecting the Apify actor to n8n, API endpoints are the easiest option; avoid MCP configurator, CLI, and API clients initially.

- #lesson [[browser]] [[cancellation]] [[debugging]] [[repi]] RePi browser debugging should focus on lifecycle and cancellation: start/open return empty results, status shows stopped with no tabs, and AbortSignal propagation may be failing. Do not use detached Chrome as a workaround.

- #decision [[reddit-posts]] [[apify]] [[n8n]] [[integration]] The reddit-posts workflow is intended to call Apify’s Reddit scraper synchronously through an HTTP Request node, followed by optional Code-node processing.

- #preference [[reddit-posts]] [[n8n-mcp]] [[workflow-editing]] The user prefers modifying the reddit-posts workflow through n8n MCP tools.

- #fact [[reddit-posts]] [[webhook]] [[n8n]] The `reddit-posts` workflow is inactive and exposes a GET webhook at `/reddit-posts`; it returns up to 10 newest posts for the requested subreddit, defaulting to `n8n`.

- #fact [[reddit]] [[credentials]] [[n8n]] The current `reddit-posts` workflow uses an n8n Reddit node requiring a `redditOAuth2Api` credential; without an attached credential, execution cannot succeed.

- #decision [[apify]] [[code-node]] [[validation]] A replacement implementation using an n8n Code node and Apify's Reddit scraper was strictly validated successfully, but the workflow update used `validateOnly` and was not applied.

- #decision [[n8n]] [[apify]] [[reddit]] [[authentication]] The n8n workflow `reddit-posts` uses Apify’s Reddit scraper via an HTTP Request node with encrypted HTTP Header Auth, replacing Reddit OAuth and avoiding tokens in workflow code.

- #fact [[webhook]] [[reddit]] [[apify]] `reddit-posts` accepts a GET `subreddit` query parameter, defaults to `n8n`, requests the 10 newest posts, and excludes comments.

- #fact [[n8n]] [[validation]] [[workflow-status]] The `reddit-posts` workflow is inactive and strict validation passes with zero errors; one webhook response warning remains.

- #lesson [[credentials]] [[security]] [[apify]] A temporary Apify credential was created for testing; it should be rotated or removed after the test, and its secret must not be stored in workflow files or shared in chat.

- #decision [[n8n]] [[reddit-posts]] [[workflow-state]] The n8n workflow `reddit-posts` is intentionally kept inactive and unchanged after the successful Showerthoughts test.

- #fact [[n8n]] [[reddit]] [[sorting]] [[workflow]] `reddit-posts` fetches up to 10 subreddit posts sorted by newest (`sort: "new"`).

- #fact [[reddit]] [[showerthoughts]] [[validation]] The Showerthoughts test returned 10 posts ranked 1–10 with descending creation timestamps, confirming newest-first results at that point in time.
