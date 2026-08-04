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

- #workflow [[n8n]] [[workflow-lifecycle]] [[validation]] The n8n workspace stores drafts, validated, and published workflows separately; workflows move to validated only after MCP validation, and published artifacts require explicit approval.

- #decision [[n8n]] [[security]] [[credentials]] Never store credentials, access tokens, cookies, .env files, or exported secret values in the n8n workspace; reference n8n credentials by name or type only.

- #lesson [[reddit-posts]] [[webhook]] [[apify]] [[security]] The validated inactive reddit-posts workflow uses an unauthenticated webhook that can trigger paid Apify usage; add access control/rate limiting before production activation.

- #correction [[reddit-posts]] [[apify]] [[credential-rotation]] [[security]] The reddit-posts workflow's temporary Apify credential was exposed during setup and must be rotated or removed before activation.

- #workflow [[n8n]] [[mcp]] For new n8n workflows, search templates and nodes, retrieve exact schemas, validate unfamiliar nodes and the complete workflow, then review changes and credentials before saving as validated.

- #fact [[n8n]] [[mcp]] [[sse]] n8n official MCP uses https://n8.retakt.cc/mcp-server/http with Bearer N8N_MCP_TOKEN; initialize and tools/list work over SSE without a session ID.

- #fact [[n8n]] [[mcp]] [[tools]] Available official n8n MCP tools include search_workflows, execute_workflow, test_workflow, search_nodes, get_node_types, validate_workflow, and get_sdk_reference.

- #workflow [[n8n]] [[mcp]] For building n8n workflows via MCP, follow this order: read SDK reference, get suggested nodes, search nodes, retrieve node types, then write and validate workflow code.

- #fact [[windows]] [[n8n]] [[environment]] Windows Machine-scope environment variables are configured: N8N_API_URL=https://n8.retakt.cc, N8N_MCP_TOKEN, and N8N_API_KEY; applications must be restarted to inherit changes.

- #fact [[mcp]] [[authentication]] [[windows]] [[environment]] RePi MCP HTTP authentication uses bearerTokenEnv, resolved from the MCP adapter process's process.env at connection time; Machine-scope Windows variables require starting a new process to be visible.

- #fact [[n8n]] [[mcp]] [[configuration]] [[token]] The configured n8n MCP server is in n8n-workspace/.mcp.json and expects the environment variable N8N_MCP_TOKEN; direct PowerShell MCP calls authenticated successfully.

- #lesson [[mcp]] [[debugging]] [[authorization]] RePi's n8n-official connection continued sending no Authorization header despite restarts, indicating the MCP adapter process was not receiving N8N_MCP_TOKEN or the connection configuration was not resolving it.

- #fact [[n8n]] [[mcp]] [[endpoint]] n8n MCP endpoint is https://n8.retakt.cc/mcp-server/http and uses bearer authentication.

- #correction [[recode]] [[windows]] [[authentication]] Recode's MCP host does not inherit the Windows Machine-scoped N8N_MCP_TOKEN, so bearerTokenEnv alone sends no Authorization header.

- #lesson [[mcp]] [[powershell]] [[token]] Direct PowerShell retrieval of the Machine-scoped token works, but using it as a dynamic bearerToken command times out in the MCP adapter.

- #decision [[mcp]] [[configuration]] The project reverted .mcp.json to bearerTokenEnv after dynamic command-based token resolution failed.

- #lesson [[n8n]] [[mcp]] [[authentication]] [[environment]] n8n MCP authentication works after starting a fresh Recode/API session with environment variables inherited; restarting VS Code alone may not refresh the gateway.

- #fact [[reddit]] [[apify]] [[workflow]] [[n8n]] The reddit-posts workflow uses a GET webhook and Apify Reddit scraper, fetching up to 10 newest posts for a supplied subreddit, defaulting to n8n, without comments or deduplication.

- #workflow [[n8n]] [[templates]] [[validation]] For new n8n workflows, search templates first, then search and inspect node schemas, validate nodes and the workflow, and save drafts/validated artifacts with notes.

- #workflow [[n8n-mcp]] [[templates]] [[command]] [[workspace]] The workspace command to refresh the local n8n-mcp template catalog is `node .\node_modules\n8n-mcp\dist\scripts\fetch-templates.js --update` after installing dependencies.

- #fact [[n8n-mcp]] [[templates]] [[sql-js]] [[windows]] n8n-mcp template updates can fall back from better-sqlite3 to sql.js under Node v26 on Windows; an initial empty database may fail with missing templates table.

- #lesson [[n8n-mcp]] [[template-fetch]] [[http-400]] [[workflow]] Running fetch-templates.js --update from node_modules/n8n-mcp may take a long time and encounter HTTP 400s for individual workflow details; the process can continue fetching many templates.

- #workflow [[windows]] [[powershell]] [[long-running]] [[logging]] For long-running Windows commands, launch Node detached with PowerShell Start-Process and redirect stdout/stderr to temporary log files, then poll the process and tail logs.

- #fact [[n8n-mcp]] [[sqlite]] [[fts5]] [[templates]] The n8n-mcp template catalog is stored in node_modules/n8n-mcp/data/nodes.db and requires native better-sqlite3 with FTS5; sql.js fallback cannot save the catalog.

- #lesson [[nodejs]] [[better-sqlite3]] [[windows]] [[build]] On this Windows project, better-sqlite3 rebuilt successfully using Node.js 22.23.2; Node 24 lacked a prebuilt binary and required unavailable Visual Studio build tools.

- #workflow [[n8n-mcp]] [[nodejs]] [[logging]] The n8n-mcp template fetcher should be run from node_modules/n8n-mcp with Node 22.23.2, redirecting output to the TEMP log for progress polling.

- #decision [[n8n]] [[data-table]] [[reddit]] The Reddit Intelligence Results data table was created with ID ZmQ8rYc2iWGOFrcM and a fixed schema for Reddit posts/comments, analysis, timestamps, status, errors, and run IDs.

- #fact [[n8n]] [[workflow]] [[compaction]] Workflow xrBvjuvnojsvrTTF (reddit-posts) was re-fetched after compaction and remained inactive; continue by re-fetching current workflow state when needed.

- #fact [[reddit]] [[testing]] [[execution]] A successful execution fetched 10 recent r/LocalLLaMA Reddit posts using the Fetch Recent Reddit Posts node.

- #lesson [[compaction]] [[n8n]] [[workflow]] Compaction does not lose persisted n8n state; workflow and created data tables can be re-fetched afterward.

- #fact [[n8n]] [[schedule-trigger]] [[version]] Use typeVersion 1.3 for n8n Schedule Trigger nodes.

- #fact [[n8n]] [[code]] [[if]] [[version]] Use typeVersion 2 for n8n Code nodes and typeVersion 2.3 for If nodes.

- #fact [[n8n]] [[testing]] [[api]] [[triggers]] n8n's public API cannot directly execute schedule- or manual-triggered workflows; external testing requires webhook, form, or chat triggers.

- #lesson [[n8n]] [[templates]] [[credentials]] [[security]] Imported n8n templates may require replacing test credentials and tokens with user-owned values; real secrets should never be committed to exported templates.

- #decision [[n8n]] [[reddit-monitoring]] [[workflow]] The n8n workflow “reddit-posts” was replaced with a Reddit monitoring pipeline using Apify scraping, AI relevance analysis, Data Table deduplication/storage, Telegram alerts and digests, scheduled/Telegram/webhook triggers, retries, and error routing.

- #fact [[n8n]] [[workflow-status]] [[timezone]] The updated “reddit-posts” workflow is saved but inactive; it contains 21 nodes and uses UTC timezone settings.

- #fact [[n8n]] [[reddit-posts]] [[webhook]] [[validation]] The n8n workflow "reddit-posts" was fixed, validated, activated, and its POST webhook test succeeded, inserting 5 rows.

- #decision [[n8n]] [[error-routing]] [[workflow-fix]] The workflow's error-routing validation issue was resolved by removing the duplicate-skip node and renaming explicit error-path nodes to neutral names.

- #fact [[n8n]] [[webhook]] [[http-post]] The production webhook endpoint for "reddit-posts" accepts POST requests at path "reddit-posts".

- #lesson [[n8n]] [[patching]] [[debugging]] A later attempt to patch Normalize AI Analysis failed because the expected JavaScript text did not exactly match; inspect the current node code before using patchNodeField.

- #lesson [[n8n]] [[reddit]] [[workflow]] [[testing]] For the reddit-posts n8n workflow, avoid automatic retries and synchronous long-running tests; a webhook execution can appear hung while Apify and AI calls process.

- #preference [[telegram]] [[reddit]] [[productivity]] [[ai]] User wants the Reddit Telegram bot optimized for productivity: fast acknowledgement, duplicate-free Reddit intelligence, focused AI analysis, and concise digests instead of waiting for full scraping.

- #fact [[n8n]] [[reddit]] [[schedule]] [[diagnosis]] The reddit-posts workflow has no intentional loop; its schedule trigger runs every 6 hours. Apparent looping came from UI video events and a hanging webhook test.

- #workflow [[n8n]] [[testing]] [[reliability]] When testing n8n workflows, check execution status once after a timeout and stop rather than repeatedly retrying or launching parallel tests.

- #correction [[n8n]] [[mcp]] [[configuration]] The n8n community MCP requires N8N_API_URL to be the n8n base URL (https://n8.retakt.cc), not the /mcp-server/http endpoint.

- #fact [[n8n]] [[reddit-posts]] [[telegram]] [[workflow]] The n8n workflow `reddit-posts` is active and contains Telegram and scheduled triggers plus Reddit collection, normalization, filtering, digest formatting, and Telegram delivery nodes.

- #workflow [[recode]] [[n8n]] [[windows]] [[workflow-management]] The user prefers restarting Recode from the workspace with N8N_API_URL and N8N_API_KEY loaded from Windows environment variables before managing n8n workflows.

- #fact [[n8n]] [[reddit-posts]] [[workflow]] Reddit monitor workflow ID xrBvjuvnojsvrTTF is named reddit-posts and has 20 nodes.

- #decision [[n8n]] [[reddit]] [[optimization]] Applied latency/noise reduction: posts capped at 10 (default 6), comments at 5 (default 3), AI candidates limited to 8 with minimum content length, digest limited to 5, fetch timeout set to 90 seconds.

- #fact [[n8n]] [[validation]] [[reddit]] After the Reddit workflow patch, runtime validation passed with 20 enabled nodes, 20 valid connections, zero errors, and zero warnings.

- #fact [[apify]] [[reddit]] [[testing]] A bounded test using LocalLLaMA returned HTTP 200 but Telegram reported that Apify returned no Reddit records; this is an empty-result path, not proof of a workflow execution failure.

- #lesson [[recode]] [[n8n-community]] [[safety]] VIDEO_XHR_CANDIDATE events caused a Recode/n8n-community UI event loop that flooded the terminal; pause immediately if this reappears and avoid further workflow tests until resolved.

- #decision [[reddit]] [[apify]] [[telegram]] [[error-handling]] Reddit workflow should distinguish genuine Apify failures from valid empty scans; empty results should produce informational Telegram output, not a hard error.

- #correction [[n8n]] [[mcp]] [[configuration]] The community n8n MCP server requires the base n8n API URL, not the official MCP endpoint; configure N8N_API_URL as https://n8.retakt.cc.

- #lesson [[n8n]] [[mcp]] [[workflow-update]] Partial workflow patch attempts failed in the community MCP diff engine with an undefined find error; validate the tool configuration or use another update method.

- #decision [[n8n]] [[reddit-posts]] [[alerts]] Project workflow: n8n workflow `reddit-posts` has ID `xrBvjuvnojsvrTTF` and should distinguish empty Reddit scans from genuine Apify failures in Telegram alerts.

- #fact [[n8n]] [[validation]] [[workflow]] The `reddit-posts` workflow runtime validation passed with 20 nodes, 20 valid connections, and zero validation errors or warnings after the alert patch.

- #lesson [[n8n]] [[javascript]] [[debugging]] A bounded workflow test exposed a syntax regression in `Prepare AI Analysis Prompt`: its JavaScript contained literal `\n` sequences instead of newlines. Verify code-node encoding after patches.

- #fact [[mcp]] [[n8n]] [[configuration]] The MCP endpoint was corrected after restart: health check reports API URL `https://n8.retakt.cc`.

- #correction [[n8n]] [[debugging]] [[code-nodes]] Project workflow `reddit-posts` had literal `\n` tokens in multiple Code nodes; replacing them with actual newlines restored runtime-valid JavaScript.

- #fact [[n8n]] [[validation]] [[reddit-posts]] After syntax fixes, n8n structural/runtime validation passed with 20 nodes, 20 valid connections, 52 validated expressions, and no validation errors.

- #lesson [[n8n]] [[llm]] [[gemma]] [[debugging]] The bounded webhook test still failed because the Gemma/OpenAI-compatible chat model returned `Bad request - please check your parameters` for all eight analyzed items; model configuration requires separate investigation.

- #decision [[n8n]] [[lm-studio]] [[workflow]] The n8n workflow `reddit-posts` uses plain JSON prompting with defensive parsing for LM Studio compatibility; AI input is capped at five candidates and 2,500 characters each.

- #fact [[n8n]] [[validation]] The `reddit-posts` workflow was validated with 19 nodes, 19 valid connections, zero errors, and zero warnings.

- #fact [[n8n]] [[testing]] [[webhook]] A bounded live test of `reddit-posts` succeeded via webhook with HTTP 200 and five rows inserted.

- #decision [[reddit]] [[filtering]] [[digest]] Reddit intelligence workflow should monitor new posts, not comments, and send only productive facts, news, releases, benchmarks, bugs, techniques, or useful insights.

- #decision [[n8n]] [[reddit]] [[data-table]] [[workflow]] Monitored subreddits should be stored in an editable n8n Data Table so the hourly workflow can iterate sources and skip unchanged or low-value subreddits.

- #workflow [[automation]] [[reddit]] [[telegram]] [[deduplication]] The Reddit workflow should run hourly, deduplicate previously seen posts, apply AI relevance filtering, and send a concise Telegram digest only when qualifying items exist.

- #preference [[n8n]] [[low-code]] [[implementation]] Prefer available n8n nodes over writing many custom functions when implementing the Reddit monitoring workflow.

- #decision [[n8n]] [[reddit]] [[data-table]] [[deduplication]] Reddit monitoring workflow uses n8n Data Tables for editable sources and persistent seen-post deduplication; the remote n8n server cannot access local workspace files.

- #decision [[reddit]] [[apify]] [[comments]] Reddit collection should fetch posts only with Apify `includeCommentsMode: none`, preventing comments from dominating the digest.

- #decision [[reddit]] [[automation]] [[telegram]] [[filtering]] Approved Reddit workflow runs hourly, filters for actionable technical intelligence, limits the digest to five items, and sends no Telegram message when nothing useful is new.

- #fact [[localllama]] [[reddit]] [[sources]] Initial Reddit source is LocalLLaMA, focused on local LLM releases, model updates, inference, benchmarks, hardware, tools, bugs, and practical techniques; max_posts is 10.
