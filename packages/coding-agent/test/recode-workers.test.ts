import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createModels, fauxProvider } from "@reitaard/repi-ai";
import { visibleWidth } from "@reitaard/repi-tui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAgentSessionServices } from "../src/core/agent-session-services.ts";
import { createDelegateTool } from "../src/core/delegation/delegate-tool.ts";
import { REPI_CREATOR_IDENTITY } from "../src/core/delegation/orchestration-identity.ts";
import { WorkerChatController } from "../src/core/delegation/worker-chat.ts";
import { WorkerDirectory } from "../src/core/delegation/worker-directory.ts";
import { REPI_NAMED_WORKERS } from "../src/core/delegation/worker-registry.ts";
import {
	applyWorkerSettingsConfig,
	normalizeWorkerSettingsConfig,
	readWorkerSettingsConfig,
	writeWorkerSettingsConfig,
} from "../src/core/delegation/worker-settings.ts";
import { createWorkerControlTools } from "../src/core/delegation/worker-tools.ts";
import type { ExtensionCommandContext } from "../src/core/extensions/types.ts";
import { DefaultResourceLoader } from "../src/core/resource-loader.ts";
import { type SessionEntry, SessionManager } from "../src/core/session-manager.ts";
import { createToolDefinitionFromAgentTool } from "../src/core/tools/tool-definition-wrapper.ts";
import {
	createRecodeWorkerIndicator,
	creatorForeground,
	workerForeground,
} from "../src/modes/interactive/components/recode-worker-indicator.ts";
import {
	parseWorkerSettingId,
	RecodeWorkerSettingsComponent,
} from "../src/modes/interactive/components/recode-worker-settings.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import {
	formatCreatorMessage,
	recodeWorkers,
	renderRoster,
	renderStatuses,
	renderWorkerCall,
	restoreDirectWorkerChats,
	settleWorkerActivity,
	type WorkerHandoffEntry,
	WorkerResultCard,
	withWorkerToolPresentation,
	workerActivityText,
	workerActivityWidgetKey,
	workerRouteLabel,
} from "../src/recode-workers.ts";

describe("recode worker TUI", () => {
	const roots: string[] = [];

	afterEach(() => {
		for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
	});

	it("uses simple deterministic worker language and distinguishes direct chat from delegation", () => {
		const mayuri = REPI_NAMED_WORKERS.find((worker) => worker.id === "research");
		const levi = REPI_NAMED_WORKERS.find((worker) => worker.id === "audit");
		if (!mayuri || !levi) throw new Error("Worker fixtures missing");

		const leviDirect = workerActivityText(levi, "direct", 1);
		const leviDelegated = workerActivityText(levi, "delegated", 1);
		const mayuriPhrases = new Set([1, 2, 3].map((turn) => workerActivityText(mayuri, "direct", turn)));

		expect(leviDirect).toContain("Levi (監査)");
		expect(leviDirect).not.toContain("Aizen");
		expect(leviDelegated).toContain("for Aizen (藍染)");
		expect(mayuriPhrases.size).toBeGreaterThan(1);
		expect(workerRouteLabel("Levi (監査)", "direct")).toBe("Levi (監査) · direct chat");
		expect(workerRouteLabel("Levi (監査)", "delegated")).toBe("Levi (監査) → Aizen (藍染) · handoff");
		expect(workerActivityWidgetKey("research")).not.toBe(workerActivityWidgetKey("audit"));
	});

	it("clears pending worker activity before publishing the completed result", () => {
		const order: string[] = [];
		settleWorkerActivity(
			() => order.push("clear"),
			() => order.push("append"),
		);
		expect(order).toEqual(["clear", "append"]);
	});

	it("loads the worker roster, direct-chat command, and handoff renderer as an inline extension", async () => {
		const root = join(tmpdir(), `recode-workers-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		const cwd = join(root, "project");
		const agentDir = join(root, "agent");
		mkdirSync(cwd, { recursive: true });
		mkdirSync(agentDir, { recursive: true });
		roots.push(root);

		const registration = fauxProvider({ provider: "recode-workers-test" });
		const models = createModels();
		models.setProvider(registration.provider);
		const directory = new WorkerDirectory({
			cwd,
			workers: REPI_NAMED_WORKERS,
			model: registration.getModel(),
			models,
		});
		const loader = new DefaultResourceLoader({
			cwd,
			agentDir,
			noExtensions: true,
			noSkills: true,
			noPromptTemplates: true,
			noThemes: true,
			extensionFactories: [
				{
					name: "recode-workers",
					factory: (pi) => recodeWorkers(pi, directory, { settingsPath: join(agentDir, "recode-workers.json") }),
				},
			],
		});

		await loader.reload();

		const result = loader.getExtensions();
		expect(result.errors).toEqual([]);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toBe("<inline:recode-workers>");
		expect(result.extensions[0].commands.has("worker")).toBe(true);
		expect(result.extensions[0].commands.get("worker")?.argumentHint).toBe("[chat|close] <worker> [message]");
		expect(result.extensions[0].commands.get("levi")?.argumentHint).toBe("<message>");
		expect(result.extensions[0].commands.get("mayuri")?.argumentHint).toBe("<message>");
		expect(await result.extensions[0].commands.get("levi")?.getArgumentCompletions?.("")).toEqual([
			{ value: "", label: "<message>", description: "Type a direct message for Levi (監査)" },
		]);
		expect(result.extensions[0].entryRenderers?.has("recode-worker-handoff")).toBe(true);
		expect(result.extensions[0].entryRenderers?.has("recode-creator-worker-message")).toBe(true);

		const waitForIdle = vi.fn(async () => {});
		const custom = vi.fn(async () => undefined);
		const notify = vi.fn();
		const workerCommand = result.extensions[0].commands.get("worker");
		if (!workerCommand) throw new Error("worker command missing");
		await workerCommand.handler("", {
			modelRegistry: { getAvailable: () => [] },
			ui: { custom, notify },
			waitForIdle,
		} as unknown as ExtensionCommandContext);
		expect(custom).toHaveBeenCalledOnce();
		expect(waitForIdle).not.toHaveBeenCalled();
		expect(notify).not.toHaveBeenCalled();

		const tools = [createDelegateTool({ directory }), ...createWorkerControlTools(directory)].map((tool) =>
			withWorkerToolPresentation(createToolDefinitionFromAgentTool(tool), directory),
		);
		expect(tools.every((tool) => tool.renderCall && tool.renderResult)).toBe(true);

		initTheme("dark");
		const rosterCall = renderWorkerCall(directory, "worker_list", {}, theme).render(100).join("\n");
		const rosterResult = renderRoster(directory.listWorkers(), theme).render(100).join("\n");
		expect(rosterCall).toContain(theme.fg("accent", "✦"));
		expect(rosterCall).toContain("worker roster");
		expect(rosterResult).toContain("Mayuri (研究)");
		expect(rosterResult).toContain("Levi (監査)");
		expect(rosterResult).toContain("id:");
		expect(rosterResult).toContain("name:");
		expect(rosterResult).toContain("role:");
		expect(rosterResult).toContain("persona:");
		expect(rosterResult).toContain("tools:");

		vi.useFakeTimers();
		try {
			const state: { frameIndex?: number; interval?: ReturnType<typeof setInterval> } = {};
			const invalidate = vi.fn();
			const pendingContext = { state, isPartial: true, invalidate } as never;
			const firstFrame = renderWorkerCall(directory, "delegate", { worker: "audit" }, theme, pendingContext)
				.render(100)
				.join("\n");
			expect(firstFrame).toContain(theme.fg("accent", "✦"));
			expect(firstFrame.replace(/\x1b\[[0-9;]*m/g, "")).toContain("Levi (監査)");
			vi.advanceTimersByTime(100);
			expect(invalidate).toHaveBeenCalled();
			const secondFrame = renderWorkerCall(directory, "delegate", { worker: "audit" }, theme, pendingContext)
				.render(100)
				.join("\n");
			expect(secondFrame).not.toBe(firstFrame);
			renderWorkerCall(directory, "delegate", { worker: "audit" }, theme, {
				state,
				isPartial: false,
			} as never);
			expect(state.interval).toBeUndefined();
		} finally {
			vi.useRealTimers();
		}
	});

	it("uses distinct worker colors, a teal Creator color, and animated shimmer dots", () => {
		initTheme("dark");
		const mayuri = workerForeground("research", "identity", "Mayuri", theme);
		const levi = workerForeground("audit", "identity", "Levi", theme);
		const creator = creatorForeground("Creator", theme);
		const indicator = createRecodeWorkerIndicator("audit", "Levi is checking", theme);
		const frames = indicator.frames ?? [];

		expect(mayuri).not.toBe(levi);
		expect(creator).toMatch(/\u001b\[38;(?:2;0;230;195|5;49)m/);
		expect(indicator.intervalMs).toBe(90);
		expect(frames.length).toBeGreaterThanOrEqual(12);
		expect(frames[0]).toContain(theme.fg("accent", "✦"));
		expect(frames[1]).toContain(theme.fg("accent", "✧"));
		expect(new Set(frames.slice(0, 4)).size).toBe(4);
		expect(frames.some((frame) => frame.endsWith(".\u001b[39m"))).toBe(true);
		expect(frames.some((frame) => frame.endsWith("...\u001b[39m"))).toBe(true);

		initTheme("light");
		expect(workerForeground("research", "identity", "Mayuri", theme)).not.toBe(
			workerForeground("audit", "identity", "Levi", theme),
		);
		initTheme("dark");
	});

	it("renders explicit Creator identity and width-aware worker cards after JSON restoration", () => {
		initTheme("dark");
		expect(formatCreatorMessage("Remember bluebird.")).toBe('Creator: "Remember bluebird."');
		const restored = JSON.parse(
			JSON.stringify({
				mode: "direct",
				workerId: "audit",
				workerName: "Levi",
				workerAliases: ["監査"],
				status: "completed",
				output: "The remembered word is bluebird.",
				harnessSetupDurationMs: 0.18,
				durationMs: 2_100,
				turnCount: 2,
			}),
		) as WorkerHandoffEntry;
		const card = new WorkerResultCard(restored, theme);

		for (const width of [4, 36, 100]) {
			const lines = card.render(width);
			expect(lines.length).toBeGreaterThan(0);
			expect(lines.every((line) => visibleWidth(line) <= width)).toBe(true);
			if (width >= 5) expect(lines.every((line) => visibleWidth(line) === width)).toBe(true);
		}
		const wide = card.render(100);
		expect(wide[1]).toContain("Levi (監査) · direct chat");
		expect(wide[1]).toContain("2.1 s");
		expect(wide.join("\n")).not.toContain("completed");
		expect(wide.join("\n")).toContain("The remembered word is bluebird.");
		expect(wide.join("\n")).not.toContain("conversationId");
		expect(wide.every((line) => line.includes(theme.getBgAnsi("customMessageBg")))).toBe(true);
		const statusText = renderStatuses(
			[
				{
					workerId: "audit",
					workerName: "Levi",
					workerAliases: ["監査"],
					status: "completed",
					turnCount: 2,
					elapsedMs: 2_100,
					taskSummary: "Remember bluebird.",
				} as never,
			],
			theme,
		)
			.render(100)
			.join("\n");
		expect(statusText).toContain("2.1 s");
		expect(statusText).not.toContain("completed");

		const delegated = new WorkerResultCard({ ...restored, mode: "delegated" }, theme).render(100);
		expect(delegated.some((line) => line.includes(theme.getBgAnsi("customMessageBg")))).toBe(false);
	});

	it("restores direct-chat state from typed entries on the active session branch", () => {
		const registration = fauxProvider({ provider: "recode-worker-restore-test" });
		const models = createModels();
		models.setProvider(registration.provider);
		const directory = new WorkerDirectory({
			cwd: process.cwd(),
			workers: REPI_NAMED_WORKERS,
			model: registration.getModel(),
			models,
		});
		const chat = new WorkerChatController(directory);
		const data: WorkerHandoffEntry = {
			mode: "direct",
			workerId: "audit",
			workerName: "Levi",
			workerAliases: ["監査"],
			status: "completed",
			output: "I will remember cobalt.",
			harnessSetupDurationMs: 0.2,
			durationMs: 1000,
			turnCount: 1,
			conversationId: "restore-conversation",
			runId: "restore-run",
			speaker: REPI_CREATOR_IDENTITY,
			message: "Remember cobalt.",
			createdAt: 1000,
			updatedAt: 2000,
		};
		const entries: SessionEntry[] = [
			{
				type: "custom",
				id: "restore-entry",
				parentId: null,
				timestamp: new Date(2000).toISOString(),
				customType: "recode-worker-handoff",
				data,
			},
		];

		restoreDirectWorkerChats(entries, chat, directory);

		expect(chat.getConversationId("Levi")).toBe("restore-conversation");
		expect(directory.getStatus("restore-conversation")[0]).toMatchObject({
			workerId: "audit",
			turnCount: 1,
			lastOutput: "I will remember cobalt.",
		});
	});

	it("can persist a custom-entry-only worker session before an Aizen reply", () => {
		const root = join(tmpdir(), `recode-worker-flush-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		const sessionDir = join(root, "sessions");
		mkdirSync(sessionDir, { recursive: true });
		roots.push(root);
		const sessionManager = SessionManager.create(root, sessionDir);
		const sessionFile = sessionManager.getSessionFile();
		if (!sessionFile) throw new Error("Persisted worker session file missing");

		sessionManager.appendCustomEntry("recode-worker-handoff", { conversationId: "worker-only" });
		expect(() => readFileSync(sessionFile, "utf8")).toThrow();
		expect(sessionManager.flush()).toBe(true);
		expect(readFileSync(sessionFile, "utf8")).toContain('"conversationId":"worker-only"');
	});

	it("normalizes, persists, and applies only valid worker settings", async () => {
		const root = join(tmpdir(), `recode-worker-settings-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		const settingsPath = join(root, "nested", "recode-workers.json");
		roots.push(root);
		const config = normalizeWorkerSettingsConfig({
			audit: {
				thinkingLevel: "high",
				maxOutputTokens: 8192,
				modelPreference: { provider: "local", id: "audit-model" },
			},
			research: { thinkingLevel: "invented", maxOutputTokens: -1 },
			ignored: "not-an-object",
		});

		expect(config).toEqual({
			audit: {
				thinkingLevel: "high",
				maxOutputTokens: 8192,
				modelPreference: { provider: "local", id: "audit-model" },
			},
			research: {},
		});
		await writeWorkerSettingsConfig(settingsPath, config);
		expect(await readWorkerSettingsConfig(settingsPath)).toEqual(config);
		expect(JSON.parse(readFileSync(settingsPath, "utf8"))).toEqual(config);

		const registration = fauxProvider({ provider: "recode-worker-settings-test" });
		const models = createModels();
		models.setProvider(registration.provider);
		const directory = new WorkerDirectory({
			cwd: root,
			workers: REPI_NAMED_WORKERS,
			model: registration.getModel(),
			models,
		});
		applyWorkerSettingsConfig(directory, config);
		expect(directory.getWorkerSettings("監査")).toEqual({
			thinkingLevel: "high",
			maxOutputTokens: 8192,
			modelPreference: { provider: "local", id: "audit-model" },
		});
		expect(parseWorkerSettingId("audit:thinking")).toEqual({ workerId: "audit", action: "thinking" });
		expect(parseWorkerSettingId("audit:unknown")).toBeUndefined();

		initTheme("dark");
		const settings = new RecodeWorkerSettingsComponent(
			{
				workers: directory.listWorkers(),
				directChats: new Map([
					[
						"audit",
						{
							workerId: "audit",
							workerName: "Levi",
							status: "completed",
							turnCount: 2,
						} as never,
					],
				]),
				modelValues: [],
				maxVisible: 20,
			},
			() => {},
			() => {},
		);
		const renderedSettings = settings.render(100);
		const settingsText = renderedSettings.join("\n");
		expect(settingsText.match(/Mayuri \(研究\)/g)).toHaveLength(2);
		expect(settingsText.match(/Levi \(監査\)/g)).toHaveLength(1);
		expect(settingsText.match(/Direct Chat/g)).toHaveLength(4);
		expect(settingsText).toContain("continue · 2 turns");
		expect(settingsText).toContain("─────────────");
		expect(renderedSettings.every((line) => visibleWidth(line) <= 100)).toBe(true);
	});

	it("wires the worker UI into session services when delegation is enabled", async () => {
		const root = join(tmpdir(), `recode-worker-services-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		const cwd = join(root, "project");
		const agentDir = join(root, "agent");
		mkdirSync(cwd, { recursive: true });
		mkdirSync(agentDir, { recursive: true });
		roots.push(root);
		const previous = process.env.REPI_DELEGATION;
		process.env.REPI_DELEGATION = "1";

		try {
			const services = await createAgentSessionServices({
				cwd,
				agentDir,
				resourceLoaderOptions: {
					noExtensions: true,
					noSkills: true,
					noPromptTemplates: true,
					noThemes: true,
				},
			});
			const workerExtension = services.resourceLoader
				.getExtensions()
				.extensions.find((extension) => extension.path === "<inline:recode-workers>");

			expect(services.workerDirectory?.resolveWorker("監査").displayName).toBe("Levi");
			expect(workerExtension?.commands.has("worker")).toBe(true);
		} finally {
			if (previous === undefined) delete process.env.REPI_DELEGATION;
			else process.env.REPI_DELEGATION = previous;
		}
	});
});
