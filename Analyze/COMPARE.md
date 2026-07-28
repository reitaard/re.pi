# Recode vs jcode

## Scope

This comparison uses:

- `analyze/REPIAUDIT.md`: Recode at `733df388` on `agent-harness`, with upstream Pi inspected at `c820aa26`.
- `analyze/JCODEAUDIT.md`: jcode at `a92b270b30e0a3a7fadf5e00594a2cc9af1c5888`.
- A targeted Recode RPC startup rerun: three measured isolated/offline runs after one warmup, median **1,525.8 ms**, range **1,522.0–1,553.2 ms**.
- Static source verification for jcode. jcode was not built or executed locally because no jcode release binary or build toolchain is currently installed.

The comparison distinguishes repository/core functionality from capabilities supplied to this particular Recode session by globally installed packages.

## Executive verdict

**jcode is currently the stronger integrated end-user product for fast startup, many simultaneous sessions, built-in swarm coordination, shared-resource efficiency, and prebuilt cross-platform distribution.** Its persistent server architecture is a real design advantage, not just marketing.

**Recode is currently the stronger programmable coding-agent harness.** It has a more mature SDK/extension/package model, first-class LSP integration, a simpler codebase and development loop, carefully bounded specialist workers, and more explicit human-governed durable memory admission.

For the Creator’s intended multi-session workflow, Recode is behind jcode today. The gap is concentrated rather than universal: startup and process architecture, orchestrator reliability, and product packaging—not the fundamental agent loop or coding-tool quality.

## Implementation traceability

This is an overall product comparison, not only a startup benchmark. [`Analyze/PLAN.md`](../Analyze/PLAN.md) converts its findings into ordered implementation tracks:

| Comparison finding | Active response |
|---|---|
| Slow startup and duplicated package/runtime graphs | S0–S4 package artifacts, readiness levels and matched performance gates |
| Weak root multi-session lifecycle and ten-session scaling | O0–O9 Hermes lifecycle port, durable service, attach/detach and shared ownership |
| Browser/MCP capability exists as installed ecosystem rather than coherent distribution | S2 certifies first-party `repi-browser`, then formalizes MCP/browser service ownership and release identity |
| Release availability and product identity trail jcode | release hardening plus the P0 distribution/identity backlog |
| Recode’s LSP, exact tools, SDK/extensions and bounded workers are stronger | explicit preservation gates; these capabilities may not be removed to improve timing |
| Recode memory governance is stronger but semantic retrieval is weaker | retain admission/provenance; evaluate optional hybrid semantic retrieval after lifecycle correctness |
| jcode has stronger destructive-command defense | post-checkpoint P2 safety work, independent of startup |
| jcode has broader built-in TUI/ambient/voice features | product backlog, not falsely counted as delivered by startup or service work |

The current implementation is deliberately on S2 because configured package loading is the measured startup bottleneck and the boundary between Recode’s extensibility advantage and its integration/distribution weakness. Later comparison areas remain tracked even when they are not part of the current code phase.

## Hard comparison

| Area | Better today | Assessment |
|---|---|---|
| Startup and perceived responsiveness | **jcode** | Clear architectural and published-measurement advantage, although equivalent local metrics are still required. |
| Ten-session resource scaling | **jcode** | One daemon shares heavy state; Recode currently pays for separate Node/RPC children. |
| Multi-session lifecycle | **jcode** | Server-owned sessions, reconnecting clients, recovery and hot reload are implemented. Recode’s separate orchestrator is experimental and unsafe under hangs/crashes. |
| Parallel agents / swarm | **jcode** | Broader built-in coordination, messaging, plans, bounded recursive modes and optional worktrees. Recode workers are capable but intentionally narrower. |
| Specialist worker discipline | **Recode** | Named, role-bounded conversations with explicit tools and read-only shared memory create a clearer manager/specialist contract. |
| Durable memory sophistication | **jcode** | Embeddings, graph retrieval, confidence and extraction are materially richer. |
| Memory governance and inspectability | **Recode** | Markdown is human-auditable; project/global scope is explicit; writes require admission and secret checks; workers cannot silently write memory. |
| Extensibility and embedding | **Recode** | Extensions, package resources, custom tools/providers/UI, SDK, JSON and RPC form a stronger public customization surface. |
| Code intelligence | **Recode** | First-class LSP diagnostics, references, symbols, definitions, rename, formatting and code actions. jcode lists LSP only in proposed workspace material. |
| Core MCP | **jcode** | Built-in shared/per-session stdio MCP manager. Recode core philosophy delegates MCP to extensions/packages. |
| Core browser automation | **jcode** | Firefox Agent Bridge is built in. Recode’s repository core does not ship equivalent first-party browser automation. |
| This deployed session’s browser | **Recode environment** | The installed RePi Browser package provides guarded multi-engine workflows, evidence, downloads and diagnostics beyond jcode’s current Firefox-only core; this is ecosystem capability, not a core-repo win. |
| Provider breadth | **Rough tie** | Both are broad. Recode inherits a mature Pi provider abstraction; jcode has many native and OpenAI-compatible profiles. Named-profile counts should not be mistaken for independent protocols. |
| TUI ambition and visual features | **jcode** | Side panels, mermaid, widgets, server clients and desktop work are broader; published responsiveness is far ahead. Recode’s TUI is mature and extensible but less product-rich. |
| General safety | **Neither** | Both execute with user privileges and are not sandboxes. jcode has a stronger destructive-command gate; Recode has project trust and clearer operational boundaries. jcode’s full safety system remains design/incomplete. |
| Release availability | **jcode** | Existing multi-platform binary workflow and published assets. Recode’s reproducible cross-platform release goal is documented but npm trusted publishing and complete certification are unfinished. |
| Maintainability / contribution loop | **Recode** | Recode has fewer source files and workspace units, focused validation is cheaper, and features can be added through packages without rebuilding core. jcode’s README reports roughly one-minute cached incremental builds. This is an iteration-cost comparison, not a language judgment. |
| Product/documentation consistency | **Neither** | Recode ships `recode` while primary docs still say Pi/`pi`; jcode README overstates parts of memory, conflict resolution and browser breadth. |

## Complete feature-by-feature inventory

| Feature | Recode | jcode | Judgment |
|---|---|---|---|
| Core agent loop | Mature Pi-derived loop with tool streaming, reasoning levels, retries and multiple transports. | Integrated loop with many tools and provider runtimes. | **Tie:** both are credible coding agents; no evidence yet that one model loop produces better code with the same model. |
| Basic coding tools | Built-in read/write/edit/bash/grep/find/ls, plus exact edit semantics. | Broad built-in tool catalogue including patching, shell, search and integrated product tools. | **Recode for precision; jcode for breadth.** |
| LSP/code intelligence | First-class diagnostics, definitions, references, symbols, call hierarchy, rename, formatting and code actions. | LSP appears in proposed workspace material, not as a verified current subsystem. | **Recode clearly.** |
| Session persistence | JSONL session tree organized by working directory. | Server-owned persistent sessions with reconnecting clients. | **jcode for lifecycle; Recode for transparent file format.** |
| Branching/history navigation | `/tree`, labels, in-file branches, `/fork`, `/clone`, import/export and HTML/JSONL output. | Resume and session management are strong, including importing/resuming sessions from other harnesses. | **Recode for native tree manipulation; jcode for cross-harness resume.** |
| Compaction | Automatic/manual compaction with extension hooks and full JSONL history retained. | Compaction subsystem and dedicated core crate. | **Rough tie; Recode’s public customization surface is clearer.** |
| Message delivery while working | Steering and follow-up queues with configurable delivery. | Inputs are interleaved when safe, with queued submission available. | **jcode slightly** for immediate interleaving; both solve mid-turn input. |
| Root multi-session runtime | Experimental child-process orchestrator, currently unreliable. | Persistent daemon owns many sessions; clients reconnect and hot reload. | **jcode decisively.** |
| Multiple sessions in one visible client | Not implemented as one workspace UI; orchestrator is external/experimental. | Also not current: its multi-session client/surface design is explicitly proposed. | **Neither.** jcode’s server is multi-session, but one client normally shows one session. |
| Named specialist workers | Mayuri, Levi and Shiori have bounded roles, tools and independent conversation IDs inside Aizen. | General swarm members can receive scopes and coordinate. | **Recode** for curated specialist discipline. |
| General swarm/multi-agent work | Concurrent workers exist, but no mature shared plan/worktree/session server. | DMs, broadcasts, plans, tasks, ownership, bounded deep spawning, touch notifications and optional worktrees. | **jcode decisively**, while automatic conflict *resolution* remains overstated. |
| Memory storage | Approved Markdown source of truth plus SQLite FTS index. | Persistent semantic/vector and graph-oriented memory structures. | Different strengths. |
| Memory retrieval | FTS5/BM25 lexical retrieval with project/global scope. | Local embeddings, cosine similarity, graph traversal, confidence and side-agent relevance checks. | **jcode technically.** |
| Memory extraction | Creator/Teach/Cardinal-controlled durable writes; no unrestricted automatic worker admission. | Automatic/background extraction and end-of-session processing. | **jcode for automation; Recode for control.** |
| Memory consolidation | Human-editable correction/archive workflow; no semantic graph consolidation. | Duplicate and contradiction handling on write; full graph-wide stale verification/pruning remains planned. | **jcode ahead**, but README overstates completeness. |
| Memory safety/governance | Explicit global/project roots, launch-cwd authority, stale-evidence policy, secret-pattern rejection and worker read-only access. | Provenance/confidence mechanisms, but much more automatic admission and retrieval. | **Recode clearly** for auditability and human authority. |
| Skills | Agent Skills support, explicit loading, package distribution and slash invocation. | Skills can be semantically injected and manually activated. | **jcode** for context-efficient automatic discovery; **Recode** for standard packaging and predictability. |
| Prompt templates | First-class Markdown templates with arguments and package distribution. | No equally strong verified public template ecosystem in the audit. | **Recode.** |
| Themes/UI customization | Themes, hot reload, replaceable editor, overlays, widgets, footer/header/status APIs. | Rich first-party visual UI, but less evidence of a comparably stable external UI extension API. | **Recode for customization; jcode for built-in experience.** |
| Extension/plugin API | Public extension API for tools, commands, providers, events, compaction and UI. | Hooks, skills and self-development, but no comparably broad verified external extension contract. | **Recode decisively.** |
| Package ecosystem | npm/git packages can bundle extensions, skills, prompts and themes; project/global installation and configuration are built in. | MCP configs, skills and hooks are supported, but there is no equivalent verified general feature-package format. | **Recode decisively.** |
| SDK/embedding | Public SDK, runtime replacement API, JSON mode and RPC protocol. | Harness/server APIs exist, but the audited public embedding/customization story is less mature. | **Recode.** |
| Self-development/hot reload | `/reload` refreshes resources; custom source updates and packing are guarded. | Agent can modify source, rebuild, and hot-reload daemon/clients. | **jcode** for integrated self-dev; Recode extensions avoid needing rebuilds. |
| Hooks | Extensions can intercept lifecycle/tool events and implement gates. | Observer hooks plus `pre_tool` gate hooks with recursion protection. | **Tie:** Recode is more programmable; jcode provides a simpler built-in shell hook boundary. |
| MCP | Available through extensions/packages; current MCP gateway has no configured servers. | Built-in shared/per-session manager and config import, but stdio only. | **jcode out of the box.** |
| Browser automation | Core repo relies on packages/extensions. This deployed session has a sophisticated guarded RePi Browser package. | First-party Firefox Agent Bridge integration; broader backend protocol is draft. | **jcode core; deployed Recode environment for capability depth.** |
| Background shell/jobs | Upstream philosophy avoids built-in background bash and recommends tmux/extensions. | Background commands, progress and completion/wake behavior are integrated. | **jcode.** |
| Notifications/ambient operation | No equivalent mature autonomous ambient subsystem in the audited core. | Ambient workflows, notifications and permission requests exist, though the complete safety system is unfinished. | **jcode**, with safety qualification. |
| Voice/dictation | No verified first-party feature. | `jcode dictate` supports configured speech-to-text command workflows. | **jcode.** |
| Mermaid/side panels/info widgets | Possible through TUI/extensions but not a comparable first-party integrated surface. | First-party side panel, mermaid rendering and negative-space widgets. | **jcode.** |
| Provider protocols | Mature Pi AI package with many native APIs, compatibility configuration and generated model catalogues. | Several native provider runtimes plus many OpenAI-compatible profiles. | **Tie/slight Recode** for mature protocol abstraction; profile counts alone do not prove breadth. |
| OAuth/subscription login | Anthropic, OpenAI/Codex and Copilot subscription flows plus custom Recode OpenAI OAuth proxy work. | Broad integrated login flows and multi-account switching across several providers. | **jcode slightly** for integrated account UX. |
| Project trust | Explicit trusted-project decision before loading local executable resources/settings. | Safety hooks and destructive gates exist, but the audited general safety design is incomplete. | **Recode** for project-resource trust. |
| Destructive command defense | Relies primarily on instructions, project trust, extensions/containers and operational policy. | Deterministic catastrophic-target denial and justification gate. | **jcode.** |
| Sandbox | Optional extension/container approaches; ordinary tools retain host privileges. | Ordinary tools also retain host privileges; permission design is not a sandbox. | **Neither.** |
| Update safety | Recode-specific fail-closed source update policy preserves dirty work and product identity. | Integrated binary update/self-dev/reload paths. | **Recode** for repository preservation; **jcode** for end-user integration. |
| Release artifacts | Packaging machinery exists, but trusted npm publication and full release certification are blocked/incomplete. | Published cross-platform binaries, checksums and signing workflow. | **jcode today.** |
| Windows/Linux/Termux | Target is one reproducible package/binary set; Windows works, wider certification is unfinished. | Linux, macOS, Windows and FreeBSD release paths; Termux installation documented through glibc. | **jcode today.** |
| Test surface | 214 coding-agent test files; focused worker/memory/LSP tests; orchestrator has zero tests. | Approximately 7,559 test declarations across a very large workspace. | **jcode for breadth; Recode core is well tested but orchestration is a hole.** |
| Build/iteration speed | Smaller workspace; focused edits/tests and package-only changes are comparatively cheap. | Much larger workspace; README admits approximately one-minute cached incremental builds. | **Recode decisively**, based on workflow cost rather than implementation language. |
| Dependency/runtime footprint | A full runtime/module graph is currently paid per independent process; startup and multi-process scaling are costly. | Shared daemon plus smaller clients; optional embeddings add substantial memory cost. | **jcode** for multi-session efficiency; memory-off and memory-on must be distinguished. |
| Documentation accuracy | Main docs retain Pi branding and wrong `pi` command despite shipping `recode`. | Strong documentation volume, but several README claims outrun architecture status. | **Neither; different documentation failures.** |

## Startup and resource efficiency

### What is known

Recode’s measured Node RPC ready-state is approximately **1.5 seconds** on this Windows machine. The metric waits for an actual `get_state` response, so it represents a usable process-integration lifecycle point. An earlier first isolated launch reached **28.9 seconds**, but that outlier has not been reproduced with a phase trace and must not yet be treated as a stable cold-start number.

jcode publishes **14.0 ms** median to first visible frame and **48.7 ms** to first input over ten Linux PTY launches. Its benchmark harness is inspectable, but hardware details, raw tracked artifacts and a result from the audited commit are absent.

These numbers are **not directly ratio-comparable**: jcode measures terminal paint/input while Recode was measured through RPC ready-state. Nevertheless, the user’s perception that Recode starts slowly is credible, and jcode’s persistent daemon plus small clients gives it a structural warm-start advantage.

### Why jcode scales better

jcode launches one shared server and lightweight clients. Provider state, embeddings, MCP pools and session coordination can be amortized. Its memory benchmark intentionally measures that topology.

Recode’s current full-session design launches a coding-agent RPC child per orchestrated instance. That preserves isolation and reuses the existing CLI, but duplicates Node runtime/module/config costs and is exposed to child startup and shutdown failures. Named workers inside one Recode session are lighter, but they are not equivalent to many independently attachable root sessions.

### Required fair test

Before publishing a numerical winner ratio, run both release artifacts on the same Windows and Linux hosts and record:

1. cold process to first frame;
2. warm process/client to first frame;
3. typed input echo;
4. session/provider-ready state;
5. first model token with the same provider/model/prompt;
6. private working set/PSS for 1 and 10 idle sessions;
7. CPU while idle and while streaming;
8. exact binary hash, auth state, cache state and raw per-run JSON.

No architectural conclusion depends on jcode’s exact 14 ms claim: Recode’s current ~1.5-second RPC startup and child-per-session approach already identify the priority.

## Coding-agent quality from Aizen’s point of view

### Where Recode feels stronger

1. **Precise code operations:** exact replacement edits plus LSP diagnostics/navigation make repository work safer and more deterministic than relying primarily on shell/search tools.
2. **Manager/specialist separation:** Aizen can delegate bounded research, audit and private-knowledge work without turning the root session into an uncontrolled swarm.
3. **Memory admission:** Kioku treats recall as potentially stale evidence, separates project/global roots, keeps memory human-readable, prevents worker writes, and rejects likely secrets. This is less automatic than jcode but better governed.
4. **Programmability:** the SDK, extension API and package format can replace or add tools, providers, events, UI and compaction without rebuilding the harness.
5. **Iteration speed:** focused package changes and tests are much cheaper than modifying and rebuilding jcode’s large core workspace.

These strengths directly improve correctness during coding tasks. They should not be discarded to chase lower startup numbers.

### Where jcode would feel better

1. **Immediate entry:** a persistent server should make opening another working session feel nearly instant.
2. **Parallel workspace:** server-owned sessions, DMs, broadcasts, touch notifications and plan coordination are closer to a native multi-agent environment.
3. **Long-lived state:** clients can reconnect without tying session ownership to one terminal process.
4. **Resource sharing:** ten sessions do not require ten complete provider/harness stacks.
5. **Integrated product:** MCP, browser, memory, swarm and release binaries are presented as one coherent application rather than a core plus custom packages and an unfinished supervisor.

For a user who routinely opens many sessions, these advantages are more visible than Recode’s internal elegance.

## Memory comparison

jcode is technically ahead in retrieval: local embeddings, semantic similarity, graph links, confidence updates, extraction and background processing. Recode currently indexes approved Markdown chunks with SQLite FTS5/BM25. It does not match jcode’s semantic graph.

Recode is ahead in control: durable facts enter through explicit Creator/Teach/Cardinal policy; memories remain editable Markdown; project identity is tied to launch cwd; workers have read-only recall. This reduces silent contamination and makes corrections auditable.

Best direction for Recode: retain the current admission and Markdown source-of-truth model, then add optional embeddings and hybrid lexical/semantic ranking. Do **not** copy automatic extraction or consolidation without preserving explicit admission, provenance and stale-evidence handling.

## Worker and orchestrator comparison

Recode’s named workers are a good feature, not a failed imitation of swarms. They solve bounded specialization inside one session and currently have a clearer safety model than unconstrained recursive agents.

The separate Recode orchestrator is the weak point:

- RPC requests have no deadlines;
- child termination can wait forever;
- persistence is non-atomic;
- stopped records disappear;
- restart recovery cannot reattach;
- no orchestrator tests exist;
- the documented CLI is not exposed as a package binary.

jcode’s server/session system is substantially ahead here. Recode should not market the orchestrator as equivalent until those lifecycle gaps are fixed.

## Extensibility versus integration

Recode and jcode optimize opposite sides:

- **Recode:** small composable harness, stable extension/SDK surfaces, packages chosen by the user.
- **jcode:** integrated product with many first-party subsystems and self-development through source modification/reload.

Recode’s approach is better for organizations and developers who need custom policy/tooling without maintaining a fork. jcode’s approach is better for users who want features installed and coordinated by default.

jcode’s self-dev story is powerful but expensive: changing the product means navigating and rebuilding a very large core workspace. It is not a substitute for a stable lightweight plugin API. Recode should preserve its extension and package advantage while curating a stronger default distribution.

## Safety comparison

Neither product should be described as sandboxed.

- Recode loads project resources behind trust decisions and supports external sandbox/container extensions, but ordinary tools and extensions run with launcher privileges.
- jcode has deterministic catastrophic/destructive command gating, pre-tool hooks and ambient permission requests. Its broader tiered safety/review system is still incomplete, and normal tool execution remains host-privileged.

jcode is slightly ahead on built-in destructive-command defense. Recode is clearer about trust and has stronger operational repository rules in this deployment. Both need enforced containment for unattended agents.

## What looks bad for Recode

- Startup is visibly slow and lacks retained phase-level benchmark evidence.
- The child-per-root-session architecture will scale poorly compared with a shared daemon.
- The orchestrator has correctness defects severe enough to hang lifecycle operations.
- Product identity is unfinished: Recode code, Pi documentation.
- Browser and MCP excellence in this session depends on installed packages rather than a coherent default Recode distribution.
- Release/publishing readiness trails jcode.

## What looks good for Recode

- Core agent/session/provider functionality comes from a mature Pi lineage.
- LSP and precise editing create a strong coding workflow.
- SDK/extensions/packages are a real strategic advantage.
- Named specialists are useful, bounded and operational now.
- Kioku’s governance is safer and more inspectable than fully automatic memory extraction.
- The codebase is materially smaller and faster to modify than jcode.
- Recode can adopt the best architectural ideas without replacing its proven core.

## Recommended direction

### Immediate priorities

1. **Make startup measurable:** persist JSON timing artifacts and instrument imports, config/context discovery, package/extension loading, memory initialization, provider setup, session restoration, RPC ready and first render.
2. **Fix the orchestrator before adding features:** deadlines, cancellation, kill escalation, atomic manifests, retained terminal records, ownership receipts, attach/detach and failure tests.
3. **Use a long-lived supervisor/service:** avoid paying full Node/module initialization for every attached UI. Reuse provider/model/package metadata and memory indexes where isolation permits.
4. **Correct Recode identity and packaging:** ship coherent `recode` docs, browser/MCP package recommendations or defaults, and certified release artifacts.
5. **Keep Recode’s advantages:** LSP, SDK, extensions, exact tools, bounded workers and memory admission.

### Do not copy blindly

- Do not replace Recode’s core solely to chase startup numbers; process architecture, shared services and eager initialization are the relevant issues.
- Do not copy automatic memory extraction without user-governed admission and provenance.
- Do not promise automatic conflict resolution; detect and coordinate conflicts explicitly.
- Do not expand the orchestrator feature surface until lifecycle correctness is proven.
- Do not use jcode’s self-published benchmark ratios as product claims without local reproduction.

## Final judgment

If choosing a tool **today for many fast concurrent terminal sessions**, jcode has it better.

If choosing a foundation **today for a programmable, inspectable coding agent with strong code intelligence and custom workflows**, Recode has it better.

For this project’s actual goal—Aizen plus multiple reliable sessions on several machines—jcode is currently ahead at the system architecture/product layer. Recode remains competitive at the agent/tooling layer. The shortest path to closing the gap is not feature parity: it is a reliable long-lived supervisor, dramatically better startup, coherent distribution, and preservation of Recode’s existing LSP/extension/memory-governance strengths.
