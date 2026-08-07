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

- #workflow [[n8n]] [[templates]] [[setup]] The n8n workspace must document how to rebuild the local template catalog because node_modules/n8n-mcp/data/nodes.db is ignored by Git and absent on new machines.

- #decision [[memory]] [[testing]] [[git]] The user wants the project memory file committed temporarily for later tests, with the intention of removing it afterward.

- #decision [[n8n]] [[mcp]] [[configuration]] The n8n workspace uses two MCP servers: official HTTP MCP authenticated via N8N_MCP_TOKEN, and community MCP authenticated via N8N_API_KEY.

- #fact [[n8n]] [[credentials]] [[validation]] N8N_MCP_TOKEN and N8N_API_KEY are configured in both Windows User scope and the current process; values were confirmed present but not validated against the server.

- #workflow [[n8n]] [[recode]] Restart Recode after changing either n8n credential so the process loads the updated environment variables.

- #decision [[n8n]] [[security]] [[mcp]] The committed n8n MCP configuration reads credentials from environment variables rather than storing API keys directly.

- #fact [[reddit]] [[workflow]] [[debugging]] The old Reddit post workflow was modified to send posts hourly, but the user has not received any posts; investigate its schedule and execution flow.

- #fact [[n8n]] [[reddit-posts]] [[schedule]] On 2026-08-04, scheduled executions fired at 06:00, 09:00, 10:00, 11:00, 12:00, and 13:00 UTC, confirming the hourly trigger is active in UTC.

- #fact [[n8n]] [[reddit-posts]] [[execution]] Executions 79310 and 79311 fetched 35 posts and completed AI analysis, but failed before delivery: 79310 rejected numeric threshold `0.7` as a string, and 79311 had invalid syntax in `Ignore Non-Useful Posts`.

- #fact [[n8n]] [[reddit-posts]] [[telegram]] [[delivery]] Executions 79312 and 79313 fetched 35 posts, analyzed candidates, and stored useful results, but the Telegram node returned `Bad Request: can't parse entities` and delivered no digest; `onError: continueRegularOutput` incorrectly marked the workflow successful.

- #lesson [[n8n]] [[reddit-posts]] [[telegram]] Telegram digest delivery must use plain text or correctly escaped formatting. The current raw digest contains Markdown-sensitive characters and Telegram parse errors are masked by the node's continue-on-error setting.

- #lesson [[n8n]] [[reddit-posts]] [[deduplication]] Posts are marked seen before AI analysis and delivery, so failed executions can permanently suppress those posts from later hourly scans; future fixes should avoid treating a failed delivery as successful deduplication.

- #fact [[n8n]] [[reddit-posts]] [[schedule]] Published version `9548aee3-adc1-44c2-b0cf-a6a4bc34701a` is active with a UTC schedule interval of 30 minutes.

- #decision [[n8n]] [[reddit-posts]] [[telegram]] The digest and scan-error Telegram nodes now explicitly use HTML parsing with escaped dynamic text, bounded message length, and `stopWorkflow` error handling so delivery failures remain visible.

- #fact [[n8n]] [[reddit-posts]] [[execution]] Controlled execution `79314` succeeded after the repair and fetched 25 posts, but deduplication returned zero new items, so the Telegram delivery node was not reached and no live message was verified.

- #fact [[n8n]] [[reddit-posts]] [[gemma]] [[evaluation]] Executions `79312` and `79313` produced 18/18 parseable Gemma `gemma3:4b-it-qat` responses, but the 4B model showed a strong relevance bias, accepted ordinary questions/opinions/speculation, emitted non-schema category names, and once confused an 8% RTX 5090 result with a 4% P40 result.

- #decision [[n8n]] [[reddit-posts]] [[filtering]] Published version `53532db0-b305-4b07-bad3-12c9d0982f1b` adds a stricter Gemma prompt, deterministic low-signal guards, and category aliases after model evaluation; Telegram output now uses escaped HTML with bold/italic/monospace styling and clickable title, subreddit, and source links.

- #lesson [[reddit]] [[n8n]] [[debugging]] [[workflow]] The Reddit workflow previously failed because n8n strict numeric comparison received the 0.7 threshold as a string, and an Ignore Non-Useful Posts Set node had malformed JSON expression syntax; later runs succeeded after fixes.

- #workflow [[n8n]] [[workflow-operations]] [[safety]] Production n8n workflow changes must serialize lifecycle operations: deactivate once, patch and validate, then activate once; never issue concurrent or duplicate deactivation calls.

- #decision [[n8n]] [[reddit-posts]] [[schedule]] [[testing]] After fixing the Reddit Telegram delivery issue, run one controlled validation test, then change the workflow schedule to every 30 minutes for faster updates.

- #correction [[n8n]] [[tooling]] [[parameters]] For n8n community workflow updates and validation, use parameter `id` (not `workflowId`); partial updates require `operations` as an array, while validation options are nested under `options`.

- #fact [[reddit-posts]] [[n8n]] [[telegram]] The `reddit-posts` workflow (ID `xrBvjuvnojsvrTTF`) is an active hourly Reddit intelligence workflow that filters new subreddit posts and sends a Telegram digest of up to five actionable items.

- #workflow [[n8n]] [[safety]] Before changing an n8n workflow, inspect both draft and active versions; do not publish, activate, execute, or make production changes without explicit approval in the current conversation.

- #workflow [[n8n]] [[execution]] [[testing]] For externally executing n8n workflows, first retrieve workflow details and provide the required typed input; schedule- or manual-triggered workflows cannot be executed through the community HTTP test tool.

- #fact [[n8n]] [[telegram]] [[node-version]] The n8n Telegram node uses typeVersion 1.2 when creating or configuring Telegram nodes.

- #lesson [[telegram]] [[reddit]] [[formatting]] [[markdown]] Reddit digest delivery failed because Telegram could not parse message entities at byte offsets 2028 and 2449; digest formatting must escape special characters or use a compatible parse mode.

- #lesson [[n8n]] [[telegram]] [[deduplication]] [[errors]] Telegram errors were returned as node output while executions remained successful, and Mark Posts Seen still inserted rows; failed delivery can therefore suppress posts from future scans.

- #workflow [[n8n]] [[mcp]] [[tooling]] For n8n community_get_node, request full property detail with detail='full' and mode='info'; mode='full' is invalid.

- #decision [[reddit-posts]] [[schedule]] [[n8n]] The reddit-posts workflow now runs every 30 minutes instead of hourly.

- #decision [[telegram]] [[digest]] [[format]] Telegram Reddit digests contain up to five plain-text items, with title, subreddit, type, relevance, summary, optional importance, and URL; output is capped near Telegram limits.

- #workflow [[error-handling]] [[telegram]] [[reddit-posts]] The reddit-posts workflow sends a Telegram notification when scanning fails, sanitizing and truncating the error message.

- #fact [[validation]] [[deployment]] [[n8n]] After modification, reddit-posts was strictly validated with zero errors and published as the active workflow version.

- #fact [[n8n]] [[reddit]] [[telegram]] [[schedule]] The active n8n workflow `reddit-posts` scans Reddit every 30 minutes and sends a Telegram digest containing up to five intelligence items.

- #fact [[reddit]] [[data-table]] [[crackwatch]] [[filters]] Reddit source configuration is stored in n8n Data Tables; enabled sources currently include LocalLLaMA and CrackWatch, with CrackWatch restricted case-insensitively to author voices38.

- #workflow [[deduplication]] [[reddit]] [[data-table]] [[ai-filter]] The workflow deduplicates posts using the `Reddit Seen Posts` Data Table keyed by `post_id`, ignores comments, and applies source-specific score and author filters before AI relevance analysis.

- #lesson [[failure-mode]] [[deduplication]] [[n8n]] [[reddit]] A failed `New Posts Only` node caused the successful execution to produce no downstream items; posts marked seen before model failure will not be automatically reanalyzed or resent.

- #preference [[reddit]] [[telegram]] [[formatting]] Reddit Telegram digests should use attractive HTML formatting: bold titles, italic summaries, monospace metadata, clean separators, and ellipsis truncation within Telegram limits.

- #decision [[reddit]] [[telegram]] [[links]] Make Reddit item titles and subreddit names clickable links while retaining selectable/copyable text in the Telegram digest.

- #workflow [[reddit]] [[gemma]] [[evaluation]] [[ai-filtering]] Before relying on the small Gemma model for Reddit relevance filtering, evaluate its reasoning and classification quality using actual workflow executions and inspect for misclassification or hallucinated summaries.

- #decision [[n8n]] [[reddit-posts]] [[workflow-state]] The n8n workflow "reddit-posts" was intentionally deactivated after user authorization.

- #correction [[n8n]] [[workflow-management]] [[mcp]] For n8n workflow changes, use n8n_update_partial_workflow with activateWorkflow/deactivateWorkflow operations; publish/unpublish tool names are unavailable.

- #decision [[reddit]] [[classifier]] [[n8n]] The n8n workflow "reddit-posts" uses strict Reddit intelligence classification: prioritize concrete releases, benchmarks, bugs, research, hardware, tools, techniques, security, and credible news; reject weak or opinion-only posts.

- #decision [[reddit]] [[crackwatch]] [[exception]] The Reddit classifier has a special exception for CrackWatch posts by voices38: named game releases or updates with metadata are relevant even when the body is brief.

- #fact [[n8n]] [[telegram]] [[workflow]] Workflow "reddit-posts" was updated successfully, strict-validated with zero errors, and activated; it contains 23 nodes and sends HTML-formatted Telegram digests and scan-error alerts.

- #fact [[n8n]] [[reddit]] [[schedule]] The Reddit intelligence workflow runs every 30 minutes and processes new posts from enabled subreddit sources.

- #lesson [[gemma]] [[classification]] [[evaluation]] Gemma 3 4B returned parseable results but overclassified questions, opinions, and speculation, emitted invalid category labels, and once confused benchmark hardware/results.

- #decision [[n8n]] [[reddit]] [[telegram]] [[filtering]] Published workflow version 53532db0 adds stricter prompting, deterministic low-signal filters, category aliases, and escaped HTML Telegram output with clickable links.

- #fact [[n8n]] [[reddit]] [[validation]] Controlled execution 79314 succeeded and fetched 25 posts, but deduplication found no new items; Telegram delivery was not reached or live-verified.

- #lesson [[reddit]] [[gemma]] [[evaluation]] [[filtering]] Gemma3:4b-it-qat parsed 18/18 test responses but had weak semantic filtering, invalid categories, and factual misclassification; it should not be used alone.

- #decision [[reddit]] [[workflow]] [[validation]] [[normalization]] The Reddit workflow uses deterministic guards and stricter output normalization to compensate for LLM relevance and category errors.

- #fact [[reddit]] [[telegram]] [[html]] [[formatting]] The active Reddit Telegram digest formats titles/headings in bold, summaries in italics, metadata in monospace, and includes escaped clickable links with safe truncation.

- #fact [[n8n]] [[groq]] [[models]] [[llm]] Existing n8n workflows include Groq chat model nodes configured with the openai/gpt-oss-120b model.

- #fact [[n8n]] [[credentials]] [[lm-studio]] n8n has two separate credentials named "LM studio": one openAiApi credential and one ollamaApi credential.

- #fact [[n8n]] [[lm-studio]] [[qwen]] Active n8n workflows cue support, cue test, and E2(Assiatance_Prototype) use the LM studio OpenAI-compatible credential with qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2.

- #fact [[n8n]] [[reddit-posts]] [[gemma]] [[lm-studio]] The active n8n workflow reddit-posts uses the LM studio OpenAI-compatible credential with model gemma3:4b-it-qat.

- #fact [[n8n]] [[spotipy]] [[qwen]] [[workflow]] Spotipy AI Agent v1 is inactive and uses the LM studio OpenAI-compatible credential with model qwen3:8b.

- #correction [[n8n]] [[ollama]] [[cue-ping]] [[bug]] The cue-ping workflow is inactive and its Ollama Chat Model node has an invalid model parameter set to "=".

- #fact [[models]] [[lm-studio]] [[n8n]] LM studio credential models: gemma3:4b-it-qat is used by reddit-posts; qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2 is used by three active workflows; qwen3:8b is in inactive Spotipy AI Agent v1.

- #fact [[model-test]] [[ai-agent]] [[failure]] A webhook availability check for the Qwen model failed in the AI Agent with 'The resource you are requesting could not be found'; no successful response was verified.

- #workflow [[reddit-posts]] [[ab-test]] [[json]] Do not update reddit-posts based only on model configuration. First run an A/B test on identical Reddit posts and compare false positives and JSON reliability.

- #fact [[spotipy]] [[executions]] [[debugging]] Spotipy AI Agent v1 is inactive, but its recent manual executions include successful runs and repeated AI Agent errors; execution history should be checked before changing its model.

- #decision [[reddit-posts]] [[gemma]] [[classifier]] Keep the reddit-posts workflow on Gemma until an alternative model passes a clean classifier-specific response test.

- #lesson [[qwen]] [[lm-studio]] [[model-testing]] The configured Qwen 3.5 exact ID returned 404, while qwen3:8b produced empty or unknown responses; neither is currently a reliable substitute for reddit-posts.

- #decision [[reddit-posts]] [[qwen3-5-4b]] [[n8n]] The n8n workflow "reddit-posts" now uses LM Studio model qwen3.5:4b instead of Gemma; runtime validation passed with zero errors.

- #fact [[qwen3-5-4b]] [[lm-studio]] [[model-check]] The exact LM Studio model ID qwen3.5:4b was verified available through the active Cue support webhook, returning the expected response.

- #decision [[model-selection]] [[benchmark]] [[reddit-posts]] For reddit-posts, model selection should optimize digest quality—not merely model availability—using an isolated benchmark with identical labeled posts and precision, JSON validity, recall, factual preservation, latency, and repeatability metrics.

- #decision [[reddit-posts]] [[gemma]] [[qwen]] The production reddit-posts workflow was restored to Gemma (`gemma3:4b-it-qat`); Qwen 3.5 4B was provisional and should not be treated as the selected winner.

- #workflow [[isolation]] [[benchmark]] [[deduplication]] Model comparisons for reddit-posts must run in isolation, without Telegram sends or changes to Reddit deduplication/seen-item tables, before assigning a winner to production.

- #decision [[n8n]] [[benchmark]] [[reddit]] [[classification]] Created n8n workflow `reddit-model-benchmark` (ID N5OkesrJsi8n02BC) to classify a fixed Reddit benchmark set with a local model and aggregate schema, decision, signal-type, precision, recall, and accuracy metrics.

- #fact [[n8n]] [[validation]] [[error-handling]] The `reddit-model-benchmark` workflow passed runtime validation with 7 nodes and 6 valid connections; validation suggested adding node/error handling.

- #decision [[n8n]] [[workflow]] [[activation]] The benchmark workflow was activated successfully for controlled candidate testing.

- #lesson [[n8n]] [[testing]] [[timeout]] [[debugging]] Two webhook test attempts timed out after about 30 seconds, returned no response, and produced no recorded executions; the cause remains unresolved.

- #decision [[n8n]] [[benchmark]] [[limit]] The reddit-model-benchmark workflow supports a bounded body.limit parameter, clamped to at least 1 and at most the fixed sample size, while preserving post labels.

- #lesson [[n8n]] [[javascript]] [[patching]] When patching n8n JavaScript code, replacement strings containing escaped newlines can be stored literally and cause SyntaxError; inspect the saved code and replace them with actual newlines.

- #workflow [[n8n]] [[testing]] After modifying an n8n workflow, validate the patch, inspect the affected node's saved code, then run a bounded test execution and inspect execution errors.

- #decision [[n8n]] [[benchmark]] [[gemma]] The reddit-model-benchmark workflow was updated to use gemma3:4b-it-qat in its Benchmark OpenAI Chat Model node.

- #fact [[n8n]] [[webhook]] [[benchmark]] The reddit-model-benchmark workflow is active and accepts POST requests at the reddit-model-benchmark webhook path.

- #lesson [[n8n]] [[testing]] [[workflow]] Benchmark runs can exceed the test tool timeout even when n8n completes them successfully; verify completion through execution listings or execution details.

- #decision [[reddit-posts]] [[gemma]] [[production]] Production workflow `reddit-posts` remains configured with `gemma3:4b-it-qat` via the LM Studio credential; the model benchmark is not used in production.

- #workflow [[benchmark]] [[n8n]] [[model-comparison]] Isolated benchmark workflow `reddit-model-benchmark` (N5OkesrJsi8n02BC) compares models on a fixed Reddit sample without production writes or Telegram sends, and is kept inactive after runs.

- #fact [[qwen]] [[gemma]] [[benchmark-results]] Initial benchmark: qwen3.5:4b produced valid JSON and the correct relevance decision on the first sample, while Gemma returned an empty/invalid response; this is only an initial screen, not a final ranking.

- #workflow [[evaluation]] [[benchmarking]] [[reddit]] Model comparisons should use the same fixed sample and evaluate schema validity, decision accuracy, precision, recall, false positives/negatives, and signal-type accuracy.

- #decision [[n8n]] [[reddit]] [[qwen3-5-4b]] Production n8n workflow `reddit-posts` uses only `qwen3.5:4b` via the `LM studio` credential and remains active.

- #decision [[n8n]] [[cleanup]] [[benchmark]] The inactive `reddit-model-benchmark` workflow and its local draft note were intentionally deleted after confirmation.

- #fact [[spotify]] [[music-companion]] [[agent]] The user is designing a music-companion agent that chats with users and downloads requested songs.

- #fact [[spotify]] [[cookies]] [[downloads]] [[llm]] For the music companion, cookie rotation and downloads were already working productively; the main problem was poor LLM reasoning in chat.

- #preference [[n8n]] [[workflow-design]] [[actual-nodes]] [[analysis-first]] The user prefers consolidating the music companion into one clean n8n workflow using actual nodes instead of many code-function nodes, and requested an analysis-only review before changes.

- #decision [[spotipy]] [[spotify]] [[catalog]] [[evidence]] Spotipy uses a read-only Spotify catalog tool for evidence, supporting search, album_tracks, and artist_albums operations without download or playback side effects.

- #fact [[spotipy]] [[async]] [[jobs]] [[delivery]] Spotipy async processing is split into separate Submit v2 and Delivery v2 workflows, with callback jobId validation and state-based delivery.

- #decision [[telegram]] [[spotdl]] [[rpc]] [[gateway]] The spotdl-telegram workflow serves as the Telegram conversation gateway, retaining persistent RePi RPC sessions alongside direct asynchronous download commands.

- #decision [[refactor]] [[n8n]] [[workflow]] Refactor the Spotify Telegram bot into one new inactive workflow, preserving existing productive workflows until end-to-end testing passes and approval is given.

- #decision [[architecture]] [[ai-routing]] [[validation]] Use AI only for strict intent JSON; deterministic n8n nodes must verify Spotify results, handle selections, queue downloads, deliver files, and perform cleanup.

- #decision [[spotdl]] [[vps]] [[infrastructure]] Retain the VPS spotDL runner, cookie rotation, queue limits, retries, job state, cleanup, audio transfer, and existing Spotify/Telegram/SSH credentials as the proven infrastructure layer.

- #fact [[templates]] [[spotify]] [[n8n]] Template research found no combined Spotify/Telegram template; template 4210 demonstrates an n8n Spotify node and AI recommendation flow, so reusable patterns must be adapted rather than imported wholesale.

- #workflow [[validation]] [[safety]] Follow the n8n workflow safety process: research templates and node schemas, build a draft artifact, validate it, review credentials and diff, then save as validated before any production mutation.

- #decision [[spotify]] [[telegram]] [[cutover]] For the Spotify Telegram cutover, use the existing bot; deactivate the current Telegram gateway before testing or activating its replacement.

- #preference [[spotify]] [[authorization]] [[workflow]] User authorizes deactivating workflows and implementing changes related to the Spotify project.

- #fact [[spotify]] [[telegram]] [[n8n]] The active workflow spotdl-telegram is the current Telegram gateway for Spotify and must be considered during cutover.

- #decision [[architecture]] [[telegram]] [[spotdl]] [[workflow]] Use a single Telegram workflow by embedding the synchronous spotdl-dispatch → download → Telegram audio → lyrics → cleanup path; do not rely on the VPS queue or modify VPS software.

- #fact [[spotify]] [[oauth]] [[verification]] The Spotify catalog OAuth credential is verified: a read-only track search for “Nude Radiohead” returned Radiohead’s “Nude” successfully.

- #fact [[n8n]] [[aggregate]] [[split-out]] When creating n8n Aggregate or Split Out nodes, use typeVersion 1.

- #decision [[workflow]] [[deployment]] [[spotify]] Build the Spotify replacement as a new inactive workflow first, rather than modifying the existing workflow.

- #decision [[architecture]] [[vps]] [[telegram]] [[spotdl]] Use the proven synchronous VPS dispatch path so queue submission, delivery, cleanup, and Telegram output remain in one workflow.

- #fact [[n8n]] [[validation]] [[workflow]] The replacement n8n workflow passed strict validation: 18 nodes, 17 valid connections, 25 expressions validated, and no errors or warnings.

- #fact [[spotify]] [[oauth]] [[authentication]] Spotify OAuth authentication was tested successfully for the replacement workflow.

- #decision [[n8n]] [[spotipy]] [[workflow]] [[validation]] Created the n8n workflow “Spotipy Music Companion v3” as inactive; strict validation found 18 enabled nodes and 17 valid connections with no errors, but 15 warnings remain.

- #decision [[spotipy]] [[n8n]] [[telegram]] Spotipy Music Companion v3 (workflow 8Sviq9pjDE3GFdnF) is the active owner of the existing Telegram bot after replacing the legacy gateway.

- #decision [[spotipy]] [[workflow]] [[spotdl]] [[architecture]] The v3 workflow consolidates Telegram handling, Spotify search, synchronous spotdl dispatch, per-file delivery, and cleanup into one workflow; it intentionally replaces the async queue/callback path.

- #fact [[n8n]] [[executions]] [[cutover]] [[safety]] Before cutover, no waiting executions existed in the legacy async submit, async delivery, or downloader workflows.

- #workflow [[n8n]] [[validation]] [[code-nodes]] The v3 workflow was patched so Normalize music request and Parse dispatch result explicitly run once for each item, then strict validation passed with zero errors and only non-blocking warnings.

- #decision [[spotipy]] [[n8n]] [[deprecation]] [[cutover]] After successful cutover, the obsolete Telegram gateway, async submit/delivery, downloader, evidence webhook, and music-data sub-workflow were deactivated rather than deleted.

- #workflow [[spotipy-v3]] [[webhook]] [[curl]] [[testing]] For testing Spotipy Music Companion v3, replace the Telegram trigger with a webhook so requests can be injected and tested via curl; restore the Telegram node after validation.

- #fact [[spotipy-v3]] [[validation]] [[n8n]] Spotipy Music Companion v3 is active and strictly validated with 19 nodes, 18 valid connections, 27 expressions, and zero errors.

- #decision [[spotipy-v3]] [[legacy]] [[rollback]] Legacy Telegram, async delivery, downloader, evidence, and music-data workflows are inactive but preserved for rollback.

- #decision [[n8n]] [[webhook]] [[testing]] Spotipy Music Companion v3 uses a temporary POST webhook at path spotipy-music-companion-v3-test for deterministic integration testing.

- #fact [[payload]] [[vps-runner]] [[validation]] The VPS runner requires the full validated payload shape, including repiSessionId, sourceUrl, collectionId, delivery, and the complete options object.

- #decision [[n8n]] [[testing]] [[responses]] Webhook test responses are configured for lastNode/firstEntryJson so tests return terminal workflow output instead of only acknowledging that execution started.

- #correction [[n8n]] [[execution-id]] [[job-id]] n8n webhook test executions may not provide $execution.id; job ID generation uses Date.now() as a fallback.

- #fact [[download]] [[testing]] [[invalid-payload]] The webhook search flow passed, but the Spotify download test still returned 'Invalid payload' after the execution-ID fallback; the download issue remains unresolved.

- #fact [[spotipy]] [[n8n]] [[payloadb64]] [[dispatch]] In Spotipy Music Companion v3, Telegram status nodes replace the current item, so dispatch must reference Normalize music request explicitly for payloadB64.

- #decision [[spotipy]] [[spotdl]] [[dispatcher]] [[n8n]] The v3 dispatcher command should match the working workflow: sudo /usr/local/sbin/spotdl-dispatch '{{ $('Normalize music request').item.json.payloadB64 }}' || true.

- #decision [[n8n]] [[telegram]] [[trigger]] Spotipy Music Companion v3 uses one active Telegram Trigger with the spotipy credential and listens for message updates.

- #fact [[validation]] [[n8n]] [[workflow]] Spotipy Music Companion v3 passes strict validation: 19 enabled nodes, 18 valid connections, and 0 errors.

- #decision [[request-id]] [[telegram]] [[normalization]] The workflow's normalized request IDs use the format telegram-<execution>-<timestamp>, matching the working Telegram gateway.

- #decision [[dispatcher]] [[normalization]] [[workflow]] The v3 dispatcher input was aligned to reference the Normalize music request node, matching the working workflow's data flow.

- #decision [[n8n]] [[audio-delivery]] [[workflow]] In Spotipy Music Companion v3, Prepare audio deliveries must emit one top-level item per file and connect directly to Download audio file; nested deliveries.remotePath breaks SSH downloading.

- #lesson [[spotdl]] [[yt-dlp]] [[failure-mode]] Audio delivery fixes do not resolve upstream spotDL failures: if yt-dlp cannot download the source, no audio files are produced and Telegram delivery is never reached.

- #correction [[spotipy]] [[yt-dlp]] [[cookies]] [[diagnosis]] For Spotipy download failures, first inspect the existing VPS yt-dlp setup and cookie-rotation path; do not assume the n8n workflow wiring is the cause.

- #fact [[spotipy]] [[vps]] [[yt-dlp]] [[cookies]] The Spotipy workflow reuses an existing VPS yt-dlp/spotdl-dispatch setup that was connected because both integrations depend on authenticated cookies.

- #decision [[n8n]] [[spotipy]] [[diagnostics]] The planned Spotipy VPS diagnostic workflow is inactive and uses a POST webhook connected to an SSH command node.

- #decision [[n8n]] [[spotipy]] [[diagnostics]] [[workflow]] Created inactive n8n workflow "Spotipy VPS yt-dlp diagnostic (read-only)" (ID 6wvg0fK9dk1LzGRs) for non-mutating VPS inspection; workflow validation and manual execution passed.

- #correction [[ssh]] [[n8n]] [[credentials]] [[vps]] The VPS diagnostic SSH node must use the existing private-key authentication with credential vps-spotdl; password authentication caused execution failure.

- #fact [[vps]] [[yt-dlp]] [[spotdl]] [[runtime]] The VPS runtime user is spotdl-runner (uid/gid 1001). System PATH has yt-dlp 2026.03.17 at /usr/local/bin/yt-dlp, while spotdl and deno are not available on PATH.

- #workflow [[n8n]] [[mcp]] Manual execution through n8n requires enabling the workflow's availableInMCP setting; this was enabled for the inactive read-only diagnostic workflow.

- #decision [[cookie-rotation]] [[retry]] [[spotdl]] Approved fix: generic PROVIDER_ERROR should retry once with the alternate cookie without quarantining either cookie; fail only after both are attempted.

- #fact [[cookies]] [[diagnostics]] [[yt-dlp]] At the latest inspection, cookies_010.txt and cookies_011.txt had no expired entries; 010 had recent PROVIDER_ERROR failures, while 011 had a successful download.

- #fact [[docker]] [[networking]] [[bgutil]] The spotDL worker shares retakt-gluetun's network namespace, so localhost bgutil checks must run inside that namespace; host-level port checks are inconclusive.

- #fact [[docker]] [[deployment]] [[spotdl]] The worker image copies /opt/spotdl/spotdl-wrapper.py into /usr/local/bin/spotdl; source changes require rebuilding and recreating the Docker worker to take effect.

- #decision [[cookie-rotation]] [[retry]] [[spotdl]] Approved wrapper behavior: classify PROVIDER_ERROR as retry_with_alternate_cookie, exclude the failed cookie, emit a retry event, and try another cookie without lowering health or quarantining it.

- #decision [[spotdl]] [[cookie-retry]] [[provider-error]] The spotdl worker retries PROVIDER_ERROR with an alternate cookie for the current job without quarantining or lowering cookie health.

- #fact [[deployment]] [[docker]] [[verification]] The deployed retakt-spotdl-worker image was rebuilt and verified healthy; the source and container wrapper hashes matched.

- #lesson [[permissions]] [[spotdl-slots]] [[uid-1001]] The worker runs as UID/GID 1001, so /tmp/spotdl-slots must be writable by that account; root-owned slot files caused a failed request and were corrected.

- #fact [[n8n]] [[workflow]] [[architecture]] The active project workflow is “Spotipy Music Companion v3”; the legacy “spotdl-telegram” workflow is inactive.

- #fact [[lyrics]] [[spotdl]] [[telegram]] The current runner supports configurable lyricsProviders and embeds retrieved lyrics into delivered Telegram audio messages.

- #correction [[cookies]] [[retry]] [[permissions]] Provider-error alternate-cookie retry is deployed; cookie slot directories must be writable by the worker’s UID/GID 1001.

- #workflow [[validation]] [[lyrics]] [[cookies]] [[roadmap]] Before expanding production features, validate the successful run, compare lyrics with the legacy workflow, verify cookie selection and rotation, and use template search to inform the feature plan.

- #decision [[lyrics]] [[telegram]] [[formatting]] Automatic lyrics should be sent with each download when available, using the old lyrics workflow’s rich monospace format; retain /lyrics for a later user-designed feature.

- #workflow [[spotdl]] [[lrc]] [[lyrics]] Use lyrics already returned by spotDL: deliver timestamped lyrics as .lrc and untimestamped lyrics as .txt, while retaining embedded ID3 lyrics as fallback.

- #lesson [[n8n]] [[whisper]] [[lrc]] Template #9589 is reference material only, not a direct import: it generates LRC/SRT through Whisper and GPT, but adds cost, latency, transcription errors, and a 25 MB audio limit.

- #fact [[cookies]] [[spotdl]] [[security]] The downloader’s cookie pool currently contains cookies_001.txt, cookies_002.txt, cookies_010.txt, and cookies_011.txt; cookie contents must not be exposed when checking usability.

- #decision [[cookies]] [[permissions]] [[spotdl]] The Spotify downloader cookie files cookies_001.txt and cookies_002.txt are owned by root:spotdl-runner with mode 640, allowing the worker group to read them.

- #fact [[yt-dlp]] [[cookies]] [[debugging]] yt-dlp simulation against the test YouTube URL failed with exit code 1 for both cookies_001.txt and cookies_002.txt.

- #fact [[n8n]] [[telegram]] [[spotipy]] The active n8n workflow 'Spotipy Music Companion v3' uses a Telegram trigger followed by a JavaScript Code node to normalize music requests.

- #decision [[spotipy]] [[lyrics]] [[workflow]] Spotipy Music Companion v3 should automatically reply to delivered audio with the established rich lyric layout when lyrics are available; keep /lyrics reserved for a separate future feature.

- #workflow [[lyrics]] [[telegram]] [[lrc]] [[n8n]] Automatic rich lyrics should preserve audio delivery, reply to its message, support synced LRC timestamps, escape HTML, split long lyrics below message limits, and skip sending when lyrics are unavailable.

- #fact [[deployment]] [[validation]] [[draft]] The automatic rich-lyrics workflow patch is draft-only: validation succeeded, but operations were not applied; full workflow validation and production update remain pending.

- #decision [[n8n]] [[spotipy]] [[lyrics]] Spotipy Music Companion v3 workflow (8Sviq9pjDE3GFdnF) is active with automatic rich formatted lyric replies; /lyrics remains reserved for future design.

- #fact [[validation]] [[n8n]] [[workflow]] The deployed Spotipy workflow passed strict validation with 20 enabled nodes, 19 valid connections, 29 expressions validated, and zero errors.

- #decision [[lyrics]] [[telegram]] [[formatting]] Automatic rich lyric replies format and escape lyric HTML, highlight LRC timestamps, split oversized lyrics into Telegram-safe chunks, and reply to the delivered audio message.

- #fact [[youtube]] [[cookies]] [[yt-dlp]] cookies_001.txt and cookies_002.txt pass a wrapper-equivalent yt-dlp probe against the tested YouTube Music source.

- #workflow [[spotdl]] [[cookies]] [[rotation]] The SpotDL wrapper selects cookies using Redis-tracked health, cooldown, last-used timestamps, failure thresholds, and rotation across alternate cookies.

- #decision [[spotdl]] [[cookies]] [[provider-error]] spotDL wrapper now rotates away from PROVIDER_ERROR cookies for the current job and applies a separate 15-minute cooldown on later jobs, without lowering cookie health scores.

- #fact [[deployment]] [[spotdl]] [[verification]] The deployed spotDL worker was rebuilt and restarted healthy; source and container wrapper SHA-256 hashes match.

- #fact [[testing]] [[cookies]] [[cooldown]] An isolated runtime test verified provider-error cooldown selection bypasses a cooled cookie in favor of an eligible alternate cookie.

- #fact [[docker]] [[networking]] [[bgutil]] The worker shares the retakt-gluetun network namespace, so its 127.0.0.1:4416 bgutil endpoint must be tested from that namespace rather than the host.

- #lesson [[permissions]] [[docker]] [[testing]] Runtime test slot directories must be writable by the worker account (UID/GID 1001); root-owned directories can block worker operation.

- #decision [[telegram]] [[audio]] [[lyrics]] [[ux]] Telegram song delivery should use one audio message only: remove download-started, download-complete, and separate lyrics messages.

- #preference [[lyrics]] [[caption]] [[telegram]] Fit as much lyric text as possible in the audio caption by removing timestamps and truncating the remainder with an ellipsis; use Telegram's expandable quote when supported.

- #decision [[cookies]] [[cooldown]] [[spotdl]] [[worker]] Provider-error cookie cooldown is configured to 3 minutes (180000 ms); the worker was rebuilt and confirmed healthy with matching wrapper hashes.

- #decision [[spotipy]] [[n8n]] [[telegram]] Spotipy Music Companion v3 (8Sviq9pjDE3GFdnF) was updated with 8 atomic operations to send each audio file as one Telegram message, removing lifecycle and separate lyric messages.

- #workflow [[captions]] [[lyrics]] [[telegram]] [[formatting]] Audio captions strip LRC timestamps, HTML-escape metadata and lyrics, use an expandable Telegram blockquote, preserve metadata, and truncate lyrics at word/line boundaries within 1,024 characters.

- #fact [[testing]] [[captions]] [[telegram]] The caption formatter test passed: timestamps were removed, the expandable quote and truncation marker were present, and visible caption length was 1,018/1,024 characters.

- #fact [[n8n]] [[warnings]] [[workflow]] n8n warned that the Route request Switch connection uses sourceIndex=2 and recommends explicit case=N; the instance also lacks canvas-group support.

- #decision [[spotipy]] [[telegram]] [[lyrics]] [[workflow]] Spotipy Music Companion v3 sends one audio message per track with an expandable Telegram lyric caption; it removes timestamps, truncates at 1,024 characters, and omits separate status or lyric messages.

- #fact [[n8n]] [[validation]] [[workflow]] The active workflow currently has 16 enabled nodes, 15 valid connections, and 23 validated expressions, with zero validation errors.

- #correction [[youtube]] [[spotdl]] [[debugging]] A failed /song execution was caused by YouTube audio download provider errors during cookie rotation, before audio delivery; the caption change was not the cause.

- #lesson [[docker]] [[cookies]] [[permissions]] [[spotdl]] Cookie probes inside retakt-spotdl-worker must account for the container's non-root permissions; direct copying from /app/cookies initially failed with Permission denied.

- #decision [[spotdl]] [[cookie-rotation]] [[retries]] SpotDL worker retries across the full four-cookie pool (`SPOTDL_COOKIE_ATTEMPTS=4`) and is healthy after deployment.

- #preference [[cookie-rotation]] [[performance]] [[user-preference]] User wants fast cookie failover: quickly swap to another cookie when a download fails, minimizing rotation delays.

- #fact [[spotdl]] [[timing]] [[configuration]] Worker settings include a 300-second cookie cooldown and yt-dlp sleeps of 0.5s between requests, then 1–3s between downloads.

- #lesson [[cookies]] [[diagnostics]] [[yt-dlp]] A cookie warning or one provider failure is not sufficient to classify a cookie as expired; validity and provider errors vary by video and session.

- #decision [[spotdl]] [[cookies]] [[rotation]] [[yt-dlp]] SpotDL worker uses fast cookie rotation: least-recently-used healthy cookies, 60s provider-error exclusion, 5m rate-limit exclusion, up to 3 cookies/request, and yt-dlp extractor retries set to 1.

- #workflow [[webhook]] [[telegram]] [[validation]] Before restoring or changing the Telegram workflow, validate the downloader through a webhook and confirm a real successful download.

- #decision [[n8n]] [[spotdl]] [[diagnostic]] [[webhook]] Use an inactive n8n webhook probe to isolate the VPS spotDL download path from Telegram delivery; submit one Spotify track URL and return sanitized diagnostics.

- #workflow [[spotipy]] [[testing]] [[telegram]] The Spotipy download webhook probe accepts POST input via `spotifyUrl` and uses `delivery: 'none'`, so it sends no Telegram messages during testing.

- #workflow [[n8n]] [[validation]] Validate n8n workflows with strict node, connection, and expression checks before creation; the probe passed validation with zero errors but several warnings.

- #correction [[n8n]] [[code-node]] [[validation]] For n8n Code nodes using `$json`, configure execution mode as `runOnceForEachItem` to avoid validation warnings.

- #decision [[n8n]] [[spotdl]] [[webhook]] Created and activated n8n workflow "Spotipy download webhook probe" (ID aPffZXf2zrk4Ak7M), an isolated webhook-only probe with no Telegram delivery nodes.

- #correction [[n8n]] [[code-node]] [[debugging]] In n8n Code nodes using runOnceForEachItem, return a single item object ({json: {...}}), not an array; arrays cause "A 'json' property isn't an object" validation errors.

- #fact [[spotdl]] [[job-id]] [[dispatcher]] The VPS spotDL dispatcher requires numeric hyphenated job IDs; webhook probe IDs use `${Date.now()}-${Math.floor(Math.random() * 1000000)}`.

- #fact [[n8n]] [[testing]] [[spotdl]] The webhook probe workflow passed n8n execution and returned HTTP 200 after fixing Code-node item returns, but the underlying dispatch initially failed with "Invalid jobId" before the numeric ID correction; it was not retested afterward.

- #preference [[caption]] [[formatting]] [[telegram]] Audio captions should format the title in monospace, artist in bold, and album in bold italic.

- #preference [[lyrics]] [[truncation]] [[caption]] When lyrics are clipped, append only “…”; do not include extra text such as “truncated”.

- #lesson [[spotdl]] [[cookies]] [[redis]] [[diagnosis]] Stale Redis cookie rotation health/error keys caused downloads to stop after cookies_010 and cookies_011 failed; clearing legacy rotation state allowed cookies_001 to succeed.

- #decision [[n8n]] [[webhook]] [[telegram]] [[workflow]] The temporary webhook probe validated the shared dispatcher and was deactivated afterward; the existing Telegram workflow remains the sole live delivery route.

- #fact [[n8n]] [[spotify]] [[lyrics]] [[workflow]] In Spotipy Music Companion v3, URL requests return Spotify metadata and lyrics, while title/artist text requests currently use generic search and may lack both.

- #decision [[n8n]] [[spotify]] [[routing]] [[lyrics]] Planned fix: resolve text-based /song requests through Spotify first, select the top result, then pass its Spotify URL to the existing dispatcher for consistent metadata and lyrics.

- #fact [[n8n]] [[spotipy]] [[workflow]] Spotipy Music Companion v3 (workflow 8Sviq9pjDE3GFdnF) is active and passed strict MCP validation on 2026-08-05.

- #decision [[telegram]] [[lyrics]] [[workflow]] The workflow delivers each track as one Telegram audio message with a timestamp-free expandable lyric caption; download status and separate lyric messages were removed.

- #workflow [[testing]] [[telegram]] [[spotdl]] A live chat test remains pending: /help, /search Nude Radiohead, then an authorized /song request and execution inspection.

- #correction [[n8n]] [[workflow-editing]] For n8n Route request, parameters.rules.values is an object, not a string; use updateNode with the full rules.values array rather than patchNodeField string replacement.

- #correction [[spotify]] [[song-resolution]] [[deployment]] The proposed free-text /song Spotify-resolution change was validation-only and was not applied; do not assume it is deployed.

- #decision [[n8n]] [[spotify]] [[song-download]] Spotipy Music Companion v3 now routes free-text /song and /spotify requests without a URL through Spotify search, selecting a Spotify track before spotDL dispatch.

- #fact [[n8n]] [[validation]] [[workflow]] The workflow passes strict validation with 19 nodes, 20 valid connections, and zero errors.

- #correction [[n8n]] [[testing]] [[triggers]] The workflow has no webhook, form, or chat trigger, so webhook-based test execution is unsupported; use the appropriate execution/test method after inspecting its trigger schema.

- #workflow [[n8n]] [[spotify]] [[spotdl]] [[downloads]] Spotipy Music Companion v3 resolves free-text /song and /spotify requests through Spotify track search, selects the first result, then sends its URL to spotDL for metadata and lyrics.

- #fact [[validation]] [[deployment]] [[n8n]] The workflow’s free-text Spotify resolution path is deployed and strict-validated with 19 enabled nodes, 20 valid connections, 26 expressions, and 0 errors.

- #decision [[fuzzy-search]] [[spotify]] [[llm]] Fuzzy matching currently uses Spotify’s ranked search results, not an LLM or custom similarity scoring; the first result is selected for /song, while /search shows up to five results.

- #decision [[spotify]] [[facts]] [[integration]] [[llm]] Plan to add a sourced, approximate per-song Facts section after Spotify track resolution; exact Spotify About the Song cards are not directly available via the public API. LLM implementation remains to be discussed.

- #correction [[caption]] [[facts]] [[lyrics]] [[format]] Caption Facts should be a single italic third line after the title/artist and album, formatted like `[2020 · 13/14 · Label]`; keep lyrics in the expandable block exactly as before, not inside the Facts section.

- #decision [[captions]] [[metadata]] [[lyrics]] Updated Spotipy Music Companion v3 captions: metadata facts appear as a third italic line after the album, while lyrics remain in the expandable block.

- #decision [[facts]] [[track-metadata]] [[formatting]] Caption facts now include release year, track position (e.g. 2/10), and publisher, joined with ·; duration and explicit status were removed.

- #fact [[workflow]] [[validation]] [[n8n]] The workflow update was saved successfully and strict validation passed with zero errors and zero invalid connections.

- #lesson [[n8n]] [[patching]] [[tooling]] For patchNodeField operations, every patch entry must use string fields named find and replace; oldText/newText entries are invalid.

- #decision [[captions]] [[telegram]] [[lyrics]] Spotipy captions use: monospace title, bold artist, bold-italic album, italic `[year · track/total · label]`, then a separate expandable lyrics block; no LLM Facts yet.

- #fact [[telegram]] [[access-control]] [[security]] The Telegram bot has no chat-ID allowlist; anyone who can message it can use it, including potentially group chats.

- #lesson [[n8n]] [[spotdl]] [[monitoring]] Downloader failures are caught and replied to in Telegram, so n8n may report execution status `success`; inspect completion/error fields and downloader nodes instead of relying on top-level status.

- #fact [[spotdl]] [[vps]] [[downloads]] Audio retrieval runs through spotDL on the VPS and can fail after metadata and lyrics succeed due to Spotify token, DNS/network, provider, or cookie issues.

- #fact [[recode]] [[repository]] [[branch]] Recode’s authoritative checkout is C:\Users\re_Lax\Desktop\chat7\re.pi on branch agent-harness; keep the custom Recode product and recode CLI instead of replacing them with upstream Pi.

- #workflow [[safety]] [[git]] [[release]] Do not use destructive Git operations, broad staging, direct upstream merges, raw recode update, or publishing/remote changes without explicit approval.

- #lesson [[downloads]] [[diagnosis]] [[dns]] [[cookies]] Download failures had separate causes: VPS DNS resolution, all currently eligible YouTube cookies failing, and SpotipyFree client-token failure; retries alone cannot fix all three.

- #decision [[spotify]] [[n8n]] [[spotdl]] [[architecture]] The durable metadata fix is to resolve tracks through the official n8n Spotify OAuth node, pass metadata/URL to the VPS, and have the wrapper download by artist-title rather than using SpotipyFree’s private client-token endpoint.

- #correction [[n8n]] [[tools]] For n8n execution retrieval, the executions tool requires the parameter name id for action=get; executionId is rejected.

- #fact [[yt-downloader]] [[redis]] [[healthcheck]] [[configuration]] The yt-downloader worker is unhealthy because REDIS_HOST is hard-coded to stale IP 172.18.0.3; retakt-redis currently uses 172.18.0.4, causing ECONNREFUSED.

- #fact [[docker]] [[networking]] [[gluetun]] yt-worker, yt-bgutil, and spotdl-worker share retakt-gluetun's network namespace via network_mode container:retakt-gluetun.

- #lesson [[redis]] [[docker]] [[reliability]] Use the Docker service name retakt-redis rather than a container IP for Redis connectivity to avoid failures after Redis container recreation or IP changes.

- #fact [[architecture]] [[docker-compose]] [[redis]] [[gluetun]] The yt-downloader compose manages yt-api, yt-worker, and yt-bgutil; Redis and Gluetun are shared external services.

- #fact [[yt-worker]] [[gluetun]] [[warp]] [[bgutil]] yt-worker shares retakt-gluetun's network namespace, routes traffic through WARP, and reaches bgutil at http://127.0.0.1:4416.

- #fact [[spotdl]] [[metadata]] [[cookies]] [[failover]] spotdl-worker shares Gluetun's network namespace and uses retakt-spotdl-metadata:8765 for Spotify metadata, with cookie failover and cooldown settings configured.

- #fact [[spotdl]] [[spotify]] [[normalization]] [[metadata-service]] The spotDL runner normalizes Spotify track inputs to canonical open.spotify.com URLs before processing and can call the metadata service's /save endpoint.

- #fact [[spotdl]] [[failure]] [[spotify-metadata]] [[diagnostics]] Recent spotDL executions 79426 and 79427 failed during Spotify metadata lookup, while 79425 returned track metadata but produced no files and exited with code 4.

- #decision [[spotdl]] [[metadata]] [[download]] The spotDL runner uses the real spotdl binary for metadata collection, then the wrapper for downloading; metadataQuery requires exactly one track and supports optional lyrics providers.

- #decision [[spotdl]] [[spotify]] [[metadata]] The spotDL runner supports explicit Spotify URL override when metadataQuery is used, replacing the metadata song URL before downloading.

- #correction [[docker]] [[redis]] [[worker]] The YouTube worker must reference Redis by Docker service name retakt-redis rather than a hardcoded container IP; after updating compose, the worker became healthy.

- #workflow [[docker]] [[spotdl]] [[debugging]] spotDL is installed inside the retakt-spotdl-worker container, not on the host; inspect its source and runtime with docker exec.

- #decision [[spotipy]] [[spotify]] [[workflow]] Spotipy Music Companion v3 now resolves the first Spotify track URL, builds an artist-title metadata query, and passes spotifyUrl, metadataQuery, and queries downstream.

- #fact [[n8n]] [[validation]] [[spotipy]] The Spotipy Music Companion v3 workflow validated successfully after the update: 19 nodes, 20 valid connections, 26 expressions, and no errors or warnings.

- #lesson [[n8n]] [[webhook]] [[deployment]] Production webhook requests return 404 when the n8n workflow is inactive; activation is required for the production webhook URL to be registered.

- #fact [[n8n]] [[compatibility]] The deployed n8n version does not support canvas groups, so workflow updates may save successfully while dropping node-group metadata.

- #decision [[spotipy]] [[odoriko]] [[n8n]] [[workflow]] The Spotipy one-time Odoriko workflow is saved at workflows/drafts/spotipy-odoriko-send-once.json and is intended to download Vaundy’s “Odoriko” and send exactly one Telegram audio message, followed by cleanup.

- #fact [[n8n]] [[validation]] [[workflow]] The Odoriko workflow was structurally validated successfully: 7 enabled nodes, 6 valid connections, 9 validated expressions, and zero errors.

- #fact [[n8n]] [[credentials]] [[testing]] The workflow has not been manually executed; validation reported missing credential configuration warnings for the SSH and Telegram nodes.

- #decision [[n8n]] [[spotipy]] [[odoriko]] [[workflow]] Created n8n workflow “Spotipy one-time Odoriko delivery” (ID ZcLYIJTHsCSAw5Qs), with webhook dispatch, result parsing, SSH download, Telegram audio delivery, and cleanup.

- #fact [[webhook]] [[timeout]] [[spotdl]] The Odoriko webhook execution completed successfully, but the synchronous HTTP request returned Cloudflare 524 after about 125 seconds because spotDL dispatch took about 121 seconds.

- #fact [[metadata]] [[spotdl]] [[odoriko]] The downloader produced Vaundy-odoriko.mp3 successfully, but returned incomplete metadata: artist, album, duration, and lyrics were null or empty despite metadata_query being set.

- #lesson [[cleanup]] [[spotdl]] [[jobs]] The generated job directory remained on the VPS after the successful execution, indicating cleanup did not run or did not remove the job and needs investigation.

- #workflow [[docker]] [[spotdl]] [[worker]] [[metadata]] The spotDL worker image was rebuilt and recreated after investigating metadata handling in runner.py; verification of the rebuilt worker was initiated but not shown as completed.

- #decision [[n8n]] [[spotify]] [[workflow]] [[routing]] Spotipy Music Companion v3 routes direct Spotify track URLs through official Spotify OAuth metadata before download; workflow validation passed with 20 enabled nodes and 22 valid connections.

- #decision [[spotdl]] [[metadata]] [[spotify]] [[reliability]] The SpotDL runner supports metadataQuery, saving artist/title metadata through spotDL search instead of the fragile private Spotify client-token endpoint.

- #fact [[docker]] [[redis]] [[vps]] [[healthcheck]] The VPS YouTube worker health dependency was repaired by using the retakt-redis service name; SpotDL and YouTube workers report healthy.

- #workflow [[telegram]] [[one-time-workflow]] [[cleanup]] [[delivery]] A one-time Odoriko delivery workflow was successfully used, then deactivated and deleted after delivery; temporary download jobs were cleaned up.

- #decision [[spotify]] [[oauth]] [[direct-links]] Spotipy Music Companion v3 resolves direct Spotify links via the official n8n Spotify OAuth node, then passes artist/title metadata to the VPS runner.

- #decision [[spotdl]] [[metadata]] [[reliability]] The VPS runner uses spotDL text metadata lookup when artist/title metadata is provided, bypassing fragile SpotipyFree client-token lookup while retaining metadata and lyrics.

- #correction [[docker]] [[redis]] [[infrastructure]] The VPS YouTube worker uses the retakt-redis service name instead of a hardcoded Redis IP; both spotDL and YouTube worker containers were verified healthy.

- #fact [[n8n]] [[validation]] [[deployment]] The deployed workflow was validated with 20 enabled nodes, 22 valid connections, 28 expressions, and zero errors or warnings; a runner dry run passed.

- #spotipy [[chat-mode]] [[n8n]] [[spotify]] [[ai-agent]] [[plan]] Chat mode implementation plan approved by Creator: keep one active Spotipy Telegram workflow HYRePy4buI9l4SEk and route /chat inside it. /chat sets per-chat chat mode; subsequent messages use Spotify catalog search only (no downloads, lyrics, or broad tools yet), feed normalized read-only Spotify evidence into the saved AI Agent context, and send the agent reply back to the same Telegram chat. /fast switches back to Fast mode. Reuse saved agent configuration from inactive Spotipy AI Agent v1 (0DvmaRHWbPYQKWSq): qwen3:8b via LM Studio credential, existing system prompt, and spotify_search_catalog tool. Reuse inactive read-only Spotipy Music Data Tool v1 (2nRzAS4MCCB8uKMw), which supports search, album_tracks, artist_albums via Spotify Web API. Current agent test workflow has manual trigger/hardcoded Edit Fields and tool inputs; refactor it or embed its agent configuration for dynamic chat input. Prefer deterministic Spotify lookup before the agent, inject normalized evidence plus user text into agent context, and keep tool data treated as evidence. Do not activate or change production Chat behavior until the implementation plan is shown and explicitly approved.

- #spotipy [[chat-mode]] [[approved]] [[ai-agent]] [[memory]] [[n8n]] Creator approved Chat mode implementation after compaction: wire the AI Agent already inside active Spotipy Fast Mode (HYRePy4buI9l4SEk) into the existing router, configure a strong music-companion system prompt, connect Spotify catalog lookup evidence, and use Simple Memory with Telegram chatId as the per-chat session key and 15-message window. Keep Fast mode behavior unchanged; Chat mode initially has search/lookup only, no downloads or lyrics. Agent uses qwen3:8b through the LM Studio OpenAI-compatible credential. Validate before production testing and keep one active Telegram trigger workflow.

- #vps [[ssh]] [[spotipy]] [[n8n]] [[redis]] [[diagnostics]] VPS SSH endpoint for Spotipy/n8n diagnostics: `root@157.173.127.84`. Credentials/keys are not stored in memory. Verify the SSH host fingerprint before connecting; the previous endpoint `172.86.90.232` presented a host-key mismatch.

- #preference [[download]] [[progress]] [[telegram]] For download progress updates, use randomized stage-based percentages rather than a fixed repeated pattern.

- #decision [[spotify]] [[regex]] [[n8n]] Repair direct Spotify track ID extraction without optional chaining in the regex expression; extract the segment after /track/ and strip query parameters.

- #preference [[telegram]] [[progress]] [[ux]] User prefers Telegram download progress to feel realistic: avoid arbitrary percentages and avoid leaving the status stuck at 0% for a long time.

- #decision [[n8n]] [[downloads]] [[telegram]] Download progress currently sends 0% initially, changes to randomized 82–90% during preparation after dispatch, and is deleted after success or failure.

- #fact [[spotdl]] [[lyrics]] [[runner]] Spotdl lyrics providers are configurable through the runner's lyricsProviders option and passed to spotdl via --lyrics; lyrics are embedded when available.

- #fact [[n8n]] [[validation]] [[spotipy]] The Spotipy Music Companion v3 workflow validates successfully with 27 enabled nodes, 30 valid connections, 39 expressions, and no errors or warnings.

- #decision [[telegram]] [[progress]] [[n8n]] Download progress must use honest stage-based statuses; omit percentages because the current dispatcher does not expose live byte-level progress.

- #correction [[telegram]] [[progress]] [[api]] Telegram sendMessageDraft is not suitable for download progress; use a temporary normal message, edit it during stages, then delete it after success or failure.

- #preference [[lyrics]] [[genius]] [[romanization]] [[i18n]] Lyrics feature should reliably return lyrics for every supported song, including Japanese tracks such as Vaundy’s Odoriko, with readable English/romanized lyrics when appropriate.

- #decision [[lyrics]] [[genius]] [[source-selection]] [[language]] Lyrics fetching needs strong source and language selection logic so Genius lyrics are preferred when available without selecting the wrong language or version.

- #fact [[lyrics]] [[spotdl]] [[providers]] The workflow currently requests lyrics from spotDL providers: genius, musixmatch, azlyrics, and synced.

- #fact [[lyrics]] [[runner]] [[pipeline]] The runner only embeds the lyrics returned in spotDL metadata; it has no lyric retry, candidate comparison, romanized-variant preference, or quality gate.

- #fact [[metadata-sidecar]] [[spotdl]] [[lyrics]] The metadata sidecar passes the configured lyricsProviders directly to spotdl-real save via --lyrics, with no additional resolution or fallback layer.

- #workflow [[spotify]] [[metadata]] [[lyrics]] Spotify-selected tracks already provide canonical metadata such as title, artists, URL, duration, and usually ISRC; lyric queries should be generated from that metadata rather than hardcoded variants.

- #fact [[telegram]] [[captions]] [[lyrics]] Telegram audio captions are limited to 1,024 characters, so full lyrics require a separate message or document.

- #fact [[metadata]] [[odoriko]] [[spotify]] The one-time Odoriko delivery used free-text metadata query “Vaundy - Odoriko” with spotifyUrl null, not the selected Spotify track URL.

- #fact [[genius]] [[lyrics]] [[configuration]] GENIUS_ACCESS_TOKEN is absent from both the spotdl worker and metadata containers, so Genius lyrics lookup is not configured.

- #fact [[lyrics]] [[providers]] [[fallback]] The same Odoriko query returned no lyrics with Genius only, but returned lyrics with the full provider list; fallback providers currently have coverage.

- #fact [[runner]] [[lyrics]] [[metadata]] The runner passes spotDL's lyrics field through directly as `song.get("lyrics") or ""`; it does not discard lyrics later in the pipeline.

- #decision [[spotify]] [[canonical-identity]] [[lyrics]] Spotify’s selected track URL and metadata are the immutable identity for the lyrics/download workflow; free-text lookup must not replace canonical Spotify data.

- #decision [[lyrics]] [[matching]] [[romanization]] [[validation]] Lyrics matching should score title, artist, duration, ISRC, and normalized/romanized variants, reject weak matches, and record source, matched page, variant type, and confidence.

- #fact [[genius]] [[credentials]] [[environment-variables]] Genius credentials are stored on the Windows machine as SPOTID and SPOTSECRET; the Genius client access token is stored as SPOTTOKEN.

- #fact [[spotdl]] [[docker]] [[deployment]] The active spotDL deployment compose file is /opt/spotdl/docker-compose.worker.yml, with retakt-spotdl-worker and a separate retakt-spotdl-metadata service.

- #fact [[spotdl]] [[genius]] [[lyrics]] [[configuration]] spotDL does not automatically consume GENIUS_ACCESS_TOKEN; runners must pass --genius-access-token explicitly when Genius lyrics are requested.

- #lesson [[metadata-sidecar]] [[lyrics]] [[testing]] [[debugging]] The deployed worker path successfully retrieved Genius lyrics after explicitly passing the token, but the metadata sidecar test still returned no lyrics and needs investigation.

- #decision [[lyrics]] [[providers]] [[workflow]] Active workflow provider priority is Musixmatch, then Genius, then Synced, then AZLyrics.

- #lesson [[genius]] [[romanized]] [[lyrics]] Canonical Spotify metadata may use Japanese titles while Genius indexes romanized variants; provider ordering alone cannot resolve this, so a scored Genius candidate resolver is required.

- #correction [[testing]] [[genius]] [[romanized]] The implemented Romanized Genius resolver was not verified: the Odoriko metadata test completed but produced no lyrics or variant metadata.

- #decision [[lyrics]] [[fallback]] [[romanized]] For lyric delivery, prefer Romanized lyrics but accept any verified available lyrics, including Japanese, when Romanized Genius lyrics are unavailable.

- #decision [[genius]] [[lyrics]] [[api]] Genius API remains useful for candidate metadata and ranking, but its blocked lyric-page extraction must not be bypassed; use authorized providers for lyric text.

- #fact [[n8n]] [[testing]] [[spotipy]] The one-time Matsuri/Fujii Kaze workflow executed successfully through all seven nodes and produced lyrics (815 characters); it was deactivated afterward.

- #preference [[speed]] [[music-bot]] User prioritizes fast music delivery and accepts a selection compromise when the exact YouTube or Spotify result is chosen explicitly.

- #decision [[quick-mode]] [[workflow]] [[async-enrichment]] Adopt a quick mode: show search results immediately, download the selected exact video ID, send audio first, then enrich the same message with lyrics and metadata asynchronously.

- #decision [[downloader]] [[performance]] [[architecture]] The delivery-critical path should avoid post-selection source matching, tagging, artwork, and SSH transfer; use a warm direct downloader and defer enrichment.

- #fact [[research]] [[bot]] [[rate-limit]] [[caveat]] A Reddit post for SonidoAlToque_bot claims FLAC/320-kbps MP3, voice recognition, playlists, and a 50-download daily limit to prevent server overload; its relationship to Songnames_finder_bot is unverified.

- #fact [[spotdl]] [[latency]] [[workflow]] The existing music workflow blocks Telegram delivery on synchronous spotDL metadata/lyrics enrichment; this is the primary latency bottleneck.

- #decision [[yt-dlp]] [[quick-path]] [[runner]] A separate quick-download operation was added to the remote runner, using yt-dlp directly and skipping normal spotDL enrichment; it requires exactly one query.

- #fact [[benchmark]] [[youtube]] [[latency]] The quick-path test completed successfully in about 42 seconds, with the actual 4 MB media transfer taking under one second; YouTube extraction/API requests dominated latency.

- #decision [[fast-mode]] [[chat-mode]] [[architecture]] Replace the first-result /quick behavior with two modes: /fast prioritizes speed, while /chat will later introduce an LLM-based experience.

- #decision [[fast-mode]] [[youtube]] [[selection]] Fast mode must fetch 10 YouTube results and present clickable choices; downloading must use the exact selected video ID with no automatic guessing.

- #preference [[workflow]] [[n8n]] [[minimalism]] Keep the Fast-mode workflow minimal, using explicit nodes and avoiding unnecessary connecting or branch-heavy nodes; target roughly 9–11 nodes.

- #decision [[n8n]] [[legacy]] [[telegram]] The existing 27-node Spotipy workflow should be preserved as legacy, while a separate minimal Fast workflow owns the Telegram trigger; both cannot be active for the same bot simultaneously.

- #correction [[lyrics]] [[fast-mode]] The prior first-result fast path was rejected because obscure-song selection was wrong and it omitted lyrics; lyrics in Fast mode are desired if they can be added without delaying initial audio delivery.

- #decision [[spotipy]] [[n8n]] [[workflow]] Spotipy Fast Mode is active as workflow HYRePy4buI9l4SEk; legacy workflow 8Sviq9pjDE3GFdnF is retained inactive.

- #workflow [[fast-mode]] [[telegram]] [[youtube]] Fast Mode persists per-chat /fast state, searches ten YouTube results, and downloads only the exact source selected via inline button.

- #fact [[yt-dlp]] [[quicksearch]] [[downloads]] The worker supports quickSearch for one query and quick downloads for one validated YouTube URL, using yt-dlp android_vr; quickSearch was verified to return ten results.

- #decision [[latency]] [[lyrics]] [[m4a]] Fast Mode intentionally defers lyric enrichment and Spotify resolution to prioritize latency; audio is delivered first as M4A.

- #fact [[validation]] [[n8n]] [[fast-mode]] The Fast Mode n8n workflow passed validation with 15 nodes, 14 valid connections, 26 expressions, and zero errors or warnings.

- #preference [[fast-mode]] [[telegram]] [[ui]] [[brevity]] Fast mode responses should be minimal: acknowledge only “Fast mode enabled” in bold, avoid song-name text, use inline buttons, and do not use emojis.

- #decision [[n8n]] [[telegram]] [[inline-keyboard]] [[fast-mode]] Fast mode should present 10 YouTube results as inline buttons; the fixed Telegram node configuration uses 10 explicit rows with expressions for result text and callback IDs.

- #fact [[fast-mode]] [[callbacks]] [[spotdl]] [[bug]] Fast search callbacks reach the workflow and acknowledge successfully, but selected downloads currently fail at the worker with “Invalid payload”; the dispatch payload/schema needs investigation.

- #lesson [[n8n]] [[telegram]] [[debugging]] [[workflow]] Before changing n8n Telegram behavior, inspect the node’s supported schema and available configuration; dynamic runtime keyboard collections were silently ignored by this node.

- #fact [[youtube]] [[yt-dlp]] [[quick-download]] YouTube quick downloads using yt-dlp's android_vr client fail with bot verification for some URLs, even when cookie files are present.

- #lesson [[youtube]] [[yt-dlp]] [[web-embedded]] [[deno]] The yt-dlp web_embedded client successfully downloaded the test YouTube audio in M4A format and solved the JS challenge via Deno.

- #fact [[telegram]] [[youtube]] [[worker]] Selected YouTube video IDs from the Telegram callback flow reach the download worker correctly; the failure occurs during YouTube media extraction.

- #lesson [[yt-dlp]] [[cookies]] [[filesystem]] yt-dlp may attempt to rewrite a cookie file on exit; mounted cookie files are read-only, so testing with cookies requires copying them to a writable temporary path.

- #decision [[spotipy]] [[fast-mode]] [[spotify]] [[youtube]] Spotipy Fast Mode now searches Spotify first, builds an artist-plus-title YouTube query from the top track candidate, then runs the YouTube search flow.

- #decision [[youtube-search]] [[ranking]] [[yt-dlp]] Fast YouTube search was expanded from 10 to 50 results and ranks results by query-word matches in the title, penalizing repeated words.

- #fact [[yt-dlp]] [[download]] [[web-embedded]] The quick download path uses yt-dlp's web_embedded player client; a direct YouTube URL download completed successfully in about 6.1 seconds.

- #fact [[n8n]] [[validation]] [[workflow]] The updated Spotipy Fast Mode workflow passed runtime validation with 17 enabled nodes, 16 valid connections, 46 expressions, and no errors or warnings.

- #decision [[fast-mode]] [[telegram]] [[search-status]] Fast song search should show “Loading/songs:” while awaiting results, then edit that message to “Loaded/songs:” when the selectable list is ready.

- #decision [[fast-mode]] [[telegram]] [[download-status]] When a song result is clicked, immediately send the short response “Preparing Audio...”, then deliver the audio separately and automatically delete the preparation message.

- #decision [[fast-mode]] [[lyrics]] [[telegram]] [[caption]] Fast mode must send audio immediately, fetch lyrics asynchronously, then edit the same Telegram audio message's caption; do not send a separate lyrics message.

- #decision [[legacy-workflow]] [[lyrics]] [[reuse]] Reuse the existing legacy workflow's lyric providers, fallback logic, and caption formatting instead of rebuilding a separate lyrics flow.

- #decision [[fast-mode]] [[telegram]] [[progress]] Fast mode uses concise Telegram lifecycle feedback: Loading songs, Loaded songs with buttons, Preparing audio, then delete the preparing message after audio delivery.

- #workflow [[workflow-review]] [[fast-mode]] [[lyrics]] Inspect the complete existing workflow and its actual lyrics/caption path before making further Fast-mode changes.

- #decision [[fast-mode]] [[telegram]] [[lyrics]] Fast mode should send audio immediately, then resolve Spotify metadata and lyrics and edit the sent Telegram caption afterward via the direct Bot API.

- #decision [[captions]] [[metadata]] [[lyrics]] [[telegram]] Fast captions should reuse the old format and dynamically display only verified, available metadata fields; missing fields are omitted and the freed space goes to lyrics within Telegram’s 1024-character limit.

- #fact [[n8n]] [[telegram]] [[http-api]] The installed n8n Telegram node lacks editMessageCaption, so caption updates must use an HTTP Request node with Telegram Bot API credentials.

- #workflow [[spotdl]] [[quicklyrics]] [[lyrics]] The spotdl runner gained a quickLyrics operation requiring one validated Spotify URL; a valid test returned metadata and 2335 lyric characters successfully.

- #decision [[spotipy]] [[fast-mode]] [[lyrics]] [[telegram]] Spotipy Fast Mode now asynchronously enriches newly delivered audio captions with lyrics, album/facts metadata, and an optional Spotify link, then edits the same Telegram message.

- #fact [[n8n]] [[validation]] [[workflow]] The caption enrichment flow is implemented and runtime-validated: 24 nodes, 23 valid connections, 55 validated expressions, and no errors or warnings.

- #workflow [[fast-mode]] [[spotify]] [[callbacks]] Caption enrichment requires a fresh Fast search because existing callback buttons do not contain the Spotify track ID.

- #lesson [[lyrics]] [[performance]] [[debugging]] Lyrics enrichment taking about 23 seconds is too slow for the interactive path; investigate the failed/missing caption execution and optimize lookup latency.

- #fact [[recode]] [[repository]] [[branch]] The authoritative Recode checkout is C:\Users\re_Lax\Desktop\chat7\re.pi on branch agent-harness; @reitaard/repi-coding-agent and recode remain the product/package and CLI.

- #workflow [[n8n]] [[validation]] [[documentation]] For new n8n workflows, search templates and nodes, inspect schemas, validate unfamiliar nodes and the complete workflow, then save JSON plus a sibling status/credentials/limitations note.

- #preference [[safety]] [[git]] [[release]] [[approval]] Do not automatically replace Recode with upstream pi, perform destructive Git operations, publish or connect remotely, or execute production workflows without explicit approval.

- #correction [[n8n]] [[mcp]] [[executions]] The n8n community server exposes executions through n8n_community_n8n_executions with action=get/list/delete; use this tool rather than assuming a separate list-executions tool exists.

- #lesson [[n8n]] [[credentials]] [[http-request]] [[telegram]] An n8n HTTP Request URL using credential fields in an expression evaluated to /bot/editMessageCaption; credential values are not reliably available there, so use a supported authenticated-request pattern instead.

- #decision [[lyrics]] [[lrclib]] [[fallback]] Lyrics lookup should try LRCLIB first; if no matching lyrics are returned, fall back to Spotify/spotDL and other configured providers.

- #workflow [[telegram]] [[webhook]] [[testing]] For Telegram caption-edit testing, use a separate webhook test workflow, send a test song, then reconnect the Telegram node to the active workflow.

- #decision [[n8n]] [[telegram]] [[caption-edit]] [[approval]] User approved patching n8n's Telegram integration to support editMessageCaption, restarting n8n, and running repeated test deliveries without exposing bot credentials.

- #decision [[spotipy]] [[lyrics]] [[lrclib]] [[workflow]] Spotipy Fast Mode now performs direct LRCLIB lyrics lookup, falls back to the existing lyrics job, caches Spotify track metadata for 24 hours, and edits the Telegram audio caption with enriched results.

- #workflow [[n8n]] [[telegram]] [[runtime-patch]] Telegram editMessageCaption was added by patching the installed n8n Telegram node executor; the container must run the patch as root because the package files are not writable by the default user.

- #correction [[n8n]] [[validation]] [[telegram]] The patched Telegram caption operation works at runtime after node syntax validation and n8n restart, but the n8n workflow validator still reports editMessageCaption as an invalid Telegram operation.

- #lesson [[n8n]] [[telegram]] [[validation]] Patching Telegram.node.js to add editMessageCaption did not make n8n runtime validation accept the operation; validation still reports it as invalid.

- #correction [[n8n]] [[api]] [[workflow]] n8n workflow activation uses POST /api/v1/workflows/{workflowId}/activate; PATCH with {active:true} is not supported.

- #fact [[spotipy]] [[acid-ghost]] [[webhook]] The Acid Ghost caption-edit webhook test workflow was activated but its execution failed after 116 seconds with HTTP 500; it is not verified as working.

- #correction [[n8n]] [[telegram]] [[workflow]] The n8n Telegram node must expose the text parameter for editMessageCaption; workflows should use text, not caption, for this operation.

- #decision [[lrclib]] [[lyrics]] [[service]] Installed /opt/spotdl/lrclib-lookup.py and /usr/local/sbin/lrclib-lookup. It accepts base64 JSON track metadata, queries LRCLIB, and returns fallback with empty lyrics on invalid input or lookup failure.

- #fact [[lrclib]] [[verification]] [[acid-ghost]] LRCLIB lookup was verified successfully for Acid Ghost’s “Epilogue”, returning source=lrclib and 1297 characters of lyrics.

- #lesson [[n8n]] [[testing]] [[telegram]] n8n workflow tests still failed at Edit Acid Ghost audio caption with “Could not get parameter” before the final Telegram node text-field patch; successful end-to-end execution remains unverified.

- #decision [[lrclib]] [[vps]] [[n8n]] [[lyrics]] LRCLIB lyric lookups were moved from workflow HTTP logic to the VPS helper /usr/local/sbin/lrclib-lookup, invoked through n8n SSH nodes with non-interactive sudo (-n).

- #workflow [[acid-ghost]] [[captions]] [[lrclib]] The Acid Ghost caption workflow now builds a base64 track payload, performs the VPS LRCLIB lookup, and injects returned lyrics into the Telegram caption with fallback behavior.

- #correction [[n8n]] [[telegram]] [[bugfix]] n8n Telegram editMessageCaption failed while reading unsupported additionalFields; the installed Telegram node was patched to skip additional-fields processing for that operation.

- #fact [[testing]] [[acid-ghost]] [[n8n]] After the Telegram node patch and non-interactive sudo change, the Acid Ghost webhook test completed successfully with HTTP 200 and a finished successful execution.

- #decision [[spotipy]] [[search]] [[ranking]] [[fast-mode]] Spotipy Fast Mode now retrieves 10 Spotify candidates and ranks exact or near title matches above popularity before querying YouTube.

- #fact [[spotipy]] [[bug]] [[search-resolution]] The prior mismatch occurred because Spotify returned Robbers as the top result for About You; YouTube correctly searched the incorrectly resolved track.

- #fact [[spotify]] [[preferences]] [[api]] Spotify API search does not expose personal search history; available preference signals include recently played tracks, saved tracks, followed artists, and playlists.

- #decision [[spotify]] [[search]] [[exact-match]] [[fast-mode]] Fast-mode Spotify selection uses exact normalized title matching among 10 Spotify results; it selects the exact title or falls back to Spotify’s first result, without preference/popularity/fuzzy reranking.

- #fact [[n8n]] [[spotipy]] [[workflow]] The fix was applied in place to the existing active “Spotipy Fast Mode” n8n workflow, not created as a separate workflow.

- #fact [[n8n]] [[workflow-count]] The n8n instance currently lists 21 workflows in total.

- #decision [[spotipy]] [[n8n]] [[telegram]] [[architecture]] Keep one active Telegram workflow, Spotipy Fast Mode (HYRePy4buI9l4SEk), and route /chat within it to avoid webhook conflicts.

- #decision [[chat-mode]] [[spotify]] [[scope]] [[agent]] Chat mode should activate with /chat, use Spotify catalog search/lookup only, feed verified results to the saved agent, and reply in Telegram. No downloads or lyrics yet.

- #fact [[spotify]] [[n8n]] [[read-only]] [[tools]] Spotipy Music Data Tool v1 is an inactive read-only workflow supporting Spotify search, album_tracks, and artist_albums operations.

- #correction [[ai-agent]] [[lm-studio]] [[memory]] Spotipy AI Agent v1 still contains the old manual trigger and hardcoded test input; the inspected workflow did not show the claimed 15-message memory configuration.

- #fact [[spotipy]] [[n8n]] [[workflow]] The active workflow is “Spotipy Fast Mode” (HYRePy4buI9l4SEk); preserve existing Fast mode behavior when implementing Chat mode.

- #decision [[chat-mode]] [[music-companion]] [[spotify]] [[lm-studio]] Approved Chat mode scope: build a proper music companion using qwen3:8b via LM Studio, Spotify catalog lookup only initially; no downloads or lyrics.

- #decision [[chat-mode]] [[telegram]] [[memory]] [[n8n]] Chat mode should route through the existing router, reply in Telegram, and use Simple Memory keyed by Telegram chatId with a 15-message window.

- #lesson [[validation]] [[telegram]] [[fast-mode]] Before production testing, validate the workflow; the current validation error is an invalid Telegram editMessageCaption operation in “Edit Fast audio caption.”

- #decision [[spotipy]] [[chat-mode]] [[telegram]] Spotipy Fast Mode will add a /chat branch while preserving the existing Fast download flow; /chat enables per-Telegram-chat mode and /fast restores Fast mode.

- #workflow [[spotify]] [[read-only]] [[ai-agent]] Chat mode performs a read-only Spotify catalog prefetch via Spotipy Music Data Tool v1, injects normalized evidence into the agent context, and permits one additional lookup if evidence is insufficient.

- #decision [[memory]] [[safety]] [[chat-mode]] Chat mode reuses the qwen3:8b model and Simple Memory keyed by Telegram chatId with a 15-message context window; it excludes downloads, playback, lyrics, and expanded tools.

- #fact [[n8n]] [[validation]] [[sub-workflow]] The Execute Sub-workflow and Call n8n Sub-Workflow Tool configurations for Spotipy Music Data Tool v1 validated successfully with no errors or warnings.

- #decision [[chat-mode]] [[spotify]] [[architecture]] The proposed Spotify-only Chat mode routes /chat messages to an AI Agent with Spotify catalog evidence; downloads, playback, queues, lyrics, web search, and listening history remain unavailable.

- #decision [[memory]] [[telegram]] [[chat-mode]] Chat mode is designed to use per-chat Simple Memory keyed by Telegram chatId, with a 15-message context window.

- #fact [[deployment]] [[validation]] [[n8n]] The Chat mode patch was validated successfully with n8n validateOnly, but was not applied to the workflow.

- #fact [[n8n]] [[spotipy]] [[chat-mode]] The active n8n workflow “Spotipy Fast Mode” (HYRePy4buI9l4SEk) still contains only fast-chat state routing; attempted Chat mode updates were not confirmed as applied.

- #fact [[n8n]] [[spotipy]] [[workflow]] The n8n workflow “Spotipy Fast Mode” has ID HYRePy4buI9l4SEk and was active when inspected.

- #lesson [[n8n]] [[chat-mode]] [[deployment]] The attempted Chat mode update did not land: the MCP mutation failed schema validation, and the direct REST fallback could not run because API environment variables were unavailable.

- #fact [[workflow-update]] [[validation]] [[rollback]] The partial workflow update handler validates the workflow before and after applying operations, and refuses to save changes that leave structural validation errors.

- #fact [[workflow-settings]] [[merge]] Workflow settings updates are applied by shallow-merging the supplied settings into the existing workflow settings object.

- #fact [[n8n]] [[spotipy-fast-mode]] The Spotipy Fast Mode n8n workflow has ID HYRePy4buI9l4SEk, is active, and contains 30 nodes with 25 connections.

- #decision [[n8n]] [[spotipy]] [[chat-mode]] Active n8n workflow HYRePy4buI9l4SEk is Spotipy Fast Mode; initial Spotify-only Chat wiring is planned but the workflow remained unchanged after failed update attempts.

- #correction [[n8n]] [[rest]] [[workflow-settings]] n8n REST workflow updates must omit binaryMode from settings even though GET returns it; executionOrder is accepted.

- #decision [[spotipy]] [[telegram]] [[lyrics]] [[workflow]] Spotipy Music Companion v3 delivers each audio track as one Telegram message with an expandable HTML lyric caption, removing separate start, completion, and lyric messages.

- #fact [[telegram]] [[caption-limit]] [[lyrics]] Telegram captions are limited to 1,024 characters after entity parsing; lyric captions should truncate at a word or line boundary and append an ellipsis.

- #correction [[n8n]] [[telegram]] [[fast-mode]] [[validation]] n8n publication of Spotipy Fast Mode fails when the Telegram editMessageCaption node lacks required chatId, messageId, and text parameters.

- #preference [[n8n]] [[deployment]] [[user-constraint]] User approved publishing the dependency, but requires publishing before deactivation; do not deactivate workflows first.

- #fact [[spotipy]] [[n8n]] [[subworkflow]] Spotipy Music Data Tool v1 (2nRzAS4MCCB8uKMw) validated successfully and was activated/published.

- #fact [[spotipy]] [[n8n]] [[deployment]] [[blocker]] Spotipy Fast Mode draft contains 36 nodes, but activation was rate-limited and left it inactive with no published version; deployment is not confirmed.

- #lesson [[n8n]] [[telegram]] [[validation]] Strict validation flags the Telegram Edit Fast audio caption node's editMessageCaption operation as unsupported by the stock schema; investigate before relying on validation as proof of readiness.

- #decision [[spotipy]] [[n8n]] [[chat-mode]] Spotipy Fast Mode workflow HYRePy4buI9l4SEk now includes a /chat branch using read-only Spotify prefetch evidence, qwen3:8b, per-chat memory, and no download/playback/lyrics tools.

- #decision [[memory]] [[telegram]] [[chat-mode]] Chat mode reuses Simple Memory with Telegram chatId as the session key and a 15-message context window.

- #correction [[n8n]] [[code-node]] [[bug-fix]] The Build Chat agent context Code node runs once per item and must return a single object, not an array; this correction was applied and the workflow was reactivated.

- #fact [[n8n]] [[validation]] [[telegram]] After activation retries, Spotipy Fast Mode HYRePy4buI9l4SEk is active; validation still reports one known unrelated error in Edit Fast audio caption for unsupported editMessageCaption.

- #fact [[spotipy]] [[n8n]] [[workflow]] [[spotify]] Spotipy Fast Mode uses the active published Spotipy Music Data Tool v1 workflow (ID 2nRzAS4MCCB8uKMw) as its Spotify search backend; both workflows are MCP-enabled and active.

- #fact [[n8n]] [[triggers]] [[api]] The n8n test workflow API can externally trigger only active workflows with webhook, form, or chat triggers; Telegram, schedule, and manual triggers are unsupported.

- #fact [[n8n]] [[webhook]] [[intent-routing]] Workflow HYRePy4buI9l4SEk uses a webhook entry and Parse Fast input to route search, select, and fastMode intents.

- #workflow [[n8n]] [[debugging]] [[executions]] Inspect n8n workflow behavior with n8n_community_n8n_executions: list executions by workflowId, then get a run with filtered node names and input data.

- #decision [[spotipy]] [[chat]] [[spotify]] [[scope]] Spotipy Chat is intentionally read-only: Spotify catalog search/lookup only; downloads, playback, queues, lyrics, web search, listening history, and popularity ranking are unavailable.

- #decision [[telegram]] [[formatting]] [[chat]] Spotipy Chat replies should be concise Telegram HTML: usually 1–4 short lines, under ~600 characters, with only supported tags and no Markdown, tables, raw URLs, or unsupported tags.

- #correction [[n8n]] [[telegram]] [[validation]] [[fast-mode]] The Fast caption node has runtime fields restored, but strict validation rejects its custom `editMessageCaption` operation as unsupported by the installed Telegram node schema.

- #fact [[n8n]] [[deployment]] [[rate-limit]] Spotipy Fast Mode changes were saved, but activation failed due to service rate limiting; the workflow is currently inactive.

- #lesson [[testing]] [[chat]] [[n8n]] Fast-mode executions must not be treated as Chat tests; a real `/chat` message is required to verify Chat behavior after deployment.

- #decision [[n8n]] [[deployment]] [[spotify]] Workflow HYRePy4buI9l4SEk (Spotipy Fast Mode) was published and is active at version 6e6eeb61-8a5b-4e73-93ff-c106b88a1ec2.

- #fact [[n8n]] [[telegram]] [[webhook]] Telegram production webhooks use /webhook/<Telegram-trigger-webhookId>/webhook; the workflow ID is not the trigger webhook ID.

- #correction [[n8n]] [[testing]] [[telegram]] n8n_official_execute_workflow cannot directly execute Telegram Trigger workflows; it supports Schedule, Webhook, Form, and Chat triggers only.

- #fact [[n8n]] [[spotify]] [[testing]] The Spotipy search dependency was successfully tested with n8n pin data using a Radiohead track search; execution 79504 completed successfully.

- #workflow [[telegram]] [[chat-mode]] [[regression-test]] The Telegram chat-mode regression sequence is tested by sending `/chat`, waiting briefly, then sending a natural-language request; both webhook executions completed successfully.

- #correction [[test-harness]] [[git-bash]] [[telegram]] Git Bash can rewrite a positional `/chat` argument into a Windows path. Pass webhook test text through the TEST_TEXT environment variable to preserve slash commands.

- #workflow [[telegram]] [[webhook]] [[testing]] Telegram webhook tests require the Telegram secret-token header in the synthetic request.

- #fact [[n8n]] [[chat]] [[telegram]] [[workflow]] The /chat workflow reached the intended chat branch and completed end-to-end delivery through the published sub-workflow, LM Studio agent, memory, HTML formatting, and Telegram.

- #lesson [[telegram]] [[testing]] [[webhook]] Controlled Telegram webhook tests must use an existing message_id; synthetic IDs cause Confirm Chat mode to fail because Telegram validates reply targets.

- #decision [[spotify]] [[recommendations]] [[query-extraction]] [[n8n]] Spotify chat query extraction was improved to derive concrete subjects/types and treat broad recommendations separately; the agent should ask for preferences and avoid presenting unrelated catalog hits as matches.

- #decision [[n8n]] [[chat-memory]] [[follow-up]] [[spotify]] Spotipy Fast Mode treats contextual follow-ups such as “make it moodier” or “another one” as conversation-based requests, suppressing unrelated Spotify search results and using the 15-message memory window.

- #correction [[n8n]] [[data-flow]] [[workflow]] Build Chat agent context must read the enriched Build Chat Spotify request node, not Parse Fast input, so spotifyFollowUp metadata reaches the agent.

- #fact [[n8n]] [[testing]] [[deployment]] After workflow changes, Spotipy Fast Mode was published and the contextual follow-up test completed successfully as execution 79524.

- #decision [[spotify]] [[grounding]] [[safety]] Spotipy must not invent track names, URLs, release details, or recommendations when Spotify evidence is empty; it should use recent conversation context or ask one concise clarification.

- #workflow [[follow-up]] [[conversation-context]] [[spotify]] Contextual follow-ups such as “Make it moodier” ignore unrelated fresh Spotify searches and refine the prior conversation instead of claiming a new search result.

- #decision [[spotipy]] [[chat-mode]] [[n8n]] [[published]] Spotipy Fast Mode Chat is published as version bf402dd7-7759-432e-a626-8d3fff7f3db6; Chat uses Spotify grounding, chatId-keyed 15-message memory, concise HTML replies, and contextual follow-ups.

- #correction [[fast-mode]] [[n8n]] [[wiring]] [[bug]] The Fast branch has a real wiring issue: Edit Fast audio caption references a variable unavailable in that node. Inspect incoming data and replace expressions with fields from the actual upstream item.

- #decision [[spotipy]] [[fast-mode]] [[caption]] [[n8n]] Spotipy Fast Mode caption fix is published and active; Edit Fast audio caption uses chatId, audioMessageId, caption, and HTML parse mode.

- #preference [[spotipy]] [[testing]] [[deployment]] For Spotipy Fast Mode changes, the user prefers publishing without triggering a production test and tests the workflow themselves.

- #decision [[spotipy]] [[downloads]] [[song-selection]] Song downloads must verify the correct track from three candidate options before downloading, prioritizing accuracy over speed.

- #decision [[spotipy]] [[background-jobs]] [[song-facts]] [[telegram]] While a verified download runs in the background, Spotipy should immediately send a fast song fact and continue the conversation; the audio may be delivered asynchronously later.

- #lesson [[spotipy]] [[spam-control]] [[debounce]] [[idempotency]] Protect agent processing from message spam with durable per-chat state, debouncing, serialized job control, and idempotency; do not pass every incoming message directly into an unconstrained agent flow.

- #fact [[n8n]] [[queue-mode]] [[data-table]] [[concurrency]] For n8n background processing, queue mode uses Redis and workers; persisted Data Table state supports upsert, while Redis/Postgres provide stronger concurrency guarantees.

- #fact [[spotipy]] [[n8n]] [[publishing]] [[validation]] Spotipy Fast Mode was republished with the updated system prompt and restored Fast caption expressions, but no production test was run and strict validation still reports the custom editMessageCaption schema error.

- #decision [[spotipy]] [[phases]] [[facts]] [[download]] Implement the song feature in two phases: first validate selection, facts, callbacks, chat continuation, and memory; add background downloading and verified delivery only afterward.

- #workflow [[chat-mode]] [[spam]] [[queue]] [[memory]] Chat mode must serialize per chatId: one active LLM run, one pending/latest message slot, duplicate update suppression, priority commands/callbacks, and response persistence before processing pending input.

- #decision [[n8n]] [[locking]] [[redis]] [[prototype]] Prototype chat locking may use n8n workflow state or Data Tables; Redis/Postgres atomic locking is planned later for reliable multi-worker concurrency.

- #fact [[spotipy]] [[chat-mode]] [[spotify]] [[fast-mode]] The published Chat Mode wiring uses a read-only Spotify prelookup, Qwen/LM Studio, and 15-message per-chat memory; it excludes downloads and other expanded tools, while /fast restores the existing download branch.

- #decision [[spotipy]] [[chat-mode]] [[serialization]] [[prototype]] Implement only Step 1 first: prototype Chat-mode serialization with update deduplication, one active LLM run per chat, one pending/latest slot, priority commands/callbacks, and bounded 15-message memory.

- #decision [[spotipy]] [[fast-mode]] [[chat-mode]] Keep Fast mode unchanged while implementing and testing Chat-mode serialization.

- #decision [[spotipy]] [[locking]] [[redis]] [[prototype]] Defer Redis/Postgres atomic locking until the Chat-mode prototype is tested; use the prototype’s static/Data Table approach initially.

- #fact [[n8n]] [[spotipy]] [[workflow]] [[chat-mode]] The active n8n workflow is Spotipy Fast Mode, ID HYRePy4buI9l4SEk; its active graph already includes Chat mode with Spotify lookup and agent replies.

- #fact [[n8n]] [[workflow]] [[chat-mode]] [[validation]] The proposed Chat-mode serialization changes for n8n workflow HYRePy4buI9l4SEk were validation-only and were not applied or saved.

- #decision [[chat-mode]] [[serialization]] [[concurrency]] [[fast-mode]] The Chat-mode prototype is intended to serialize requests per chat, deduplicate updates, support cancellation, queue the latest pending request, and leave Fast mode unchanged.

- #decision [[chat-mode]] [[serialization]] [[queue]] Chat mode uses per-chat serialization: one active request plus a single latest pending request; pending input is processed after the current reply, with a 180-second stale-lock reset.

- #workflow [[chat-mode]] [[cancel]] [[fast-mode]] Chat mode supports /cancel, which clears queued input and marks the active turn cancelled; switching to /fast also clears the Chat session state.

- #decision [[telegram]] [[deduplication]] [[idempotency]] Telegram updates are deduplicated using workflow static chatEvents keyed by update_id, with entries retained for 24 hours.

- #correction [[chat-mode]] [[n8n]] [[request-context]] Chat context and reply preparation use the last Build Chat Spotify request item so serialized turns retain the current request context.

- #lesson [[n8n]] [[workflow-updates]] [[verification]] When applying multi-operation workflow patches, verify the applied operation count; the first call applied only four code patches and omitted the node/connection batch, requiring a follow-up repair.

- #decision [[spotipy]] [[n8n]] [[chat-mode]] [[serialization]] Spotipy Fast Mode workflow HYRePy4buI9l4SEk has prototype Chat serialization: update deduplication, one active LLM run per chat, one latest pending message, busy-notification throttling, and /cancel handling.

- #lesson [[n8n]] [[concurrency]] [[scaling]] [[locking]] Chat serialization uses workflow static data and is prototype-only; Redis or PostgreSQL locking is required before multi-worker or queue-mode scaling.

- #fact [[n8n]] [[validation]] [[workflow]] The active workflow passed partial-update dry-run and connection/expression validation: 40 enabled nodes, 41 valid connections, 70 expressions, and zero invalid connections.

- #correction [[telegram]] [[n8n]] [[validation]] [[caption]] Strict validation reports one known error: the instance-supported Telegram editMessageCaption operation is not recognized by the community schema and was intentionally preserved for runtime behavior.

- #workflow [[testing]] [[telegram]] [[chat-mode]] [[spotipy]] Controlled testing should verify Chat mode, rapid-message serialization, duplicate suppression, pending-message cancellation, correct reply attachment, and unchanged Fast-mode behavior before further wiring.

- #correction [[webhook]] [[cloudflare]] [[diagnostic]] The public n8n webhook is reachable; Cloudflare 1010 filtered Python-like requests, while browser-like requests reached n8n. A real /chat POST was rejected by n8n because its Telegram secret was invalid, not due to rate limiting.

- #workflow [[telegram]] [[testing]] [[webhook]] A controlled synthetic Telegram /chat POST was attempted on the production webhook, but failed secret validation. Do not treat this as a successful live workflow test or proceed to the next phase.

- #decision [[spotipy]] [[chat-mode]] [[serialization]] [[step1]] Active Spotipy Fast Mode has Step 1 chat serialization: update_id deduplication, one active LLM run per chat, one latest pending message, throttled busy notices, /cancel, and continuation routing. Fast mode was preserved.

- #fact [[n8n]] [[telegram]] [[testing]] [[limitation]] n8n MCP cannot execute Telegram-triggered workflows, so live Chat testing requires Telegram input or a correctly authenticated production webhook request.

- #correction [[n8n]] [[telegram]] [[webhook]] This n8n Telegram Trigger requires the correctly derived secret header; omitting the underscore separator causes a 403 invalid-secret response.

- #lesson [[telegram]] [[reply]] [[testing]] Telegram replies using reply_to_message_id require an existing Telegram message ID; fabricated IDs cause a Bad request error.

- #fact [[n8n]] [[telegram]] [[chat-mode]] The workflow's /chat confirmation path passes end-to-end when the test payload uses a valid Telegram message context.

- #lesson [[n8n]] [[chat]] [[concurrency]] [[locking]] Static workflow data does not atomically serialize concurrent Chat webhook executions; overlapping requests all ran the full path. Replace it with an atomic lock/store before Phase 1.

- #decision [[release-gate]] [[redis]] [[postgresql]] [[workflow]] Serialization testing is a release gate: do not add Phase 1 facts or downloads until Chat concurrency is fixed with Redis, PostgreSQL, or an equivalent atomic n8n-backed lock.

- #fact [[telegram]] [[webhook]] [[chat]] [[testing]] The production webhook and Chat delivery path completed successfully in executions 79573 and 79574.

- #lesson [[spotify]] [[grounding]] [[error-handling]] When Spotify lookup fails, the Chat branch should ground its response and avoid inventing catalog facts.

- #lesson [[chat-mode]] [[serialization]] [[concurrency]] [[redis]] Chat serialization failed: n8n static-data locks are not atomic across concurrent executions. Replace with an atomic Redis/Postgres lock before Phase 1.

- #fact [[redis]] [[n8n]] [[docker]] [[networking]] VPS Redis is healthy (7.4.9) in container retakt-redis, but n8n and Redis are on separate Docker networks and n8n cannot resolve the Redis service name.

- #decision [[redis]] [[n8n]] [[networking]] [[architecture]] Long-term architecture choice: create a dedicated Docker network shared only by n8n and Redis, rather than attaching n8n to the broad retakt-network.

- #fact [[vps]] [[ssh]] [[diagnostics]] VPS SSH endpoint for diagnostics is root@157.173.127.84; verify its host fingerprint before connecting. Do not store credentials or keys.

- #decision [[docker]] [[redis]] [[n8n]] [[networking]] Dedicated external Docker bridge network `n8n-redis` connects only n8n and retakt-redis; persisted in both owning Compose files. DNS and Redis PING from n8n were verified successfully.

- #workflow [[n8n]] [[validation]] [[security]] Before changing an n8n production workflow, validate the workflow artifact and avoid placing secrets in workflow JSON or notes.

- #fact [[spotipy]] [[n8n]] [[workflow]] The Spotipy Fast Mode workflow has ID HYRePy4buI9l4SEk and is currently active.

- #decision [[redis]] [[credentials]] [[locking]] A Redis credential named "Spotipy Redis lock" was created for retakt-redis:6379, database 0, without TLS or password.

- #fact [[n8n]] [[redis]] [[incr]] The n8n Redis node uses typeVersion 1; its atomic Increment operation outputs the incremented integer under a property named after the Redis key.

- #fact [[n8n]] [[execute-command]] [[configuration]] The n8n Execute Command node uses typeVersion 1 and requires the command in the top-level config.command field.

- #fact [[n8n]] [[docker]] [[redis]] The n8n container lacks redis-cli but includes nc at /usr/bin/nc and busybox.

- #workflow [[redis]] [[nc]] [[resp]] [[workaround]] Redis can be accessed from an Execute Command node by base64-decoding a RESP command and piping it to nc targeting retakt-redis:6379.

- #fact [[redis]] [[cleanup]] [[connections]] The Redis node cleanup attempts client.quit(), then falls back to client.disconnect() if quitting fails, preventing leaked connections.

- #correction [[n8n]] [[redis]] [[workflow]] [[validation]] The Redis admission, locking, pending, cancellation, and completion nodes were added without connections; n8n validation rejected the update as structurally invalid. Wire them into the workflow before applying.

- #fact [[n8n]] [[workflow]] [[deployment]] The attempted workflow update was validation-only and was not applied.

- #lesson [[n8n]] [[workflow-update]] [[rollback]] The attempted n8n workflow patch failed schema validation due to additional request properties; the workflow was rolled back with no partial mutation applied.

- #fact [[n8n]] [[canvas-groups]] [[compatibility]] The connected n8n version does not support canvas groups; saves omit them.

- #fact [[n8n]] [[workflow-diff]] [[api]] The n8n MCP workflow-diff API supports node, connection, metadata, activation, and transfer operations, with optional validateOnly and continueOnError flags.

- #workflow [[n8n]] [[connections]] [[if-nodes]] [[ai]] For n8n workflow connections, use semantic branch="true"/"false" for IF nodes and sourceOutput values such as "ai_languageModel" or "ai_tool" for AI connections.

- #fact [[n8n]] [[workflow]] [[rollback]] Workflow updates are atomic and roll back completely when validation fails; an attempted patch was restored because this n8n version does not recognize n8n-nodes-base.executeCommand.

- #lesson [[mcp]] [[workflow]] [[validation]] The local MCP workflow-update wrapper rejects unsupported top-level metadata fields; retry patches without such fields.

- #decision [[n8n]] [[redis]] [[ssh]] [[deployment]] The n8n instance does not support Execute Command; Redis lock and event operations must run through recognized SSH nodes invoking docker exec retakt-redis redis-cli atomically.

- #decision [[spotipy]] [[redis]] [[chat]] [[workflow]] Workflow Spotipy Fast Mode was updated successfully with Redis-based event deduplication, per-chat locking, pending requests, cancellation, and completion handling.

- #correction [[n8n]] [[telegram]] [[validation]] Strict validation currently fails because Telegram node operation editMessageCaption is unsupported; editMessageText is a supported alternative.

- #decision [[spotipy]] [[redis]] [[ssh]] [[n8n]] Spotipy Fast Mode uses raw Redis RESP commands over loopback via nc and atomic Redis Lua scripts because the SSH credential cannot access Docker or sudo.

- #fact [[ssh]] [[redis]] [[permissions]] The workflow's SSH credential lacks Docker-group and sudo access; Redis is bound to 127.0.0.1:6379 on the VPS.

- #fact [[spotipy]] [[n8n]] [[testing]] Spotipy Fast Mode workflow HYRePy4buI9l4SEk is active and its Chat webhook smoke tests completed successfully at the n8n execution level.

- #correction [[n8n]] [[telegram]] [[validation]] Strict validation still reports one known error: the Telegram node operation editMessageCaption is unsupported; editMessageText is a supported alternative.

- #workflow [[n8n]] [[redis]] [[chat-lock]] [[queue]] Spotipy Fast Mode uses Redis for event admission, a per-chat atomic lock, busy notices, latest-message pending storage, and cancellation state.

- #fact [[redis]] [[smoke-test]] [[chat]] The Redis smoke test succeeded: event admission returned first, the chat lock was acquired, a reply was delivered, completion returned chatDone, and the lock was released.

- #correction [[parser]] [[redis]] [[bug-fix]] [[concurrency]] An overlap test exposed a completion-parser bug: valid pending JSON without an intent field was misclassified as chatDone. The evaluator was updated to recognize pending payloads by query and updateId.

- #fact [[validation]] [[n8n]] [[telegram]] [[redis]] Strict workflow validation remains invalid due to an unsupported Telegram editMessageCaption operation and Redis builder code nodes returning arrays without json wrappers.

- #decision [[n8n]] [[redis]] [[validation]] In the Spotipy Fast Mode n8n workflow, inline RESP construction in five Redis Code nodes resolves strict return-shape validation errors.

- #fact [[n8n]] [[telegram]] [[validation]] Spotipy Fast Mode strict validation currently has one remaining error: Telegram node operation editMessageCaption is unsupported.

- #fact [[n8n]] [[overlap]] [[testing]] The corrected Spotipy Fast Mode overlap flow completed two-message testing with successful webhook executions.

- #decision [[n8n]] [[telegram]] [[chatpending]] [[workflow]] The Spotipy Fast Mode workflow uses a dedicated pending Chat chain for overlapping Telegram requests because direct n8n cycle continuation was unreliable.

- #workflow [[spotify]] [[memory]] [[redis]] [[telegram]] The pending Chat chain preserves Spotify catalog grounding, AI-agent context, conversation memory, Telegram reply delivery, and Redis completion/lock-release handling.

- #fact [[redis]] [[chatpending]] [[locking]] [[handoff]] Redis handoff payloads are identified as chatPending and use per-chat pending and cancellation keys alongside a lock key.

- #correction [[n8n]] [[telegram]] [[validation]] n8n Telegram nodes do not support the editMessageCaption operation; editMessageText is a supported alternative.

- #decision [[spotipy]] [[redis]] [[chat-serialization]] Spotipy Fast Mode uses Redis atomic lock, pending, and cancel keys to serialize Chat runs per Telegram chat; overlapping webhook tests completed successfully.

- #correction [[spotipy]] [[n8n]] [[error-handling]] Chat completion safely handles an unexecuted pending-request node with try/catch, falling back to the original Chat request; this fixes the prior completion error.

- #decision [[spotipy]] [[follow-up]] [[context]] Pending Spotify follow-ups treat conversation memory as primary context and ignore unrelated fresh search results.

- #fact [[n8n]] [[validation]] [[telegram]] Strict workflow validation still reports the Telegram editMessageCaption operation as unsupported by the community schema, despite the workflow being saved and runtime tests succeeding.

- #decision [[spotipy]] [[n8n]] [[workflow]] Spotipy Music Companion v3 is drafted but inactive. It consolidates Telegram search/download handling into one synchronous workflow; RPC chat-agent and async queue paths are excluded, and rich lyrics are deferred until the basic bot is stable.

- #fact [[redis]] [[chat]] [[serialization]] [[n8n]] Redis-backed Chat serialization is active in workflow HYRePy4buI9l4SEk. Overlapping messages use one active run plus a latest pending slot; the overlap test passed and Redis keys were cleaned up afterward.

- #decision [[spotify]] [[chat]] [[downloads]] [[roadmap]] Spotify Chat downloads remain deferred until the facts and candidate-selection phase is implemented and tested; Fast mode is preserved.

- #lesson [[testing]] [[telegram]] [[regression]] [[redis]] The cancellation regression was inconclusive because test updates used nonexistent Telegram message IDs, causing reply failures. Future Telegram reply tests must use a valid message reference; Redis branches did execute.

- #decision [[n8n]] [[redis]] [[chat-serialization]] Active workflow HYRePy4buI9l4SEk uses atomic per-chat Redis locking with TTL, latest-message queuing, busy throttling, cancellation, and lock-safe completion.

- #fact [[testing]] [[redis]] [[cancellation]] Serialization and cancellation regression tests passed; Redis lock, pending, and cancel keys were cleared afterward.

- #decision [[chat]] [[fast-mode]] [[downloads]] Fast mode and custom editMessageCaption behavior were preserved; Chat downloads remain disabled.

- #fact [[validation]] [[n8n]] [[schema-error]] Workflow validation passed with 62 nodes, 66 valid connections, and 85 expressions; one pre-existing editMessageCaption schema error remains.

- #workflow [[documentation]] [[workflow-draft]] Regression notes are maintained in workflows/drafts/spotipy-chat-serialization-step1.md and its companion patch JSON.

- #decision [[spotipy]] [[phased-implementation]] [[chat-mode]] [[download]] Implement song understanding/download in phases: Phase 1 covers selection, facts, callbacks, Chat continuation, and bounded serialization; defer downloads to Phase 2.

- #fact [[redis]] [[serialization]] [[concurrency]] [[telegram]] Spotipy Fast Mode uses an atomic per-chat Redis lock with one bounded pending/latest message, five-second busy-notification rate limiting, duplicate update suppression, and /cancel handling.

- #fact [[validation]] [[phase1]] [[redis]] [[spotipy]] The Redis-backed Chat serialization gate passed smoke and overlap tests; Phase 1 facts and candidate selection are unblocked, while downloads remain deferred.

- #workflow [[n8n]] [[validation]] [[safety]] For n8n changes, follow the MCP workflow: inspect skills and schemas, validate drafts before mutation, preserve credentials by name only, and keep workflow JSON plus a sibling status note.

- #decision [[spotify]] [[phase-1]] [[scope]] Phase 1 prioritizes Spotify selection, grounded facts, callbacks, serialization, memory, and follow-ups; downloads are deferred to Phase 2.

- #decision [[spotify]] [[workflow]] [[callbacks]] Extend the existing read-only Spotify workflow with track-by-ID evidence and candidate selection callbacks without modifying Fast or download nodes.

- #workflow [[spotify]] [[api]] [[normalization]] The proposed Spotify workflow supports search, track, album_tracks, and artist_albums operations, with normalized evidence objects for downstream agents.

- #lesson [[n8n]] [[validation]] [[connections]] The partial workflow update was validation-only and succeeded; changes were not applied. IF-node connections should prefer explicit branch=true/false parameters to avoid ambiguity warnings.

- #decision [[spotify]] [[n8n]] [[workflow]] [[phase1]] Spotipy Music Data Tool v1 now supports read-only Spotify operations: search, track, album_tracks, and artist_albums.

- #workflow [[spotify]] [[normalization]] [[evidence]] Spotify evidence is normalized into a consistent item schema containing IDs, names, URLs, artists, album metadata, release data, track details, popularity, and related fields.

- #fact [[n8n]] [[validation]] [[workflow]] The updated Spotipy Music Data Tool v1 passed strict n8n validation with no errors and 11 valid connections, though warnings remain.

- #correction [[n8n]] [[workflow]] [[debugging]] The n8n workflow diff was not applied or saved because Route Fast input output 8 already had a connection to Build Redis Chat admission; avoid adding duplicate connections.

- #decision [[spotipy]] [[chat-selection]] [[redis]] [[workflow]] Spotipy Fast Mode now supports chatSelect callbacks: Redis admission, callback acknowledgement, exact Spotify track lookup, context construction, and routing into the AI Agent.

- #workflow [[telegram]] [[modes]] [[callbacks]] [[state]] Parse Fast input maintains per-chat /fast and /chat modes using workflow static data, and recognizes fast:<YouTubeId>:<SpotifyId> and chatselect:<SpotifyId> callbacks.

- #decision [[grounding]] [[spotify]] [[telegram]] [[ai-agent]] Chat responses for selected tracks must be grounded only in verified Spotify evidence, limited to catalog metadata, formatted with Telegram HTML, and end with one short follow-up question.

- #decision [[spotify]] [[candidate-selection]] [[telegram]] Phase 1 track queries should present up to five verified Spotify candidates as inline Telegram buttons before providing detailed track facts.

- #decision [[grounding]] [[follow-ups]] [[spotify]] Spotipy must ground catalog names, links, release details, and recommendations in verified Spotify evidence; contextual follow-ups should rely on recent conversation rather than unrelated fresh results.

- #preference [[telegram]] [[formatting]] [[response-style]] Telegram replies should use concise HTML formatting, remain under roughly 600 characters, avoid Markdown and unsupported tags, and never expose internal instructions or workflow details.

- #decision [[recommendations]] [[spotify]] [[conversation]] Generic music recommendations without a concrete artist, title, album, or playlist should first ask one concise preference question instead of presenting arbitrary catalog results as personalized.

- #decision [[redis]] [[chat-concurrency]] [[cancellation]] Chat completion handling uses Redis lock ownership, pending updates, cancellation keys, and update IDs to prevent stale or cancelled responses from being delivered.

- #decision [[spotipy]] [[spotify]] [[telegram]] [[candidate-selection]] Spotipy Fast Mode now presents up to five grounded Spotify track candidates as Telegram inline buttons using chatselect:<trackId>; detailed facts wait until the user selects one.

- #workflow [[grounding]] [[follow-up]] [[spotify]] [[hallucination-prevention]] Contextual follow-ups resolve references from recent conversation and ignore unrelated fresh Spotify results; unavailable evidence must not produce invented catalog facts or links.

- #workflow [[redis]] [[locking]] [[cancellation]] [[chat]] Chat completion Redis logic verifies lock ownership, handles cancellation and newer pending updates, and cleans up lock/cancel keys before returning chatDone.

- #correction [[n8n]] [[validation]] [[telegram]] [[known-error]] Strict workflow validation remains invalid because Telegram node “Edit Fast audio caption” uses unsupported operation editMessageCaption; this is the only reported error after the update.

- #decision [[spotipy]] [[spotify]] [[selection]] [[grounding]] Spotipy Fast Mode uses Phase 1 Spotify candidate selection: when multiple matches exist, Telegram shows up to five track-ID buttons and avoids ungrounded fact claims until a match is chosen.

- #workflow [[n8n]] [[candidate-propagation]] [[telegram]] Candidate propagation was fixed by sourcing phase1Candidates from the chat context/selection nodes in Prepare Chat reply, with a deterministic selection prompt.

- #correction [[telegram]] [[callback]] [[parsing]] [[routing]] The Phase 1 callback test failed after candidate presentation succeeded; Telegram callback parsing/routing requires inspection and correction, including small parsing mismatches.

- #decision [[telegram]] [[html]] [[formatting]] [[chat]] Spotipy Fast Mode sanitizes Chat responses by converting Markdown bold/italic to safe Telegram HTML and escaping unsupported markup before sending.

- #decision [[callbacks]] [[telegram]] [[redis]] [[concurrency]] Telegram callbacks are parsed only when callback ID, chat ID, and message ID are present; Chat selection callbacks are acknowledged immediately while Redis admission remains serialized.

- #fact [[n8n]] [[validation]] [[telegram]] [[known-issue]] The workflow's remaining strict validation error is the pre-existing Telegram operation editMessageCaption on node Edit Fast audio caption; this n8n version supports editMessageText instead.

- #lesson [[testing]] [[telegram]] [[callbacks]] Synthetic callback tests can fail because Telegram rejects non-issued or expired callback query IDs; callback acknowledgment tests should use a real Telegram callback ID.

- #decision [[spotipy]] [[n8n]] [[chat]] [[spotify]] Spotipy Fast Mode workflow HYRePy4buI9l4SEk includes grounded /chat Spotify lookup with up to five candidate track buttons; selection uses chatselect:<SpotifyID> for exact lookup.

- #workflow [[redis]] [[serialization]] [[telegram]] [[n8n]] Chat mode uses Redis-backed per-Telegram-chat serialization for normal messages and selection callbacks, including bounded pending messages, cancellation, and update deduplication.

- #lesson [[telegram]] [[testing]] [[callbacks]] Real callback validation requires tapping a live Telegram inline button; fabricated callback query IDs are rejected by Telegram and should not be used for testing.

- #fact [[n8n]] [[validation]] [[telegram]] The workflow’s strict validator reports one known schema error for the custom Telegram editMessageCaption operation; runtime publication remains successful.

- #fact [[telegram]] [[callbacks]] [[concurrency]] Telegram callback buttons do reach the workflow; concurrent clicks can trigger the active-request lock, returning a busy response while the first callback is still processing.

- #decision [[spotify]] [[normalization]] [[grounding]] Exact Spotify track callbacks can return a raw track object rather than a search-envelope shape; normalization must support both shapes and failed verification must not fall back to prior context or invented facts.

- #correction [[n8n]] [[validation]] [[telegram]] Spotipy Fast Mode validation currently fails on the unsupported Telegram operation editMessageCaption and a Prepare Chat reply array-items error; these must be fixed before considering the workflow valid.

- #fact [[n8n]] [[validation]] [[telegram]] Spotipy Fast Mode has a pre-existing validation error: Telegram operation "editMessageCaption" is unsupported; it is separate from formatter issues.

- #lesson [[n8n]] [[workflow-editing]] [[patching]] When patching n8n code, inspect the current workflow first; exact string patches can fail on whitespace or content differences, while a carefully scoped regex patch succeeded.

- #decision [[formatter]] [[static-analysis]] [[grounding]] The formatter change replaced an inline IIFE used for groundedFallback with explicit conditional assignment to address static-analysis validation without changing grounded output.

- #decision [[spotipy]] [[phases]] [[chat-mode]] [[downloads]] Spotipy implementation is phased: Phase 1 covers selection, grounded facts, callbacks, serialization, bounded memory, and follow-ups without downloads; Phase 2 adds verified background audio delivery.

- #fact [[spotipy]] [[n8n]] [[validation]] [[callbacks]] Spotipy Fast Mode workflow HYRePy4buI9l4SEk successfully delivered candidate buttons and processed a live track-selection callback; the project moved on to Phase 2 planning.

- #fact [[n8n]] [[validation]] [[telegram]] [[fast-mode]] Strict n8n validation still reports one known error: Telegram node 'Edit Fast audio caption' uses editMessageCaption, unsupported by the validator despite expected runtime behavior.

- #fact [[spotipy]] [[fast-mode]] [[telegram]] [[workflow]] Spotipy Fast Mode is active in workflow HYRePy4buI9l4SEk. It searches ten YouTube sources and downloads only the explicitly selected source, prioritizing low latency over Spotify resolution and lyrics.

- #decision [[spotipy]] [[chat-mode]] [[spotify]] [[selection]] Chat mode performs read-only Spotify catalog lookups, presents up to five grounded track candidates, and requires an inline-button selection before treating a track as selected.

- #fact [[spotipy]] [[downloads]] [[reliability]] [[vps]] The Spotify download path was repaired and validated using metadataQuery, official Spotify track lookup, a healthy YouTube worker, temporary Telegram progress messages, and post-download cleanup.

- #decision [[chat-downloads]] [[phase-2]] [[testing]] [[telegram]] Phase 2 was approved: add Chat downloads by reusing the verified VPS dispatcher, sending exactly one Telegram audio message, cleaning up jobs, and preserving grounded Chat behavior. Testing should use different artists.

- #decision [[n8n]] [[spotipy]] [[chat-download]] [[workflow]] The Spotipy Fast Mode workflow now has a separate Chat-only verified audio download branch; Fast mode remains unchanged.

- #workflow [[n8n]] [[spotdl]] [[spotify]] [[audio]] Chat downloads validate a single Spotify track URL, preserve selected metadata, dispatch spotdl, transfer/send audio, and clean up the job directory.

- #correction [[n8n]] [[validation]] [[if-node]] [[bug]] Strict workflow validation found both new IF nodes use v1-style boolean conditions with typeVersion 2.2; n8n ignores them and always takes the true branch.

- #fact [[n8n]] [[telegram]] [[validation]] [[bug]] Strict validation also reports a pre-existing invalid Telegram operation: Edit Fast audio caption uses unsupported editMessageCaption.

- #decision [[n8n]] [[spotipy]] [[chat-download]] [[workflow]] In n8n workflow “Spotipy Fast Mode” (HYRePy4buI9l4SEk), Chat download eligibility and success filters use strict boolean checks on $json.downloadOk.

- #lesson [[n8n]] [[telegram]] [[activation]] [[debugging]] A Daft Punk Chat callback successfully produced grounded metadata, but no audio; the execution used the pre-download graph and skipped all new Chat download nodes, indicating an activation-cache/stale-active-workflow issue.

- #fact [[n8n]] [[telegram]] [[validation]] In the current n8n Telegram node, editMessageCaption is invalid; supported alternatives include editMessageText, sendRichMessageDraft, and setDescription.

- #fact [[spotipy]] [[n8n]] [[download]] [[bug]] Spotipy Fast Mode’s Telegram selection callback reaches grounded Spotify metadata/context but does not produce or send a usable song download.

- #decision [[debugging]] [[workflow]] [[callback]] Before modifying the Spotipy workflow, inspect the latest callback execution and identify the exact node boundary where processing stops before the audio download.
